import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { issueReportSchema } from "@/lib/validators";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sanitizeText, sanitizeMultiline } from "@/lib/sanitize";
import { sendMail } from "@/lib/email/mailer";
import { issueReportedEmail } from "@/lib/email/templates";

/** POST /api/issues — any signed-in user reports an issue straight to admins. */
export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireSession();

    const limit = rateLimit(clientKey(req, `issue:${session.user.id}`), {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.success) {
      return Response.json(
        { error: "Too many reports. Try again later." },
        { status: 429 }
      );
    }

    const parsed = issueReportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const subject = sanitizeText(parsed.data.subject);
    const description = sanitizeMultiline(parsed.data.description);

    const report = await db.issueReport.create({
      data: {
        reporterId: session.user.id,
        subject,
        description,
      },
    });

    // Issue reports are handled at platform level.
    const admins = await db.user.findMany({
      where: {
        status: "APPROVED",
        roleAssignments: { some: { scopeType: "PLATFORM", revokedAt: null } },
      },
    });

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "SYSTEM" as const,
        title: "Issue reported",
        body: `${session.user.name} reported: ${subject}`,
      })),
    });

    const mail = issueReportedEmail(
      session.user.name ?? "A user",
      session.user.email ?? "",
      subject,
      description
    );
    await Promise.all(
      admins.map((admin) => sendMail({ to: admin.email, ...mail }))
    );

    return Response.json(
      { message: "Your report was sent to the administrator.", report },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
