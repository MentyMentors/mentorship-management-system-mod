import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemUpdateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/departments/:id — rename and/or toggle active.
 * Deactivating hides it from new registrations only — MentorProfile /
 * MenteeProfile store department as free text, so already-registered
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

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Department not found" }, { status: 404 });
    }

    const name = parsed.data.name ? sanitizeText(parsed.data.name) : undefined;
    if (name) {
      const clash = await db.department.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      });
      if (clash) {
        return Response.json(
          { error: "A department with this name already exists." },
          { status: 409 }
        );
      }
    }

    const department = await db.department.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "department.update",
      targetType: "Department",
      targetId: department.id,
      metadata: { name: department.name, isActive: department.isActive },
    });

    return Response.json({ department });
  } catch (error) {
    return errorResponse(error);
  }
}
