import type { MembershipStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email/mailer";
import { APP_URL, joinDecisionEmail, joinReceivedEmail } from "@/lib/email/templates";
import { findInstitutionByEmail } from "@/lib/domains";
import { assertCan, RequestError, type Actor } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveProgramScope, DEFAULT_PROGRAM_SETTING } from "@/lib/rbac/scope";
import { sanitizeMultiline } from "@/lib/sanitize";
import {
  CAPACITY_ROLES,
  checkEligibility,
  decisionAllowed,
  initialStatus,
  LIVE_STATUSES,
  registrationWindow,
  selfServiceRoles,
  type DecisionAction,
  type Eligibility,
  type JoinRole,
} from "@/lib/join-rules";
import { VISIBLE_STATUSES, type ProgramStatus } from "@/lib/program-rules";

/** Institutions a person is affiliated with: recorded affiliations + verified email domain. */
export async function affiliatedInstitutionIds(userId: string, email: string): Promise<string[]> {
  const [rows, domain] = await Promise.all([
    db.institutionMembership.findMany({ where: { userId }, select: { institutionId: true } }),
    findInstitutionByEmail(email),
  ]);
  return [...new Set([...rows.map((r) => r.institutionId), ...(domain ? [domain.institutionId] : [])])];
}

async function isLegacyProgram(programId: string): Promise<boolean> {
  const setting = await db.platformSetting.findUnique({ where: { key: DEFAULT_PROGRAM_SETTING } });
  return setting?.value === programId;
}

async function placesTaken(programId: string, tx: Prisma.TransactionClient = db) {
  return tx.programMembership.count({
    where: { programId, role: { in: CAPACITY_ROLES }, status: { in: ["PENDING", "ACTIVE"] } },
  });
}

/** Everything the join page needs to know, for a visitor or a signed-in user. */
export async function getJoinContext(slug: string, user: { id: string; email: string } | null) {
  const program = await db.mentorshipProgram.findUnique({
    where: { slug },
    include: { institution: { select: { name: true } } },
  });
  if (!program || !VISIBLE_STATUSES.includes(program.status as ProgramStatus) || program.visibility === "PRIVATE") {
    return null;
  }
  const legacy = await isLegacyProgram(program.id);
  const window = registrationWindow(program);
  const roles = selfServiceRoles(program.deliveryModel);
  const eligibilityRule = (program.eligibility ?? {}) as Eligibility;
  const institutionNames = Object.fromEntries(
    (
      await db.institution.findMany({
        where: { id: { in: eligibilityRule.institutionIds ?? [] } },
        select: { id: true, name: true },
      })
    ).map((i) => [i.id, i.name])
  );

  let eligibility = null;
  let memberships: { id: string; role: string; status: string }[] = [];
  if (user) {
    eligibility = checkEligibility(
      eligibilityRule,
      { institutionIds: await affiliatedInstitutionIds(user.id, user.email) },
      institutionNames
    );
    memberships = await db.programMembership.findMany({
      where: { programId: program.id, userId: user.id },
      select: { id: true, role: true, status: true },
    });
  }
  const full = program.capacity !== null && (await placesTaken(program.id)) >= program.capacity;
  return { program, legacy, window, roles, eligibility, memberships, full };
}

