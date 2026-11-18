import { Suspense } from "react";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersTable } from "@/components/admin/users-table";

export const metadata = { title: "User management" };

export default async function AdminUsersPage() {
  await programPage(PERMISSIONS.PARTICIPANT_READ);
  return (
    <>
      <PageHeader
        title="User management"
        description="Approve, reject, filter and manage every account."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <UsersTable />
      </Suspense>
    </>
  );
}
