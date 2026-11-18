import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Handshake,
  Hourglass,
  ListChecks,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getDashboardStats } from "@/services/stats";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { scope } = await programPage(PERMISSIONS.PROGRAM_READ);
  const [stats, recentPending, waitlisted] = await Promise.all([
    getDashboardStats(scope.programId),
    db.user.findMany({
      where: {
        status: "PENDING",
        memberships: { some: { programId: scope.programId, status: "PENDING" } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.menteeProfile.findMany({
      where: {
        waitlisted: true,
        user: { status: "APPROVED" },
        semester: { programId: scope.programId },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { waitlistedAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          stats.activeSemester
            ? `Active semester: ${stats.activeSemester.name} (${formatDate(stats.activeSemester.startDate)} – ${formatDate(stats.activeSemester.endDate)})`
            : "No active semester — create one under Semesters."
        }
      >
        <Button asChild>
          <Link href="/admin/users?status=PENDING">
            <UserPlus className="h-4 w-4" /> Review approvals
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Mentors" value={stats.mentors} icon={Users} />
        <StatCard title="Mentees" value={stats.mentees} icon={Users} />
        <StatCard
          title="Active pairings"
          value={stats.activePairings}
          icon={Handshake}
        />
        <StatCard
          title="Pending approvals"
          value={stats.pendingApprovals}
          icon={Hourglass}
        />
        <StatCard
          title="Waitlisted mentees"
          value={stats.waitlisted}
          icon={ListChecks}
        />
        <StatCard
          title="Meetings logged"
          value={stats.meetingsLogged}
          icon={CalendarDays}
        />
        <StatCard
          title="Mentorship hours"
          value={Math.round(stats.totalMeetingMinutes / 60)}
          icon={Clock}
          hint="Total logged meeting time"
        />
        <StatCard
          title="Registration"
          value={stats.activeSemester?.registrationOpen ? "Open" : "Closed"}
          icon={CalendarDays}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest pending approvals</CardTitle>
            <CardDescription>
              New accounts waiting for your review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPending.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing pending — all caught up. 🎉
              </p>
            )}
            {recentPending.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="secondary">{user.role}</Badge>
              </div>
            ))}
            {recentPending.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/users?status=PENDING">View all</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waitlist</CardTitle>
            <CardDescription>
              Approved mentees still waiting for a mentor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {waitlisted.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No one is waitlisted right now.
              </p>
            )}
            {waitlisted.map((mentee) => (
              <div
                key={mentee.id}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium">{mentee.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {mentee.department}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/pairings">Assign</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
