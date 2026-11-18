import { signedInPage } from "@/lib/admin-pages";
import { can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { InstitutionRequestForm } from "@/components/institutions/institution-request-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register an institution" };

export default async function NewInstitutionPage() {
  const { session, actor } = await signedInPage();
  const direct = can(actor, PERMISSIONS.INSTITUTION_CREATE, {});
  return (
    <>
      <PageHeader
        title={direct ? "Add an institution" : "Register an institution"}
        description={
          direct
            ? "As a Menty administrator, the institution is created approved."
            : "Universities, colleges and organisations can run several programmes under one account. Menty reviews each registration; once approved you become its administrator."
        }
      />
      <InstitutionRequestForm
        direct={direct}
        defaults={{ contactName: session.user.name ?? "", contactEmail: session.user.email ?? "" }}
      />
    </>
  );
}
