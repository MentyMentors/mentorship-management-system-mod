import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadActor } from "@/lib/rbac/actor";
import {
  AuthorizationError,
  assertCan,
  type Actor,
  type ProgramRoleName,
  isParticipant,
  type ResourceScope,
} from "@/lib/rbac/authorize";
import type { Permission } from "@/lib/rbac/permissions";
import {
  getDefaultProgramScope,
  resolveProgramScope,
  type ProgramScope,
} from "@/lib/rbac/scope";

export { AuthorizationError } from "@/lib/rbac/authorize";
export { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Server-side guards for API routes, server components and server actions.
 *
 * Every sensitive operation validates, in order:
 *   1. an authenticated, approved user           (requireSession)
 *   2. the user's role assignments               (loadActor, from the DB)
 *   3. the programme / institution scope         (resolved from the DB)
 *   4. the permission for the operation          (assertCan)
 *   5. that the record belongs to that scope     (assertInProgram, per route)
 */

/**
 * Authenticated, approved session.
 *
 * `roles` filters on the LEGACY global User.role. It remains only for the
 * original mentor/mentee self-service routes until Phase 3; administrative
 * routes must use the permission guards below instead.
 */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthorizationError(401, "Authentication required");
  }
  if (session.user.status !== "APPROVED") {
    throw new AuthorizationError(403, "Account is not approved");
  }
  if (roles && !roles.includes(session.user.role)) {
    throw new AuthorizationError(403, "Insufficient permissions");
  }

  return session;
}

export interface AuthorizedContext {
  session: Session;
  actor: Actor;
}

export async function requireActor(): Promise<AuthorizedContext> {
  const session = await requireSession();
  const actor = await loadActor(session.user.id);
  return { session, actor };
}

/** Requires `permission` within an already-resolved scope. */
export async function requirePermission(
  permission: Permission,
  scope: ResourceScope = {}
): Promise<AuthorizedContext> {
  const context = await requireActor();
  assertCan(context.actor, permission, scope);
  return context;
}

/** Requires `permission` platform-wide (no institution or programme scope). */
export function requirePlatformPermission(
  permission: Permission
): Promise<AuthorizedContext> {
  return requirePermission(permission, {});
}

export interface ProgramContext extends AuthorizedContext {
  scope: ProgramScope;
}

/**
 * Requires `permission` inside one programme. `programId` may come from the
 * request; its institution is looked up here, never trusted from the client.
 */
export async function requireProgramPermission(
  permission: Permission,
  programId: string
): Promise<ProgramContext> {
  const context = await requireActor();
  const scope = await resolveProgramScope(programId);
  assertCan(context.actor, permission, scope);
  return { ...context, scope };
}

/**
 * Same as requireProgramPermission, for the original single-programme admin
 * screens: the programme is the configured default programme (the migrated
 * MUBAS programme), never a value from the request.
 */
export async function requireDefaultProgramPermission(
  permission: Permission
): Promise<ProgramContext> {
  const context = await requireActor();
  const scope = await getDefaultProgramScope();
  assertCan(context.actor, permission, scope);
  return { ...context, scope };
}

/** Requires an ACTIVE membership in the programme (optionally in a role). */
export async function requireProgramMembership(
  programId: string,
  roles?: ProgramRoleName[]
): Promise<ProgramContext> {
  const context = await requireActor();
  const scope = await resolveProgramScope(programId);
  if (!isParticipant(context.actor, scope.programId, roles)) {
    throw new AuthorizationError(403, "No active membership in this programme");
  }
  return { ...context, scope };
}

/**
 * Invalidates every session of a user. Call after changing their status,
 * role assignments or memberships so the change applies immediately.
 */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
