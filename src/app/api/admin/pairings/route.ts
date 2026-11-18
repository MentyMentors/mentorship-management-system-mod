import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { manualPairingSchema } from "@/lib/validators";
import { sendMail } from "@/lib/email/mailer";
import { logAudit } from "@/lib/audit";
import {
  pairingEmailForMentee,
  pairingEmailForMentor,
} from "@/lib/email/templates";

export async function GET(req: Request): Promise<Response> {
  try {
    const { scope } = await requireDefaultProgramPermission(PERMISSIONS.PAIRING_READ);
    const url = new URL(req.url);
    const semesterId = url.searchParams.get("semesterId") ?? undefined;

    const pairings = await db.pairing.findMany({
      where: {
        programId: scope.programId,
        ...(semesterId ? { semesterId } : {}),
        status: "ACTIVE",
      },
      include: {
        mentorProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        menteeProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { meetings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ pairings });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/pairings — manually create a pairing. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { session, scope } = await requireDefaultProgramPermission(PERMISSIONS.PAIRING_MANAGE);

    const parsed = manualPairingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid payload" }, { status: 422 });
    }

    const { mentorProfileId, menteeProfileId } = parsed.data;

    const [mentor, mentee] = await Promise.all([
      db.mentorProfile.findUnique({
        where: { id: mentorProfileId },
        include: {
          user: true,
          semester: { select: { programId: true } },
          pairings: { where: { status: "ACTIVE" } },
        },
      }),
      db.menteeProfile.findUnique({
        where: { id: menteeProfileId },
        include: {
          user: true,
          semester: { select: { programId: true } },
          pairings: { where: { status: "ACTIVE" } },
        },
      }),
    ]);

    // Both sides must belong to this programme; anything else looks absent.
    if (
      !mentor ||
      !mentee ||
      mentor.semester.programId !== scope.programId ||
      mentee.semester.programId !== scope.programId
    ) {
      return Response.json({ error: "Mentor or mentee not found" }, { status: 404 });
    }
    if (mentee.pairings.length > 0) {
      return Response.json(
        { error: "Mentee already has an active mentor" },
        { status: 409 }
      );
    }
    if (mentor.pairings.length >= mentor.maxMentees) {
      return Response.json(
        { error: "Mentor is at full capacity" },
        { status: 409 }
      );
    }
    if (mentor.semesterId !== mentee.semesterId) {
      return Response.json(
        { error: "Mentor and mentee belong to different semesters" },
        { status: 409 }
      );
    }

    const pairing = await db.$transaction(async (tx) => {
      const activeCount = await tx.pairing.count({
        where: { mentorProfileId: mentor.id, status: "ACTIVE" },
      });
      if (activeCount >= mentor.maxMentees) return null;
      const created = await tx.pairing.create({
        data: {
          mentorProfileId: mentor.id,
          menteeProfileId: mentee.id,
          semesterId: mentee.semesterId,
          programId: scope.programId,
        },
      });
      await tx.menteeProfile.update({
        where: { id: mentee.id },
        data: { waitlisted: false, waitlistedAt: null },
      });
      return created;
    });

    if (!pairing) {
      return Response.json(
        { error: "Mentor reached capacity concurrently" },
        { status: 409 }
      );
    }

    const menteeMail = pairingEmailForMentee(
      mentee.user.name,
      mentor.user.name,
      mentor.user.email
    );
    const mentorMail = pairingEmailForMentor(
      mentor.user.name,
      mentee.user.name,
      mentee.user.email
    );
    await Promise.all([
      sendMail({ to: mentee.user.email, ...menteeMail }),
      sendMail({ to: mentor.user.email, ...mentorMail }),
    ]);

    await logAudit({
      actorId: session.user.id,
      action: "pairing.create",
      programId: scope.programId,
      institutionId: scope.institutionId,
      targetType: "Pairing",
      targetId: pairing.id,
      metadata: { mentor: mentor.user.name, mentee: mentee.user.name },
    });

    return Response.json({ pairing }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
