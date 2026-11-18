import { cache } from "react";
import { db } from "@/lib/db";
import type { Actor } from "./authorize";
import { permissionsForRole } from "./permissions";

/**
 * Loads everything authorisation needs about a user, straight from the
 * database: live role assignments (with their permissions) and programme
 * memberships. Never derived from the session token, so a revoked role stops
 * working on the next request.
 *
 * Memoised per request when called from server components.
 */
export const loadActor = cache(async (userId: string): Promise<Actor> => {
  const now = new Date();
  const [assignments, memberships] = await Promise.all([
    db.roleAssignment.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        scopeType: true,
        institutionId: true,
        programId: true,
        role: { select: { key: true, isSystem: true, permissions: true } },
        institution: { select: { status: true } },
        program: { select: { status: true } },
      },
    }),
    db.programMembership.findMany({
      where: { userId },
      select: { programId: true, role: true, status: true },
    }),
  ]);

  return {
    id: userId,
    assignments: assignments
      // A suspended institution or programme confers no administrative
      // power below platform level.
      .filter(
        (a) =>
          a.institution?.status !== "SUSPENDED" &&
          a.program?.status !== "SUSPENDED"
      )
      .map((a) => ({
        roleKey: a.role.key,
        scopeType: a.scopeType,
        institutionId: a.institutionId,
        programId: a.programId,
        permissions: permissionsForRole(a.role),
      })),
    memberships,
  };
});
