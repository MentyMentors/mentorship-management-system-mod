import Link from "next/link";
import { BadgeCheck, Building2, Plus, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { signedInPage } from "@/lib/admin-pages";
import { can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listManagedPrograms, incomingTransfers } from "@/services/programs";
import { listManagedInstitutions, myInstitutionRequests } from "@/services/institutions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DELIVERY_MODEL_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/components/program/labels";
import { TransferDecision } from "@/components/program/transfer-decision";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programmes" };

export default async function ManagePage() {
  const { session, actor } = await signedInPage();
  const isPlatform = can(actor, PERMISSIONS.INSTITUTION_VERIFY, {});
  const [programs, institutions, requests, transfers, pendingCounts] = await Promise.all([
    listManagedPrograms(actor),
    listManagedInstitutions(actor),
    myInstitutionRequests(session.user.id),
    incomingTransfers(actor),
    isPlatform
      ? Promise.all([
          db.institution.count({ where: { status: "PENDING_VERIFICATION", verificationStatus: "PENDING" } }),
          db.mentorshipProgram.count({ where: { verificationStatus: "PENDING" } }),
        ])
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Programmes" description="Create and run mentorship programmes on Menty.">
        <Button variant="outline" asChild>
          <Link href="/manage/institutions/new"><Building2 className="h-4 w-4" /> Register an institution</Link>
        </Button>
        <Button asChild>
          <Link href="/manage/programs/new"><Plus className="h-4 w-4" /> New programme</Link>
        </Button>
      </PageHeader>

      {pendingCounts && (pendingCounts[0] > 0 || pendingCounts[1] > 0) && (
        <Card className="border-warning/50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" />
              {pendingCounts[0]} institution request(s) and {pendingCounts[1]} programme verification(s) waiting.
            </p>
            <Button size="sm" asChild><Link href="/manage/verification">Review</Link></Button>
          </CardContent>
        </Card>
      )}

      {transfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programmes asking to join your institution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {transfers.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{t.program.name}</p>
                  <p className="text-xs text-muted-foreground">
                    To {t.toInstitution.name}
                    {t.note ? ` · “${t.note}”` : ""}
                  </p>
                </div>
                <TransferDecision transferId={t.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Programmes you manage</h2>
        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">You are not running any programmes yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lecturers, organisations and student groups can start an independent programme in a few minutes.
              </p>
              <Button className="mt-4" asChild><Link href="/manage/programs/new">Create a programme</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {programs.map((p) => (
              <Link key={p.id} href={`/manage/programs/${p.id}`}>
                <Card className="h-full transition hover:shadow-glass-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1">
                      {p.institution?.shortName ?? p.institution?.name ?? (p.ownerType === "PLATFORM" ? "Menty" : "Independent")}
                      {p.verificationStatus === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {DELIVERY_MODEL_LABEL[p.deliveryModel]} · {p._count.memberships} participant{p._count.memberships === 1 ? "" : "s"}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {(institutions.length > 0 || requests.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Institutions</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {institutions.map((i) => (
              <Link key={i.id} href={`/manage/institutions/${i.id}`}>
                <Card className="h-full transition hover:shadow-glass-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{i.name}</CardTitle>
                      <Badge variant={i.status === "ACTIVE" ? "success" : i.status === "SUSPENDED" ? "destructive" : "warning"}>
                        {i.status === "PENDING_VERIFICATION" ? "Awaiting approval" : i.status === "ACTIVE" ? "Active" : "Suspended"}
                      </Badge>
                    </div>
                    <CardDescription>{i._count.programs} programme{i._count.programs === 1 ? "" : "s"}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {requests
              .filter((r) => !institutions.some((i) => i.id === r.id))
              .map((r) => (
                <Card key={r.id} className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <CardDescription>
                      {r.verificationStatus === "REJECTED" ? "Registration not approved" : "Waiting for Menty to approve"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </section>
      )}
    </>
  );
}
