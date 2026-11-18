import type { Audience, Prisma } from "@prisma/client";
import { administrativeReach, type Actor } from "@/lib/rbac/authorize";

/**
 * Which announcements a user may see:
 *  - platform-wide announcements (no programme),
 *  - announcements of programmes they are an ACTIVE member of, filtered by
 *    the audience matching their role(s) there,
 *  - every announcement of programmes they administer.
 */
export function visibleAnnouncementsWhere(actor: Actor): Prisma.AnnouncementWhereInput {
  const reach = administrativeReach(actor);
  if (reach.platform) return {};

  const rolesByProgram = new Map<string, Set<string>>();
  for (const m of actor.memberships) {
    if (m.status !== "ACTIVE") continue;
    const roles = rolesByProgram.get(m.programId) ?? new Set<string>();
    roles.add(m.role);
    rolesByProgram.set(m.programId, roles);
  }

  const memberScopes: Prisma.AnnouncementWhereInput[] = [];
  for (const [programId, roles] of rolesByProgram) {
    const audiences: Audience[] = ["ALL"];
    if (roles.has("MENTOR")) audiences.push("MENTORS");
    if (roles.has("MENTEE")) audiences.push("MENTEES");
    memberScopes.push({ programId, audience: { in: audiences } });
  }

  return {
    OR: [
      { programId: null },
      ...memberScopes,
      ...(reach.programIds.length ? [{ programId: { in: reach.programIds } }] : []),
      ...(reach.institutionIds.length
        ? [{ program: { institutionId: { in: reach.institutionIds } } }]
        : []),
    ],
  };
}
