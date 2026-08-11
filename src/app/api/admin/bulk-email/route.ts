import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { bulkEmailChunkSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { sendBulkMail } from "@/lib/email/mailer";
import { bulkEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

// One chunk at a time keeps each request comfortably under serverless
// time limits — sending hundreds of recipients in a single invocation
// (even at safe SMTP concurrency) can run long enough to be killed
// mid-send, which is worse than a merely slow send. The client
// (BulkEmailForm) calls this repeatedly with the next offset until done.
export const maxDuration = 60;
const CHUNK_SIZE = 15;

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireSession(["ADMIN"]);

    // CHUNK_SIZE recipients per request — 150 requests/hr gives a ceiling
    // of ~2250 recipients/hr per admin, comfortably above a 1000+ send.
    const limit = rateLimit(`bulk-email:${session.user.id}`, {
      limit: 150,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return Response.json(
        { error: "Bulk email rate limit reached. Try again later." },
        { status: 429 }
      );
    }

    const parsed = bulkEmailChunkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const {
      subject,
      body,
      audience,
      offset,
      runningSent,
      runningFailed,
      runningFailedEmails,
    } = parsed.data;

    const roles: Role[] =
      audience === "MENTORS"
        ? ["MENTOR"]
        : audience === "MENTEES"
          ? ["MENTEE"]
          : ["MENTOR", "MENTEE"];

    // Re-resolved on every chunk (cheap query) rather than trusting a
    // client-supplied list — stays correct even if membership changes
    // slightly mid-send, and needs no server-side state between calls.
    const allRecipients = await db.user.findMany({
      where: { status: "APPROVED", role: { in: roles } },
      select: { email: true },
      orderBy: { id: "asc" },
    });

    const total = allRecipients.length;
    const chunk = allRecipients.slice(offset, offset + CHUNK_SIZE).map((r) => r.email);

    const mail = bulkEmail(subject, body);
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
        action: "email.bulk_send",
        metadata: { subject, audience, sent, failed, failedEmails },
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
