import { db } from "@/lib/db";
import { requireDefaultProgramPermission, errorResponse, PERMISSIONS } from "@/lib/authz";
import type { Prisma, Role, UserStatus } from "@prisma/client";

/**
 * GET /api/admin/users?status=&role=&q=&page=
 * People in the default programme: its members and its staff. Users who only
 * belong to other programmes are not listed.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { scope } = await requireDefaultProgramPermission(PERMISSIONS.PARTICIPANT_READ);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as UserStatus | null;
    const role = url.searchParams.get("role") as Role | null;
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 20;

    const where: Prisma.UserWhereInput = {
      OR: [
        { memberships: { some: { programId: scope.programId } } },
        { roleAssignments: { some: { programId: scope.programId, revokedAt: null } } },
      ],
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          mentorProfile: {
            select: { department: true, registrationNumber: true },
          },
          menteeProfile: {
            select: { department: true, registrationNumber: true, waitlisted: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ]);

    return Response.json({ users, total, page, pageSize });
  } catch (error) {
    return errorResponse(error);
  }
}
