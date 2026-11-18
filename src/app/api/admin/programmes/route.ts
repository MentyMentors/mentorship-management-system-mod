import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemCreateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/programmes — every programme, including inactive. */
export async function GET(): Promise<Response> {
  try {
    await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);
    const programmes = await db.programme.findMany({ orderBy: { name: "asc" } });
    return Response.json({ programmes });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/programmes — add a new programme. */
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
    const existing = await db.programme.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return Response.json(
        { error: "A programme with this name already exists." },
        { status: 409 }
      );
    }

    const programme = await db.programme.create({ data: { name } });

    await logAudit({
      actorId: session.user.id,
      action: "programme.create",
      targetType: "Programme",
      targetId: programme.id,
      metadata: { name: programme.name },
    });

    return Response.json({ programme }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
