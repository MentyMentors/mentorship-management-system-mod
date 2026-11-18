import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Server-side gate for the whole admin area: the caller must be able to read
 * the programme it manages. Individual pages and API routes check their own,
 * narrower permissions as well.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await programPage(PERMISSIONS.PROGRAM_READ);
  return <>{children}</>;
}
