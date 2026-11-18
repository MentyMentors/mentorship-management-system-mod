import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requirePlatformPermission } from "@/lib/authz";
import type { Prisma } from "@prisma/client";

/** GET /api/admin/audit-log?category=&q=&page= — admin audit trail. */
export async function GET(req: Request): Promise<Response> {
  try {
    await requirePlatformPermission(PERMISSIONS.PLATFORM_AUDIT_READ);

    const url = new URL(req.url);
    const category = url.searchParams.get("category")?.trim();
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 25;

    const where: Prisma.AuditLogWhereInput = {
      ...(category ? { action: { startsWith: `${category}.` } } : {}),
      ...(q
        ? {
            actor: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ]);

    return Response.json({ logs, total, page, pageSize });
  } catch (error) {
    return errorResponse(error);
  }
}
