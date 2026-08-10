import { db } from "@/lib/db";
import { requireSession, errorResponse } from "@/lib/authz";
import { announcementSchema } from "@/lib/validators";
import { sanitizeText, sanitizeMultiline } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

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

    await logAudit({
      actorId: session.user.id,
      action: "announcement.create",
      targetType: "Announcement",
      targetId: announcement.id,
      metadata: { title: announcement.title, audience, emailSent: sendEmail },
    });

    // The email itself (if requested) is sent by the client afterwards,
    // chunked across POST /api/admin/announcements/:id/send — doing it
    // here would tie a slow, multi-recipient send to this request and
    // risk it being killed mid-send for a large audience.
    return Response.json({ announcement }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
