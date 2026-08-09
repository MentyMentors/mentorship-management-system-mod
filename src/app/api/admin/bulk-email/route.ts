import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { bulkEmailSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { sendBulkMail } from "@/lib/email/mailer";
import { bulkEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

// Bulk sends run at reduced concurrency plus a retry pass (see
// sendBulkMail) — this can take a while for large recipient lists, so
// give the function more room than the platform default.
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireSession(["ADMIN"]);

    const limit = rateLimit(`bulk-email:${session.user.id}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return Response.json(
        { error: "Bulk email rate limit reached. Try again later." },
        { status: 429 }
      );
    }

    const parsed = bulkEmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const roles: Role[] =
      parsed.data.audience === "MENTORS"
        ? ["MENTOR"]
        : parsed.data.audience === "MENTEES"
          ? ["MENTEE"]
          : ["MENTOR", "MENTEE"];

    const recipients = await db.user.findMany({
      where: { status: "APPROVED", role: { in: roles } },
      select: { email: true },
    });

    const mail = bulkEmail(parsed.data.subject, parsed.data.body);
    const result = await sendBulkMail(
      recipients.map((r) => r.email),
      mail.subject,
      mail.html
    );

    await logAudit({
      actorId: session.user.id,
      action: "email.bulk_send",
      metadata: {
        subject: parsed.data.subject,
        audience: parsed.data.audience,
        sent: result.sent,
        failed: result.failed,
        // Cap what we store — a full list for a huge recipient set
        // would bloat the audit log; the API response below has the
        // complete list for the admin to act on immediately.
        failedEmails: result.failures.slice(0, 25).map((f) => f.email),
      },
    });

    return Response.json({
      message: `Sent ${result.sent} emails (${result.failed} failed)`,
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
