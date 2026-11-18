import { db } from "@/lib/db";
import { platformPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogManager } from "@/components/admin/catalog-manager";

export const metadata = { title: "Departments & programmes" };
export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  await platformPage(PERMISSIONS.CATALOG_MANAGE);
  const [departments, programmes, interests, strongModules] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.programme.findMany({ orderBy: { name: "asc" } }),
    db.interest.findMany({ orderBy: { name: "asc" } }),
    db.strongModule.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Departments & programmes"
        description="Control what mentors and mentees can pick during registration. Deactivating an item hides it from new sign-ups only — students already registered with it keep their existing record unchanged."
      />
      <CatalogManager
        departments={departments}
        programmes={programmes}
        interests={interests}
        strongModules={strongModules}
      />
    </>
  );
}
