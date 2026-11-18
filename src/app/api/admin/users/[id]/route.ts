import { db } from "@/lib/db";
import {
  AuthorizationError,
  bumpSessionVersion,
  errorResponse,
  PERMISSIONS,
  requireDefaultProgramPermission,
  requirePlatformPermission,
} from "@/lib/authz";
import { can } from "@/lib/rbac/authorize";
import { userDecisionSchema } from "@/lib/validators";
import { attemptPairing, retryWaitlist } from "@/lib/pairing";
import { sendMail } from "@/lib/email/mailer";
import { logAudit } from "@/lib/audit";
import {
  accountApprovedEmail,
  accountRejectedEmail,
} from "@/lib/email/templates";

/**
 * PATCH /api/admin/users/:id — approve or reject a registration in the
 * default programme. The target must be a member of that programme.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { session, actor, scope } = await requireDefaultProgramPermission(
      PERMISSIONS.REGISTRATION_REVIEW
    );
    const { id } = await params;

    const parsed = userDecisionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid action" }, { status: 422 });
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        mentorProfile: true,
        menteeProfile: true,
        memberships: { where: { programId: scope.programId }, select: { id: true } },
        roleAssignments: { where: { revokedAt: null }, select: { id: true } },
      },
    });
    // Someone outside this programme looks like they do not exist.
    if (!user || user.memberships.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    // Changing an administrator's account is a platform decision.
    if (user.roleAssignments.length > 0 && !can(actor, PERMISSIONS.USER_SUSPEND, {})) {
      throw new AuthorizationError(403, "Only a platform administrator can change this account");
    }
    if (user.id === session.user.id) {
      return Response.json(
        { error: "You cannot change your own status" },
        { status: 400 }
      );
    }

    const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
    await db.$transaction([
      // Legacy account gate (login requires APPROVED) — decoupled from
      // programme approval in Phase 4.
      db.user.update({ where: { id }, data: { status } }),
      db.programMembership.updateMany({
        where: { userId: id, programId: scope.programId },
        data:
          status === "APPROVED"
            ? { status: "ACTIVE", joinedAt: new Date() }
            : { status: "INACTIVE" },
      }),
    ]);
    if (status === "REJECTED") await bumpSessionVersion(id);

    await logAudit({
      actorId: session.user.id,
      action: status === "APPROVED" ? "user.approve" : "user.reject",
      targetType: "User",
      targetId: user.id,
      programId: scope.programId,
      institutionId: scope.institutionId,
      metadata: { name: user.name, email: user.email, role: user.role },
    });

    let pairing: { status: string } | null = null;

    if (status === "APPROVED") {
      const mail = accountApprovedEmail(user.name);
      await sendMail({ to: user.email, ...mail });

      if (user.role === "MENTEE" && user.menteeProfile) {
        // Automatic pairing immediately after approval.
        pairing = await attemptPairing(user.menteeProfile.id);
      }
      if (user.role === "MENTOR" && user.mentorProfile) {
        // A new mentor is available — retry the waitlist.
        const paired = await retryWaitlist(user.mentorProfile.semesterId);
        pairing = { status: `waitlist-retried:${paired}` };
      }
    } else {
      const mail = accountRejectedEmail(user.name);
      await sendMail({ to: user.email, ...mail });
    }

    return Response.json({ message: `User ${status.toLowerCase()}`, pairing });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/admin/users/:id — remove an account entirely. An account can
 * span several programmes, so this is a platform-level action.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { session } = await requirePlatformPermission(PERMISSIONS.USER_DELETE);
    const { id } = await params;

    if (id === session.user.id) {
      return Response.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    await logAudit({
      actorId: session.user.id,
      action: "user.delete",
      targetType: "User",
      targetId: user.id,
      metadata: { name: user.name, email: user.email, role: user.role },
    });

    return Response.json({ message: "User deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
