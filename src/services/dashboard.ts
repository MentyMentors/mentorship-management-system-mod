import { db } from "@/lib/db";
import type { Actor } from "@/lib/rbac/authorize";
import { visibleAnnouncementsWhere } from "@/services/announcements";
import { listManagedPrograms } from "@/services/programs";

/** Everything on the unified dashboard, for one person across all programmes. */
export async function getUnifiedDashboard(userId: string, actor: Actor) {
  const now = new Date();
  const [memberships, managed, announcements, user, upcomingMeetings, unread] = await Promise.all([
    db.programMembership.findMany({
      where: { userId, status: { notIn: ["REMOVED"] } },
      include: {
        program: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            logoUrl: true,
            deliveryModel: true,
            ownerType: true,
            institution: { select: { name: true, shortName: true } },
            themes: { where: { variant: "PUBLISHED" }, select: { primaryColor: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    listManagedPrograms(actor),
    db.announcement.findMany({
      where: visibleAnnouncementsWhere(actor),
      include: { program: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        mentorProfile: {
          select: {
            pairings: {
              where: { status: "ACTIVE" },
              select: { id: true, programId: true, menteeProfile: { select: { user: { select: { name: true, email: true } } } } },
            },
          },
        },
        menteeProfile: {
          select: {
            pairings: {
              where: { status: "ACTIVE" },
              select: { id: true, programId: true, mentorProfile: { select: { user: { select: { name: true, email: true } } } } },
            },
          },
        },
      },
    }),
    db.meeting.findMany({
      where: {
        date: { gte: now },
        pairing: { OR: [{ mentorProfile: { userId } }, { menteeProfile: { userId } }] },
      },
      include: { program: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  // Group roles per programme: one card per programme.
  const byProgram = new Map<string, { program: (typeof memberships)[number]["program"]; roles: { id: string; role: string; status: string }[] }>();
  for (const m of memberships) {
    const entry = byProgram.get(m.programId) ?? { program: m.program, roles: [] };
    entry.roles.push({ id: m.id, role: m.role, status: m.status });
    byProgram.set(m.programId, entry);
  }

  const relationships = [
    ...(user?.mentorProfile?.pairings ?? []).map((p) => ({ id: p.id, programId: p.programId, kind: "mentee" as const, person: p.menteeProfile.user })),
    ...(user?.menteeProfile?.pairings ?? []).map((p) => ({ id: p.id, programId: p.programId, kind: "mentor" as const, person: p.mentorProfile.user })),
  ];

  return {
    programs: [...byProgram.values()],
    managed,
    announcements,
    relationships,
    upcomingMeetings,
    unread,
  };
}
