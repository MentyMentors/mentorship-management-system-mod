import Link from "next/link";
import { Bell, CalendarDays, Compass, Handshake, Megaphone, Plus } from "lucide-react";
import { signedInPage } from "@/lib/admin-pages";
import { getUnifiedDashboard } from "@/services/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramSwitcher } from "@/components/dashboard/program-switcher";
import { MEMBERSHIP_STATUS_LABEL, MEMBERSHIP_STATUS_VARIANT, ROLE_LABEL } from "@/components/dashboard/membership-labels";
import { STATUS_LABEL } from "@/components/program/labels";
import { normaliseHex } from "@/lib/theme/tokens";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My dashboard" };

export default async function UnifiedDashboardPage() {
  const { session, actor } = await signedInPage();
  const d = await getUnifiedDashboard(session.user.id, actor);
  const pending = d.programs.filter((p) => p.roles.some((r) => r.status === "PENDING" || r.status === "WAITLISTED"));

  return (
    <>
      <PageHeader title={`Hi, ${session.user.name?.split(" ")[0] ?? "there"}`} description="Everything across your programmes.">
        <ProgramSwitcher programs={d.programs.map((p) => ({ id: p.program.id, name: p.program.name }))} />
        <Button variant="outline" asChild><Link href="/programs"><Compass className="h-4 w-4" /> Find programmes</Link></Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 py-5"><Handshake className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{d.programs.length}</p><p className="text-xs text-muted-foreground">Programmes</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-5"><CalendarDays className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{d.upcomingMeetings.length}</p><p className="text-xs text-muted-foreground">Upcoming meetings</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-5"><Bell className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{d.unread}</p><p className="text-xs text-muted-foreground">Unread notifications</p></div></CardContent></Card>
      </div>

      {pending.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader><CardTitle className="text-base">Pending registrations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pending.map((p) => (
              <p key={p.program.id}>
                <Link href={`/dashboard/programs/${p.program.id}`} className="font-medium underline">{p.program.name}</Link>{" "}
                — {p.roles.map((r) => `${ROLE_LABEL[r.role]}: ${MEMBERSHIP_STATUS_LABEL[r.status].toLowerCase()}`).join(", ")}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My programmes</h2>
        {d.programs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">You haven&apos;t joined a programme yet.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild><Link href="/find-a-mentor">Find a mentor</Link></Button>
                <Button variant="outline" asChild><Link href="/programs">Browse programmes</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {d.programs.map(({ program, roles }) => (
              <Link key={program.id} href={`/dashboard/programs/${program.id}`}>
                <Card className="h-full overflow-hidden transition hover:shadow-glass-lg">
                  <div className="h-1.5" style={{ background: normaliseHex(program.themes[0]?.primaryColor ?? "") ?? "#00727a" }} />
                  <CardHeader>
                    <CardTitle className="text-base">{program.name}</CardTitle>
                    <CardDescription>
                      {program.institution?.name ?? (program.ownerType === "PLATFORM" ? "Menty" : "Independent")} · {STATUS_LABEL[program.status]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {roles.map((r) => (
                      <Badge key={r.id} variant={MEMBERSHIP_STATUS_VARIANT[r.status]}>
                        {ROLE_LABEL[r.role]}{r.status !== "ACTIVE" ? ` · ${MEMBERSHIP_STATUS_LABEL[r.status]}` : ""}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4" /> Mentorship relationships</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.relationships.length === 0 && <p className="text-muted-foreground">No active mentor or mentee yet.</p>}
            {d.relationships.map((r) => (
              <p key={r.id}>
                Your {r.kind}: <strong>{r.person.name}</strong> <a className="text-primary underline" href={`mailto:${r.person.email}`}>{r.person.email}</a>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Upcoming</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.upcomingMeetings.length === 0 && <p className="text-muted-foreground">Nothing scheduled. Programme sessions will appear here too.</p>}
            {d.upcomingMeetings.map((m) => (
              <p key={m.id}>
                {formatDateTime(m.date)} — {m.topics}
                {m.program && <span className="text-muted-foreground"> · {m.program.name}</span>}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" /> Announcements</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {d.announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements.</p>}
          {d.announcements.map((a) => (
            <div key={a.id} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.program?.name ?? "Menty"} · {formatDateTime(a.createdAt)}</p>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{a.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {d.managed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programmes you run</CardTitle>
            <CardDescription>{d.managed.length} programme{d.managed.length === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" asChild><Link href="/manage">Open programme management</Link></Button></CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-between gap-3 py-5 sm:flex-row">
            <p className="text-sm text-muted-foreground">Running a mentorship initiative? Host it on Menty.</p>
            <Button variant="outline" size="sm" asChild><Link href="/manage/programs/new"><Plus className="h-4 w-4" /> Start a programme</Link></Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
