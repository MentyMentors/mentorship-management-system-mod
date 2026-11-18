import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemUpdateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/programmes/:id — rename and/or toggle active.
 * Deactivating hides it from new registrations only — MentorProfile /
 * MenteeProfile store programme as free text, so already-registered
 * students are never touched by changes here.
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

    const existing = await db.programme.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Programme not found" }, { status: 404 });
    }

    const name = parsed.data.name ? sanitizeText(parsed.data.name) : undefined;
    if (name) {
      const clash = await db.programme.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (clash) {
        return Response.json(
          { error: "A programme with this name already exists." },
          { status: 409 }
        );
      }
    }

    const programme = await db.programme.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "programme.update",
      targetType: "Programme",
      targetId: programme.id,
      metadata: { name: programme.name, isActive: programme.isActive },
    });

    return Response.json({ programme });
  } catch (error) {
    return errorResponse(error);
  }
}
