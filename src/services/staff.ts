import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email/mailer";
import { APP_URL, roleGrantedEmail, roleInviteEmail } from "@/lib/email/templates";
import { canGrantRole, RequestError, AuthorizationError, type Actor } from "@/lib/rbac/authorize";
import { permissionsForRole } from "@/lib/rbac/permissions";
import { generateInviteToken, hashToken } from "@/lib/tokens";
import { sanitizeText } from "@/lib/sanitize";

/**
 * Programme staff (coordinators, assistants) and institution administrators.
 * The same rules apply to both: you can only appoint someone to a role you
 * could hold yourself in that scope (canGrantRole), and every change is
 * audited and takes effect on the appointee's next request.
 */

export type StaffScope =
  | { scopeType: "PROGRAM"; programId: string; institutionId: string | null; name: string }
  | { scopeType: "INSTITUTION"; institutionId: string; name: string };

const scopeWhere = (scope: StaffScope) =>
  scope.scopeType === "PROGRAM"
    ? { scopeType: "PROGRAM" as const, programId: scope.programId }
    : { scopeType: "INSTITUTION" as const, institutionId: scope.institutionId };

const resourceOf = (scope: StaffScope) =>
  scope.scopeType === "PROGRAM"
    ? { programId: scope.programId, institutionId: scope.institutionId }
    : { institutionId: scope.institutionId };

const manageUrl = (scope: StaffScope) =>
  scope.scopeType === "PROGRAM"
    ? `${APP_URL}/manage/programs/${scope.programId}`
    : `${APP_URL}/manage/institutions/${scope.institutionId}`;

async function loadRole(roleKey: string) {
  const role = await db.adminRole.findUnique({ where: { key: roleKey } });
  if (!role) throw new RequestError(422, "Unknown role");
  return { ...role, permissions: permissionsForRole(role) };
}

