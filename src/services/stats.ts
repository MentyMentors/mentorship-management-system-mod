import { db } from "@/lib/db";
import type { DashboardStats } from "@/types";

/** The programme's active cohort. Every query here is confined to one programme. */
export async function getActiveSemester(programId: string) {
  return db.semester.findFirst({
    where: { isActive: true, isArchived: false, programId },
  });
}

export async function getDashboardStats(programId: string): Promise<DashboardStats> {
  const activeSemester = await getActiveSemester(programId);
  const semesterFilter = activeSemester
    ? { semesterId: activeSemester.id }
    : { semester: { programId } };

  const [
    mentors,
    mentees,
    pendingApprovals,
    waitlisted,
    activePairings,
    meetingAgg,
  ] = await Promise.all([
    db.mentorProfile.count({
      where: { ...semesterFilter, user: { status: "APPROVED" } },
    }),
    db.menteeProfile.count({
      where: { ...semesterFilter, user: { status: "APPROVED" } },
    }),
    db.programMembership.count({ where: { programId, status: "PENDING" } }),
    db.menteeProfile.count({
      where: { ...semesterFilter, waitlisted: true, user: { status: "APPROVED" } },
    }),
    db.pairing.count({
      where: { programId, ...(activeSemester ? { semesterId: activeSemester.id } : {}), status: "ACTIVE" },
    }),
    db.meeting.aggregate({
      where: {
        programId,
        ...(activeSemester ? { pairing: { semesterId: activeSemester.id } } : {}),
      },
      _count: { id: true },
      _sum: { durationMinutes: true },
    }),
  ]);

  return {
    mentors,
    mentees,
    pendingApprovals,
    waitlisted,
    activePairings,
    meetingsLogged: meetingAgg._count.id,
    totalMeetingMinutes: meetingAgg._sum.durationMinutes ?? 0,
    activeSemester,
  };
}

export interface AnalyticsData {
  pairingsByDepartment: { department: string; count: number }[];
  meetingsPerWeek: { week: string; count: number }[];
  interestPopularity: { name: string; count: number }[];
}

export async function getAnalytics(programId: string): Promise<AnalyticsData> {
  const activeSemester = await getActiveSemester(programId);
  const semesterId = activeSemester?.id;
  const inProgram = { semester: { programId } };

  const [pairings, meetings, interestCounts] = await Promise.all([
    db.pairing.findMany({
      where: { programId, status: "ACTIVE", ...(semesterId ? { semesterId } : {}) },
      include: { menteeProfile: { select: { department: true } } },
    }),
    db.meeting.findMany({
      where: { programId, ...(semesterId ? { pairing: { semesterId } } : {}) },
      select: { date: true },
      orderBy: { date: "asc" },
    }),
    db.interest.findMany({
      include: {
        _count: {
          select: {
            mentors: { where: { mentorProfile: inProgram } },
            mentees: { where: { menteeProfile: inProgram } },
          },
        },
      },
    }),
  ]);

  const byDept = new Map<string, number>();
  for (const p of pairings) {
    const d = p.menteeProfile.department;
    byDept.set(d, (byDept.get(d) ?? 0) + 1);
  }

  const byWeek = new Map<string, number>();
  for (const m of meetings) {
    const date = new Date(m.date);
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const week = Math.ceil(
      ((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7
    );
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }

  return {
    pairingsByDepartment: [...byDept.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    meetingsPerWeek: [...byWeek.entries()].map(([week, count]) => ({
      week,
      count,
    })),
    interestPopularity: interestCounts
      .map((i) => ({
        name: i.name,
        count: i._count.mentors + i._count.mentees,
      }))
      .filter((i) => i.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}
