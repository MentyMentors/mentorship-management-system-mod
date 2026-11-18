import Link from "next/link";
import { db } from "@/lib/db";
import { platformPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstitutionPlatformActions } from "@/components/institutions/institution-platform-actions";
import { ProgramVerifyButtons } from "@/components/program/program-verify-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };

export default async function VerificationPage() {
  await platformPage(PERMISSIONS.INSTITUTION_VERIFY);
  const [institutions, programs] = await Promise.all([
    db.institution.findMany({
      where: { status: "PENDING_VERIFICATION", verificationStatus: "PENDING" },
      include: { requestedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.mentorshipProgram.findMany({
      where: { verificationStatus: "PENDING" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader title="Verification" description="Institution registrations and programmes asking to be verified by Menty." />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Institution requests</h2>
        {institutions.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        {institutions.map((i) => (
          <div key={i.id} className="space-y-2">
            <p className="font-medium">
              <Link href={`/manage/institutions/${i.id}`} className="hover:underline">{i.name}</Link>
              {i.websiteUrl && <span className="ml-2 text-sm text-muted-foreground">{i.websiteUrl}</span>}
            </p>
            <InstitutionPlatformActions institutionId={i.id} status={i.status} verificationStatus={i.verificationStatus} requester={i.requestedBy} note={i.requestNote} />
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Programmes</h2>
        {programs.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        {programs.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <Link href={`/manage/programs/${p.id}`} className="hover:underline">{p.name}</Link>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {p.owner ? `${p.owner.name} (${p.owner.email})` : "—"} · <Link href={`/p/${p.slug}?preview=1`} className="underline">preview</Link>
              </p>
            </CardHeader>
            <CardContent><ProgramVerifyButtons programId={p.id} /></CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
