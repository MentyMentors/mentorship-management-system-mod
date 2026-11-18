import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { signedInPage } from "@/lib/admin-pages";
import { administrativeReach, can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listStaff } from "@/services/staff";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DELIVERY_MODEL_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/components/program/labels";
import { InstitutionManager } from "@/components/institutions/institution-manager";
import { InstitutionPlatformActions } from "@/components/institutions/institution-platform-actions";

export const dynamic = "force-dynamic";

export default async function ManageInstitutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, actor } = await signedInPage();
  const reach = administrativeReach(actor);
  if (!reach.platform && !reach.institutionIds.includes(id)) notFound();

  const institution = await db.institution.findUnique({
    where: { id },
    include: {
      themes: { where: { variant: "PUBLISHED" } },
      programs: { orderBy: { updatedAt: "desc" }, include: { _count: { select: { memberships: true } } } },
      requestedBy: { select: { name: true, email: true } },
    },
  });
  if (!institution) notFound();

  const scope = { institutionId: id };
  const theme = institution.themes[0];
  const admins = institution.status === "ACTIVE"
    ? await listStaff({ scopeType: "INSTITUTION", institutionId: id, name: institution.name })
    : { assignments: [], invites: [] };

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link href="/manage"><ArrowLeft className="h-4 w-4" /> Programmes</Link>
      </Button>
      <PageHeader title={institution.name} description={institution.status === "PENDING_VERIFICATION" ? "Waiting for Menty to approve this registration." : undefined}>
        {institution.status === "ACTIVE" && can(actor, PERMISSIONS.PROGRAM_CREATE, scope) && (
          <Button asChild><Link href="/manage/programs/new"><Plus className="h-4 w-4" /> New programme</Link></Button>
        )}
      </PageHeader>

      {can(actor, PERMISSIONS.INSTITUTION_VERIFY, {}) && (
        <InstitutionPlatformActions
          institutionId={id}
          status={institution.status}
          verificationStatus={institution.verificationStatus}
          requester={institution.requestedBy}
          note={institution.requestNote}
        />
      )}

      {institution.status === "ACTIVE" && (
        <InstitutionManager
          institution={{
            id,
            name: institution.name,
            shortName: institution.shortName,
            websiteUrl: institution.websiteUrl,
            description: institution.description,
            logoUrl: institution.logoUrl,
            coverImageUrl: institution.coverImageUrl,
            primaryColor: theme?.primaryColor ?? "#00727a",
            secondaryColor: theme?.secondaryColor ?? "#272754",
            accentColor: theme?.accentColor ?? "#8fdd36",
          }}
          canEdit={can(actor, PERMISSIONS.INSTITUTION_UPDATE, scope)}
          canBrand={can(actor, PERMISSIONS.INSTITUTION_BRANDING_EDIT, scope)}
          canAssign={can(actor, PERMISSIONS.ROLE_ASSIGN, scope)}
          admins={{ assignments: admins.assignments, invites: admins.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })) }}
          currentUserId={session.user.id}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Programmes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {institution.programs.length === 0 && <p className="text-sm text-muted-foreground">No programmes yet.</p>}
          {institution.programs.map((p) => (
            <Link key={p.id} href={`/manage/programs/${p.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{DELIVERY_MODEL_LABEL[p.deliveryModel]} · {p._count.memberships} participants</p>
              </div>
              <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
