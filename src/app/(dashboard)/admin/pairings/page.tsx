import { db } from "@/lib/db";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getActiveSemester } from "@/services/stats";
import { PageHeader } from "@/components/layout/page-header";
import { PairingsManager } from "@/components/admin/pairings-manager";

export const metadata = { title: "Pairings" };
export const dynamic = "force-dynamic";

export default async function AdminPairingsPage() {
  const { scope } = await programPage(PERMISSIONS.PAIRING_READ);
  const semester = await getActiveSemester(scope.programId);
  const inProgram = { semester: { programId: scope.programId } };

  const [pairings, mentors, waitlisted] = await Promise.all([
    db.pairing.findMany({
      where: {
        programId: scope.programId,
        status: "ACTIVE",
        ...(semester ? { semesterId: semester.id } : {}),
      },
      include: {
        mentorProfile: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        menteeProfile: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { meetings: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.mentorProfile.findMany({
      where: {
        user: { status: "APPROVED" },
        ...inProgram,
        ...(semester ? { semesterId: semester.id } : {}),
      },
      include: {
        user: { select: { name: true } },
        pairings: { where: { status: "ACTIVE" }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.menteeProfile.findMany({
      where: {
        waitlisted: true,
        user: { status: "APPROVED" },
        ...inProgram,
        ...(semester ? { semesterId: semester.id } : {}),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { waitlistedAt: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Pairings"
        description="View, create and reassign mentor–mentee pairings; manage the waitlist."
      />
      <PairingsManager
        pairings={pairings.map((p) => ({
          id: p.id,
          mentorName: p.mentorProfile.user.name,
          menteeName: p.menteeProfile.user.name,
          menteeEmail: p.menteeProfile.user.email,
          mentorDepartment: p.mentorProfile.department,
          menteeDepartment: p.menteeProfile.department,
          matchScore: p.matchScore,
          meetings: p._count.meetings,
          createdAt: p.createdAt.toISOString(),
        }))}
        mentors={mentors.map((m) => ({
          id: m.id,
          name: m.user.name,
          department: m.department,
          capacity: m.maxMentees,
          active: m.pairings.length,
        }))}
        waitlisted={waitlisted.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          department: m.department,
        }))}
      />
    </>
  );
}
