import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemUpdateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/interests/:id — rename and/or toggle active.
 * Deactivating hides it from new registrations/edits only — existing
 * MentorInterest/MenteeInterest rows keep pointing at this Interest, so
 * students who already picked it keep it on their profile.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { session } = await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);
    const { id } = await params;

    const parsed = catalogItemUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const existing = await db.interest.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Interest not found" }, { status: 404 });
    }

    const name = parsed.data.name ? sanitizeText(parsed.data.name) : undefined;
    if (name) {
      const clash = await db.interest.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (clash) {
        return Response.json(
          { error: "An interest with this name already exists." },
          { status: 409 }
        );
      }
    }

    const interest = await db.interest.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "interest.update",
      targetType: "Interest",
      targetId: interest.id,
      metadata: { name: interest.name, isActive: interest.isActive },
    });

    return Response.json({ interest });
  } catch (error) {
    return errorResponse(error);
  }
}
