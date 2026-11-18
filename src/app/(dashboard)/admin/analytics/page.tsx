import { getAnalytics, getDashboardStats } from "@/services/stats";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

function BarList({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      )}
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="font-medium">{item.count}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const { scope } = await programPage(PERMISSIONS.PROGRAM_ANALYTICS_READ);
  const [analytics, stats] = await Promise.all([
    getAnalytics(scope.programId),
    getDashboardStats(scope.programId),
  ]);

  const pairingRate =
    stats.mentees > 0
      ? Math.round((stats.activePairings / stats.mentees) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Programme health for the active semester."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pairing coverage</CardTitle>
            <CardDescription>
              {stats.activePairings} of {stats.mentees} approved mentees are
              paired ({pairingRate}%). {stats.waitlisted} waitlisted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-success transition-all"
                style={{ width: `${pairingRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pairings by department</CardTitle>
            <CardDescription>Active pairings per mentee department.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={analytics.pairingsByDepartment.map((d) => ({
                label: d.department,
                count: d.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meetings per week</CardTitle>
            <CardDescription>Logged meeting activity over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={analytics.meetingsPerWeek.map((w) => ({
                label: w.week,
                count: w.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular interests</CardTitle>
            <CardDescription>
              Most common interests across mentors and mentees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={analytics.interestPopularity.map((i) => ({
                label: i.name,
                count: i.count,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