export async function listStaff(scope: StaffScope) {
  const [assignments, invites] = await Promise.all([
    db.roleAssignment.findMany({
      where: { ...scopeWhere(scope), revokedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { key: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.adminInvite.findMany({
      where: { ...scopeWhere(scope), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { role: { select: { key: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { assignments, invites };
}

/**
 * Appoints `email` to `roleKey` in `scope`. Existing accounts get the role
 * immediately; anyone else receives a single-use invitation.
 */
export async function addStaff(
  actor: Actor,
  inviter: { id: string; name: string },
  scope: StaffScope,
  email: string,
  roleKey: string
): Promise<{ kind: "assigned" | "invited" | "already" }> {
  const role = await loadRole(roleKey);
  if (!canGrantRole(actor, role, { scopeType: scope.scopeType, ...resourceOf(scope) })) {
    throw new AuthorizationError(403, "You cannot appoint someone to this role here");
  }
  const normalised = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalised } });

  if (user) {
    const existing = await db.roleAssignment.findFirst({
      where: { userId: user.id, roleId: role.id, revokedAt: null, ...scopeWhere(scope) },
    });
    if (existing) return { kind: "already" };
    // Granting needs no session reset: permissions are read from the
    // database on every request. Only removals bump sessionVersion.
    await db.roleAssignment.create({
      data: { userId: user.id, roleId: role.id, grantedById: inviter.id, ...scopeWhere(scope) },
    });
    await sendMail({
      to: user.email,
      ...roleGrantedEmail({ name: user.name, roleName: role.name, targetName: scope.name, manageUrl: manageUrl(scope) }),
    });
    await logAudit({
      actorId: inviter.id,
      action: "role.assign",
      targetType: "User",
      targetId: user.id,
      ...resourceOf(scope),
      metadata: { role: role.key, email: normalised },
    });
    return { kind: "assigned" };
  }

  const pending = await db.adminInvite.findFirst({
    where: {
      email: normalised,
      roleId: role.id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...scopeWhere(scope),
    },
  });
  if (pending) return { kind: "already" };

  const { token, tokenHash, expiresAt } = generateInviteToken();
  await db.adminInvite.create({
    data: {
      email: normalised,
      roleId: role.id,
      tokenHash,
      expiresAt,
      createdById: inviter.id,
      ...scopeWhere(scope),
    },
  });
  await sendMail({
    to: normalised,
    ...roleInviteEmail({
      inviterName: inviter.name,
      roleName: role.name,
      targetName: scope.name,
      acceptUrl: `${APP_URL}/invite/${token}`,
    }),
  });
  await logAudit({
    actorId: inviter.id,
    action: "role.invite",
    targetType: "AdminInvite",
    ...resourceOf(scope),
    metadata: { role: role.key, email: normalised },
  });
  return { kind: "invited" };
}

export async function removeStaff(
  actor: Actor,
  actorUserId: string,
  scope: StaffScope,
  assignmentId: string
): Promise<void> {
  const assignment = await db.roleAssignment.findFirst({
    where: { id: assignmentId, revokedAt: null, ...scopeWhere(scope) },
    include: { role: true },
  });
  if (!assignment) throw new RequestError(404, "Team member not found");

  const role = { ...assignment.role, permissions: permissionsForRole(assignment.role) };
  if (!canGrantRole(actor, role, { scopeType: scope.scopeType, ...resourceOf(scope) })) {
    throw new AuthorizationError(403, "You cannot remove this team member");
  }

  // A programme always keeps at least one coordinator, and an institution at
  // least one administrator, unless Menty itself steps in.
  const isPlatform = actor.assignments.some((a) => a.scopeType === "PLATFORM");
  if (!isPlatform) {
    const remaining = await db.roleAssignment.count({
      where: { roleId: assignment.roleId, revokedAt: null, ...scopeWhere(scope), NOT: { id: assignmentId } },
    });
    const essential =
      assignment.role.key === "program_coordinator" || assignment.role.key === "institution_admin";
    if (essential && remaining === 0) {
      throw new RequestError(409, "Appoint a replacement before removing the last one.");
    }
  }

  await db.$transaction([
    db.roleAssignment.update({ where: { id: assignmentId }, data: { revokedAt: new Date() } }),
    db.user.update({ where: { id: assignment.userId }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  await logAudit({
    actorId: actorUserId,
    action: "role.revoke",
    targetType: "User",
    targetId: assignment.userId,
    ...resourceOf(scope),
    metadata: { role: assignment.role.key },
  });
}

export async function revokeInvite(
  actor: Actor,
  actorUserId: string,
  scope: StaffScope,
  inviteId: string
): Promise<void> {
  const invite = await db.adminInvite.findFirst({
    where: { id: inviteId, acceptedAt: null, revokedAt: null, ...scopeWhere(scope) },
    include: { role: true },
  });
  if (!invite) throw new RequestError(404, "Invitation not found");
  const role = { ...invite.role, permissions: permissionsForRole(invite.role) };
  if (!canGrantRole(actor, role, { scopeType: scope.scopeType, ...resourceOf(scope) })) {
    throw new AuthorizationError(403, "You cannot cancel this invitation");
  }
  await db.adminInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  await logAudit({
    actorId: actorUserId,
    action: "role.invite_revoke",
    targetType: "AdminInvite",
    targetId: inviteId,
    ...resourceOf(scope),
    metadata: { email: invite.email },
  });
}

// ---------------------------------------------------------------------------
// Accepting an invitation
// ---------------------------------------------------------------------------

export async function findInvite(token: string) {
  const invite = await db.adminInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      role: { select: { name: true } },
      program: { select: { id: true, name: true } },
      institution: { select: { id: true, name: true } },
    },
  });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  const account = await db.user.findUnique({ where: { email: invite.email }, select: { id: true } });
  return {
    id: invite.id,
    email: invite.email,
    roleName: invite.role.name,
    targetName: invite.program?.name ?? invite.institution?.name ?? "Menty",
    destination: invite.programId
      ? `/manage/programs/${invite.programId}`
      : invite.institutionId
        ? `/manage/institutions/${invite.institutionId}`
        : "/manage",
    hasAccount: Boolean(account),
  };
}

/**
 * Accepts an invitation, either for the signed-in user (whose email must
 * match) or by creating a new account. Owning the emailed link proves the
 * address, so a new account is created verified and approved.
 */
export async function acceptInvite(
  token: string,
  input: { sessionUser?: { id: string; email: string } | null; name?: string; password?: string }
): Promise<{ destination: string; createdAccount: boolean }> {
  const invite = await db.adminInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
    throw new RequestError(410, "This invitation is no longer valid.");
  }
  const destination = invite.programId
    ? `/manage/programs/${invite.programId}`
    : invite.institutionId
      ? `/manage/institutions/${invite.institutionId}`
      : "/manage";

  const existing = await db.user.findUnique({ where: { email: invite.email } });
  let userId: string;
  let createdAccount = false;

  if (existing) {
    if (!input.sessionUser || input.sessionUser.email.toLowerCase() !== invite.email) {
      throw new RequestError(403, `Sign in as ${invite.email} to accept this invitation.`);
    }
    userId = existing.id;
  } else {
    if (!input.name || !input.password) {
      throw new RequestError(422, "Enter your name and choose a password.");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await db.user.create({
      data: {
        name: sanitizeText(input.name),
        email: invite.email,
        passwordHash,
        role: "USER",
        status: "APPROVED",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
    createdAccount = true;
  }

  await db.$transaction(async (tx) => {
    // Consume the token exactly once, even under concurrent requests.
    const claimed = await tx.adminInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new RequestError(410, "This invitation is no longer valid.");
    const live = await tx.roleAssignment.findFirst({
      where: {
        userId,
        roleId: invite.roleId,
        scopeType: invite.scopeType,
        institutionId: invite.institutionId,
        programId: invite.programId,
        revokedAt: null,
      },
    });
    if (!live) {
      await tx.roleAssignment.create({
        data: {
          userId,
          roleId: invite.roleId,
          scopeType: invite.scopeType,
          institutionId: invite.institutionId,
          programId: invite.programId,
          grantedById: invite.createdById,
        },
      });
    }
  });

  await logAudit({
    actorId: userId,
    action: "role.invite_accept",
    targetType: "AdminInvite",
    targetId: invite.id,
    programId: invite.programId,
    institutionId: invite.institutionId,
  });
  return { destination, createdAccount };
}
