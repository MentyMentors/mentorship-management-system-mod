import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireActor } from "@/lib/authz";
import { administrativeReach, can } from "@/lib/rbac/authorize";
import { resolveProgramScope } from "@/lib/rbac/scope";
import type { Prisma } from "@prisma/client";
import { meetingLogSchema } from "@/lib/validators";
import { sanitizeText, sanitizeMultiline } from "@/lib/sanitize";
import { createZoomMeeting } from "@/lib/zoom";

/** GET /api/meetings — meetings visible to the current user. */
export async function GET(): Promise<Response> {
  try {
    const { session, actor } = await requireActor();
    const userId = session.user.id;

    // Own meetings, plus every meeting in programmes the caller administers.
    const reach = administrativeReach(actor);
    const own: Prisma.MeetingWhereInput = {
      pairing: {
        OR: [{ mentorProfile: { userId } }, { menteeProfile: { userId } }],
      },
    };
    const where: Prisma.MeetingWhereInput = reach.platform
      ? {}
      : {
          OR: [
            own,
            ...(reach.programIds.length ? [{ programId: { in: reach.programIds } }] : []),
            ...(reach.institutionIds.length
              ? [{ program: { institutionId: { in: reach.institutionIds } } }]
              : []),
          ],
        };

    const meetings = await db.meeting.findMany({
      where,
      include: {
        pairing: {
          include: {
            mentorProfile: { include: { user: { select: { name: true } } } },
            menteeProfile: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    return Response.json({ meetings });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/meetings — mentors log a meeting for one of their pairings. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { session, actor } = await requireActor();

    const parsed = meetingLogSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const pairing = await db.pairing.findUnique({
      where: { id: parsed.data.pairingId },
      include: {
        mentorProfile: { include: { user: { select: { name: true } } } },
        menteeProfile: { include: { user: { select: { name: true } } } },
      },
    });
    if (!pairing) {
      return Response.json({ error: "Pairing not found" }, { status: 404 });
    }

    // The pairing's own mentor may log meetings; otherwise the caller needs
    // meeting management rights in the pairing's programme.
    const isOwnMentor = pairing.mentorProfile.userId === session.user.id;
    if (!isOwnMentor) {
      const scope = pairing.programId ? await resolveProgramScope(pairing.programId) : null;
      if (!scope || !can(actor, PERMISSIONS.MEETING_MANAGE, scope)) {
        return Response.json({ error: "Not your pairing" }, { status: 403 });
      }
    }

    // Only upcoming meetings get a Zoom link — a meeting logged in the
    // past already happened and has nothing to join. Best-effort: never
    // blocks meeting creation if Zoom is unconfigured or unreachable.
    let zoom: { meetingId: string; joinUrl: string } | null = null;
    if (parsed.data.date > new Date()) {
      zoom = await createZoomMeeting({
        topic: `Mentorship meeting: ${pairing.mentorProfile.user.name} & ${pairing.menteeProfile.user.name}`,
        startTime: parsed.data.date,
        durationMinutes: parsed.data.durationMinutes,
      });
    }

    const meeting = await db.meeting.create({
      data: {
        pairingId: pairing.id,
        programId: pairing.programId,
        date: parsed.data.date,
        durationMinutes: parsed.data.durationMinutes,
        topics: sanitizeText(parsed.data.topics),
        notes: parsed.data.notes ? sanitizeMultiline(parsed.data.notes) : null,
        createdById: session.user.id,
        zoomMeetingId: zoom?.meetingId,
        zoomJoinUrl: zoom?.joinUrl,
      },
    });

    return Response.json({ meeting }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
