import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { announcementSendChunkSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { sendBulkMail } from "@/lib/email/mailer";
import { announcementEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

// Mirrors /api/admin/bulk-email's chunking — see that route for why.
export const maxDuration = 60;
const CHUNK_SIZE = 15;

function audienceRoles(audience: "ALL" | "MENTORS" | "MENTEES"): Role[] {
  if (audience === "MENTORS") return ["MENTOR"];
  if (audience === "MENTEES") return ["MENTEE"];
  return ["MENTOR", "MENTEE"];
}

/** POST /api/admin/announcements/:id/send — email one chunk of the announcement's audience. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await requireSession(["ADMIN"]);
    const { id } = await params;

    const limit = rateLimit(`announcement-email:${session.user.id}`, {
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return Response.json(
        { error: "Rate limit reached. Try again later." },
        { status: 429 }
      );
    }

    const parsed = announcementSendChunkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const announcement = await db.announcement.findUnique({ where: { id } });
    if (!announcement) {
      return Response.json({ error: "Announcement not found" }, { status: 404 });
    }

    const { offset, runningSent, runningFailed, runningFailedEmails } = parsed.data;

    const allRecipients = await db.user.findMany({
      where: {
        status: "APPROVED",
        role: { in: audienceRoles(announcement.audience) },
      },
      select: { email: true },
      orderBy: { id: "asc" },
    });

    const total = allRecipients.length;
    const chunk = allRecipients.slice(offset, offset + CHUNK_SIZE).map((r) => r.email);

    const mail = announcementEmail(announcement.title, announcement.body);
    const result =
      chunk.length > 0
        ? await sendBulkMail(chunk, mail.subject, mail.html)
        : { sent: 0, failed: 0, failures: [] };

    const sent = runningSent + result.sent;
    const failed = runningFailed + result.failed;
    const failedEmails = [
      ...runningFailedEmails,
      ...result.failures.map((f) => f.email),
    ].slice(0, 50);

    const nextOffset = offset + CHUNK_SIZE;
    const done = nextOffset >= total;

    if (done) {
      await logAudit({
        actorId: session.user.id,
        action: "announcement.email_sent",
        targetType: "Announcement",
        targetId: announcement.id,
        metadata: { title: announcement.title, sent, failed, failedEmails },
      });
    }

    return Response.json({
      sent,
      failed,
      failuresThisChunk: result.failures,
      total,
      nextOffset: done ? null : nextOffset,
      done,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
