import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { announcementSchema } from "@/lib/validators";
import { sanitizeText, sanitizeMultiline } from "@/lib/sanitize";
import { sendBulkMail } from "@/lib/email/mailer";
import { announcementEmail } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

function audienceRoles(audience: "ALL" | "MENTORS" | "MENTEES"): Role[] {
  if (audience === "MENTORS") return ["MENTOR"];
  if (audience === "MENTEES") return ["MENTEE"];
  return ["MENTOR", "MENTEE"];
}

// Bulk sends run at reduced concurrency plus a retry pass (see
// sendBulkMail) — this can take a while for large recipient lists, so
// give the function more room than the platform default.
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireSession(["ADMIN"]);

    const parsed = announcementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { title, body, audience, sendEmail } = parsed.data;
    const activeSemester = await db.semester.findFirst({
      where: { isActive: true },
    });

    const announcement = await db.announcement.create({
      data: {
        title: sanitizeText(title),
        body: sanitizeMultiline(body),
        audience,
        semesterId: activeSemester?.id,
        createdById: session.user.id,
        emailSent: sendEmail,
      },
    });

    let emailResult: { sent: number; failed: number; failures: { email: string; error: string }[] } | null =
      null;

    if (sendEmail) {
      const recipients = await db.user.findMany({
        where: { status: "APPROVED", role: { in: audienceRoles(audience) } },
        select: { email: true },
      });
      const mail = announcementEmail(announcement.title, announcement.body);
      emailResult = await sendBulkMail(
        recipients.map((r) => r.email),
        mail.subject,
        mail.html
      );
    }

    await logAudit({
      actorId: session.user.id,
      action: "announcement.create",
      targetType: "Announcement",
      targetId: announcement.id,
      metadata: {
        title: announcement.title,
        audience,
        emailSent: sendEmail,
        ...(emailResult
          ? {
              emailSentCount: emailResult.sent,
              emailFailedCount: emailResult.failed,
              failedEmails: emailResult.failures.slice(0, 25).map((f) => f.email),
            }
          : {}),
      },
    });

    return Response.json({ announcement, emailResult }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
