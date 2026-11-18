import { notFound, redirect } from "next/navigation";
import {
  AuthorizationError,
  requireDefaultProgramPermission,
  requirePlatformPermission,
  type AuthorizedContext,
  type ProgramContext,
} from "@/lib/authz";
import type { Permission } from "@/lib/rbac/permissions";

/**
 * Page-level guards for the admin dashboard (server components). Hiding a
 * link is a convenience; these checks are the control. A user without the
 * permission gets a 404, so the page's existence is not disclosed.
 */
async function guard<T>(check: () => Promise<T>): Promise<T> {
  try {
    return await check();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.status === 401) redirect("/login");
      notFound();
    }
    throw error;
  }
}

/** Page operating on the default (migrated) programme. */
export function programPage(permission: Permission): Promise<ProgramContext> {
  return guard(() => requireDefaultProgramPermission(permission));
}

/** Platform administration page. */
export function platformPage(permission: Permission): Promise<AuthorizedContext> {
  return guard(() => requirePlatformPermission(permission));
}
