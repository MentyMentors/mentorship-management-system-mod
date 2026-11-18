import { db } from "@/lib/db";
import { errorResponse, requireActor } from "@/lib/authz";
import { visibleAnnouncementsWhere } from "@/services/announcements";

/** GET /api/announcements — announcements visible to the current user. */
export async function GET(): Promise<Response> {
  try {
    const { actor } = await requireActor();

    const announcements = await db.announcement.findMany({
      where: visibleAnnouncementsWhere(actor),
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json({ announcements });
  } catch (error) {
    return errorResponse(error);
  }
}
