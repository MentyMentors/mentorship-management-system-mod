import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { orNotFound } from "@/lib/admin-pages";
import { requireActor } from "@/lib/authz";
import { can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getProgramForManagement } from "@/services/programs";
import { listActiveInstitutions } from "@/services/institutions";
import { listStaff } from "@/services/staff";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { fromProgram } from "@/components/program/program-fields";
import { DEFAULT_THEME_VALUE, type ThemeValue } from "@/components/program/theme-editor";
import { ProgramSettings } from "@/components/program/program-settings";

export const dynamic = "force-dynamic";

export default async function ManageProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, actor } = await orNotFound(() => requireActor());
  const { program, scope } = await orNotFound(() => getProgramForManagement({ id: session.user.id, actor }, id));
  const [institutions, team] = await Promise.all([
    listActiveInstitutions(),
    listStaff({ scopeType: "PROGRAM", programId: program.id, institutionId: program.institutionId, name: program.name }),
  ]);

  const draft = program.themes.find((t) => t.variant === "DRAFT") ?? program.themes.find((t) => t.variant === "PUBLISHED");
  const draftTheme: ThemeValue = draft
    ? {
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        accentColor: draft.accentColor,
        backgroundColor: draft.backgroundColor,
        foregroundColor: draft.foregroundColor,
        radius: draft.radius as ThemeValue["radius"],
        appearance: draft.appearance,
      }
    : DEFAULT_THEME_VALUE;

  const transfer = program.transfers[0];
  const hostName =
    program.institution?.name ?? (program.ownerType === "PLATFORM" ? "Menty" : (program.owner?.name ?? "Independent"));

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link href="/manage"><ArrowLeft className="h-4 w-4" /> All programmes</Link>
      </Button>
      <PageHeader title={program.name} description={hostName} />
      <ProgramSettings
        program={{
          id: program.id,
          slug: program.slug,
          name: program.name,
          status: program.status,
          verificationStatus: program.verificationStatus,
          ownerType: program.ownerType,
          visibility: program.visibility,
          deliveryModel: program.deliveryModel,
          deliveryMode: program.deliveryMode,
          logoUrl: program.logoUrl,
          coverImageUrl: program.coverImageUrl,
          contactEmail: program.contactEmail,
          hostName,
          institution: program.institution,
          memberCount: program._count.memberships,
          openTransfer: transfer ? { id: transfer.id, institutionName: transfer.toInstitution.name } : null,
        }}
        form={fromProgram(program)}
        draftTheme={draftTheme}
        can={{
          update: can(actor, PERMISSIONS.PROGRAM_UPDATE, scope),
          settings: can(actor, PERMISSIONS.PROGRAM_SETTINGS_MANAGE, scope),
          branding: can(actor, PERMISSIONS.PROGRAM_BRANDING_EDIT, scope),
          publish: can(actor, PERMISSIONS.PROGRAM_PUBLISH, scope),
          archive: can(actor, PERMISSIONS.PROGRAM_ARCHIVE, scope),
          transfer: can(actor, PERMISSIONS.PROGRAM_TRANSFER, scope),
          verify: can(actor, PERMISSIONS.PROGRAM_VERIFY, scope),
          suspend: can(actor, PERMISSIONS.PROGRAM_SUSPEND, scope),
          assign: can(actor, PERMISSIONS.PROGRAM_COORDINATOR_ASSIGN, scope),
        }}
        team={{
          assignments: team.assignments,
          invites: team.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })),
        }}
        institutions={institutions.map((i) => ({ id: i.id, name: i.name }))}
        currentUserId={session.user.id}
      />
    </>
  );
}