/** Registers the signed-in user for a programme in one self-service role. */
export async function joinProgram(
  user: { id: string; email: string; name: string },
  slug: string,
  role: JoinRole,
  note?: string
) {
  const ctx = await getJoinContext(slug, user);
  if (!ctx) throw new RequestError(404, "Programme not found");
  const { program } = ctx;
  if (ctx.legacy) throw new RequestError(409, "This programme uses its own registration form.");
  if (!ctx.window.open) throw new RequestError(409, ctx.window.message);
  if (!ctx.roles.includes(role)) throw new RequestError(422, "You cannot sign up for that role in this programme.");
  if (!ctx.eligibility || !ctx.eligibility.eligible) {
    throw new RequestError(403, ctx.eligibility && !ctx.eligibility.eligible ? ctx.eligibility.message : "Not eligible");
  }
  const existing = ctx.memberships.find((m) => m.role === role);
  if (existing && (LIVE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new RequestError(409, "You have already registered for this programme in that role.");
  }
  const needsReview = ctx.eligibility.needsReview;

  const membership = await db.$transaction(async (tx) => {
    const status = initialStatus({
      role,
      requiresApproval: program.requiresApproval,
      needsReview,
      capacity: program.capacity,
      taken: await placesTaken(program.id, tx),
    });
    const data = {
      status: status as MembershipStatus,
      applicationNote: note ? sanitizeMultiline(note) : null,
      joinedAt: status === "ACTIVE" ? new Date() : null,
      reviewedAt: null,
      reviewedById: null,
      reviewNote: null,
    };
    return tx.programMembership.upsert({
      where: { programId_userId_role: { programId: program.id, userId: user.id, role } },
      create: { programId: program.id, userId: user.id, role, expertise: [], ...data },
      update: data,
    });
  });

  // Tell the programme team when there is something to review.
  if (membership.status !== "ACTIVE") {
    const staff = await db.user.findMany({
      where: { status: "APPROVED", roleAssignments: { some: { programId: program.id, revokedAt: null } } },
      select: { id: true },
    });
    if (staff.length) {
      await db.notification.createMany({
        data: staff.map((s) => ({
          userId: s.id,
          type: "APPROVAL" as const,
          title: "New registration",
          body: `${user.name} registered for ${program.name} as ${role.toLowerCase()}.`,
        })),
      });
    }
  }
  await sendMail({
    to: user.email,
    ...joinReceivedEmail({
      name: user.name,
      programName: program.name,
      status: membership.status as "ACTIVE" | "PENDING" | "WAITLISTED",
      url: `${APP_URL}/dashboard/programs/${program.id}`,
    }),
  });
  await logAudit({
    actorId: user.id,
    action: "membership.join",
    targetType: "ProgramMembership",
    targetId: membership.id,
    programId: program.id,
    institutionId: program.institutionId,
    metadata: { role, status: membership.status },
  });
  return { membership, programId: program.id };
}

/** A participant leaves (or cancels a pending registration). */
export async function withdrawMembership(userId: string, membershipId: string) {
  const membership = await db.programMembership.findFirst({ where: { id: membershipId, userId } });
  if (!membership || !(LIVE_STATUSES as readonly string[]).includes(membership.status)) {
    throw new RequestError(404, "Registration not found");
  }
  await db.programMembership.update({ where: { id: membershipId }, data: { status: "WITHDRAWN" } });
  await logAudit({
    actorId: userId,
    action: "membership.withdraw",
    targetType: "ProgramMembership",
    targetId: membershipId,
    programId: membership.programId,
  });
}

// ---------------------------------------------------------------------------
// Coordinator side
// ---------------------------------------------------------------------------

export async function listRegistrations(actor: Actor, programId: string, status?: string) {
  const scope = await resolveProgramScope(programId);
  assertCan(actor, PERMISSIONS.REGISTRATION_READ, scope);
  const [rows, counts] = await Promise.all([
    db.programMembership.findMany({
      where: { programId, ...(status ? { status: status as MembershipStatus } : {}) },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 500,
    }),
    db.programMembership.groupBy({ by: ["status"], where: { programId }, _count: true }),
  ]);
  return {
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>,
  };
}

export async function decideRegistration(
  actor: Actor,
  actorUserId: string,
  programId: string,
  membershipId: string,
  action: DecisionAction,
  note?: string
) {
  const scope = await resolveProgramScope(programId);
  assertCan(actor, action === "remove" ? PERMISSIONS.PARTICIPANT_MANAGE : PERMISSIONS.REGISTRATION_REVIEW, scope);
  const membership = await db.programMembership.findFirst({
    where: { id: membershipId, programId },
    include: { user: true, program: { select: { name: true, capacity: true } } },
  });
  if (!membership) throw new RequestError(404, "Registration not found");
  if (!decisionAllowed(membership.status, action)) {
    throw new RequestError(409, `Cannot ${action} a registration that is ${membership.status.toLowerCase()}.`);
  }
  // The original MUBAS form gates accounts at user level; keep that one path.
  if ((await isLegacyProgram(programId)) && membership.user.status !== "APPROVED") {
    throw new RequestError(409, "Approve this person under Admin → Users (original registration form).");
  }
  if (
    action === "approve" &&
    (CAPACITY_ROLES as string[]).includes(membership.role) &&
    membership.program.capacity !== null &&
    membership.status !== "PENDING" &&
    (await placesTaken(programId)) >= membership.program.capacity
  ) {
    throw new RequestError(409, "The programme is full. Increase its capacity or remove someone first.");
  }

  const status: MembershipStatus =
    action === "approve" ? "ACTIVE" : action === "reject" ? "REJECTED" : action === "waitlist" ? "WAITLISTED" : "REMOVED";
  await db.programMembership.update({
    where: { id: membershipId },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedById: actorUserId,
      reviewNote: note ? sanitizeMultiline(note) : null,
      ...(status === "ACTIVE" ? { joinedAt: new Date() } : {}),
    },
  });
  await sendMail({
    to: membership.user.email,
    ...joinDecisionEmail({
      name: membership.user.name,
      programName: membership.program.name,
      decision: action,
      note,
      url: `${APP_URL}/dashboard/programs/${programId}`,
    }),
  });
  await logAudit({
    actorId: actorUserId,
    action: `membership.${action}`,
    targetType: "ProgramMembership",
    targetId: membershipId,
    ...scope,
    metadata: { user: membership.user.email, role: membership.role },
  });
}
