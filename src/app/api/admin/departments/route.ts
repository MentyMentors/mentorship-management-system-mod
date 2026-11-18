import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemCreateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/departments — every department, including inactive. */
export async function GET(): Promise<Response> {
  try {
    await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);
    const departments = await db.department.findMany({ orderBy: { name: "asc" } });
    return Response.json({ departments });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/departments — add a new department. */
export async function POST(req: Request): Promise<Response> {
  try {
    const { session } = await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);

    const parsed = catalogItemCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const name = sanitizeText(parsed.data.name);
    const existing = await db.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return Response.json(
        { error: "A department with this name already exists." },
        { status: 409 }
      );
    }

    const department = await db.department.create({ data: { name } });

    await logAudit({
      actorId: session.user.id,
      action: "department.create",
      targetType: "Department",
      targetId: department.id,
      metadata: { name: department.name },
    });

    return Response.json({ department }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
