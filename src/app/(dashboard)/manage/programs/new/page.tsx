import { signedInPage } from "@/lib/admin-pages";
import { administrativeReach, can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listActiveInstitutions } from "@/services/institutions";
import { PageHeader } from "@/components/layout/page-header";
import { ProgramWizard } from "@/components/program/program-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "New programme" };

export default async function NewProgramPage() {
  const { session, actor } = await signedInPage();
  const reach = administrativeReach(actor);
  const all = await listActiveInstitutions();
  // Institutions this user may host a programme for.
  const hostOptions = reach.platform
    ? all
    : all.filter((i) => can(actor, PERMISSIONS.PROGRAM_CREATE, { institutionId: i.id }));

  return (
    <>
      <PageHeader title="New programme" description="Set it up step by step. It stays a private draft until you publish it." />
      <ProgramWizard
        hostOptions={hostOptions.map((i) => ({ id: i.id, name: i.name }))}
        canCreatePlatform={can(actor, PERMISSIONS.PROGRAM_CREATE, {})}
        allInstitutions={all.map((i) => ({ id: i.id, name: i.name }))}
        userName={session.user.name ?? "You"}
      />
    </>
  );
}
