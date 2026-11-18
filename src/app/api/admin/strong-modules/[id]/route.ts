import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemUpdateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/strong-modules/:id — rename and/or toggle active.
 * Deactivating hides it from new registrations/edits only —
 * MentorProfile.strongModules stores names as free text, so
 * already-registered mentors are never touched by changes here.
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

    const existing = await db.strongModule.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Module not found" }, { status: 404 });
    }

    const name = parsed.data.name ? sanitizeText(parsed.data.name) : undefined;
    if (name) {
      const clash = await db.strongModule.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (clash) {
        return Response.json(
          { error: "A module with this name already exists." },
          { status: 409 }
        );
      }
    }

    const strongModule = await db.strongModule.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "module.update",
      targetType: "StrongModule",
      targetId: strongModule.id,
      metadata: { name: strongModule.name, isActive: strongModule.isActive },
    });

    return Response.json({ strongModule });
  } catch (error) {
    return errorResponse(error);
  }
}
