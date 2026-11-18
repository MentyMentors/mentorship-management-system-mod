import { platformPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogTable } from "@/components/admin/audit-log-table";

export const metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  await platformPage(PERMISSIONS.PLATFORM_AUDIT_READ);
  return (
    <>
      <PageHeader
        title="Audit log"
        description="A record of admin actions across the platform."
      />
      <AuditLogTable />
    </>
  );
}
