import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import { catalogItemCreateSchema } from "@/lib/validators";
import { sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/interests — every interest, including inactive. */
export async function GET(): Promise<Response> {
  try {
    await requirePlatformPermission(PERMISSIONS.CATALOG_MANAGE);
    const interests = await db.interest.findMany({ orderBy: { name: "asc" } });
    return Response.json({ interests });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/interests — add a new curated interest. */
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
    const existing = await db.interest.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return Response.json(
        { error: "An interest with this name already exists." },
        { status: 409 }
      );
    }

    const interest = await db.interest.create({
      data: { name, isCustom: false },
    });

    await logAudit({
      actorId: session.user.id,
      action: "interest.create",
      targetType: "Interest",
      targetId: interest.id,
      metadata: { name: interest.name },
    });

    return Response.json({ interest }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
