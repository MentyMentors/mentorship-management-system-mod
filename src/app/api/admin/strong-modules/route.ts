import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemCreateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/strong-modules — every strong module, including inactive. */
export async function GET(): Promise<Response> {
  try {
    await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);
    const strongModules = await db.strongModule.findMany({ orderBy: { name: "asc" } });
    return Response.json({ strongModules });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/strong-modules — add a new strong module. */
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
    const existing = await db.strongModule.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return Response.json(
        { error: "A module with this name already exists." },
        { status: 409 }
      );
    }

    const strongModule = await db.strongModule.create({ data: { name } });

    await logAudit({
      actorId: session.user.id,
      action: "module.create",
      targetType: "StrongModule",
      targetId: strongModule.id,
      metadata: { name: strongModule.name },
    });

    return Response.json({ strongModule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
