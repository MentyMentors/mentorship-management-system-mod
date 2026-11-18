import type { Permission, ScopeType } from "./permissions";

/**
 * Pure authorisation rules. No database access, so every rule is unit tested
 * (tests/unit/rbac.test.ts). Adapted from UniSpace's lib/rbac/authorize.ts,
 * with Menty's scopes: PLATFORM > INSTITUTION > PROGRAM.
 */

export type ProgramRoleName =
  | "MENTOR"
  | "MENTEE"
  | "PRESENTER"
  | "FACILITATOR"
  | "PARTICIPANT";

export interface ActorAssignment {
  roleKey: string;
  scopeType: ScopeType;
  institutionId: string | null;
  programId: string | null;
  permissions: readonly string[];
}

export interface ActorMembership {
  programId: string;
  role: ProgramRoleName;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED" | "REJECTED" | "WAITLISTED" | "WITHDRAWN";
}

export interface Actor {
  id: string;
  assignments: ActorAssignment[];
  memberships: ActorMembership[];
}

/**
 * The resource an action targets. Must be resolved from the database
 * (src/lib/rbac/scope.ts), never taken from the request: `institutionId` is
 * the institution that actually owns `programId`, or null for independent
 * and platform programmes.
 */
export interface ResourceScope {
  institutionId?: string | null;
  programId?: string | null;
}

export class AuthorizationError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * A business-rule failure with an HTTP status (409 conflict, 422 invalid...).
 * Subclass of AuthorizationError so errorResponse() renders it the same way.
 */
export class RequestError extends AuthorizationError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "RequestError";
  }
}

function assignmentCoversScope(
  assignment: ActorAssignment,
  scope: ResourceScope
): boolean {
  switch (assignment.scopeType) {
    case "PLATFORM":
      return true;

    case "INSTITUTION":
      // Covers the institution itself and programmes it owns. Programmes
      // without an institution (independent, platform) are out of reach.
      if (!assignment.institutionId) return false;
      return (
        Boolean(scope.institutionId) &&
        scope.institutionId === assignment.institutionId
      );

    case "PROGRAM":
      // Covers exactly one programme — not its institution, not siblings.
      if (!assignment.programId) return false;
      return Boolean(scope.programId) && scope.programId === assignment.programId;

    default:
      return false;
  }
}

/** True when the actor holds `permission` for the given resource scope. */
export function can(
  actor: Actor | null | undefined,
  permission: Permission,
  scope: ResourceScope = {}
): boolean {
  if (!actor) return false;
  return actor.assignments.some(
    (assignment) =>
      assignment.permissions.includes(permission) &&
      assignmentCoversScope(assignment, scope)
  );
}

/** Throws a 403 AuthorizationError unless `can` passes. */
export function assertCan(
  actor: Actor | null | undefined,
  permission: Permission,
  scope: ResourceScope = {}
): asserts actor is Actor {
  if (!can(actor, permission, scope)) {
    throw new AuthorizationError(403, "Insufficient permissions");
  }
}

export function canAny(
  actor: Actor | null | undefined,
  permissions: Permission[],
  scope: ResourceScope = {}
): boolean {
  return permissions.some((p) => can(actor, p, scope));
}

/** True when the actor holds the permission at platform scope. */
export function isPlatformWide(
  actor: Actor | null | undefined,
  permission: Permission
): boolean {
  if (!actor) return false;
  return actor.assignments.some(
    (a) => a.scopeType === "PLATFORM" && a.permissions.includes(permission)
  );
}

/**
 * Which programmes / institutions the actor may see administratively.
 * Used to filter dashboard lists; every action still checks `can`.
 */
export function administrativeReach(actor: Actor | null | undefined): {
  platform: boolean;
  institutionIds: string[];
  programIds: string[];
} {
  if (!actor) return { platform: false, institutionIds: [], programIds: [] };
  const institutionIds = new Set<string>();
  const programIds = new Set<string>();
  let platform = false;
  for (const a of actor.assignments) {
    if (a.scopeType === "PLATFORM") platform = true;
    if (a.institutionId) institutionIds.add(a.institutionId);
    if (a.programId) programIds.add(a.programId);
  }
  return {
    platform,
    institutionIds: [...institutionIds],
    programIds: [...programIds],
  };
}

/** Active participant roles the actor holds in one programme. */
export function activeProgramRoles(
  actor: Actor | null | undefined,
  programId: string
): ProgramRoleName[] {
  if (!actor) return [];
  return actor.memberships
    .filter((m) => m.programId === programId && m.status === "ACTIVE")
    .map((m) => m.role);
}

/**
 * Participant check: an ACTIVE membership in this programme, optionally in
 * one of the given roles. A role held in another programme grants nothing.
 */
export function isParticipant(
  actor: Actor | null | undefined,
  programId: string,
  roles?: ProgramRoleName[]
): boolean {
  const held = activeProgramRoles(actor, programId);
  if (held.length === 0) return false;
  return roles ? held.some((r) => roles.includes(r)) : true;
}

/**
 * Escalation guard: an actor may grant a role only if they hold `role.assign`
 * in the target scope AND already hold every permission the role carries in
 * that scope. Nobody can promote themselves or others above their own reach.
 */
export function canGrantRole(
  actor: Actor | null | undefined,
  role: {
    key: string;
    isSystem: boolean;
    permissions: readonly string[];
    allowedScopes: readonly ScopeType[];
  },
  target: { scopeType: ScopeType } & ResourceScope
): boolean {
  if (!actor) return false;
  if (!role.allowedScopes.includes(target.scopeType)) return false;
  const scope: ResourceScope = {
    institutionId: target.institutionId ?? null,
    programId: target.programId ?? null,
  };
  if (target.scopeType === "PLATFORM") {
    // Only someone who already holds every permission platform-wide.
    return role.permissions.every((p) => isPlatformWide(actor, p as Permission));
  }
  if (!can(actor, "role.assign", scope)) return false;
  // Appointing programme staff is its own permission: an Institution Admin
  // appoints coordinators without running the programme themselves.
  if (
    target.scopeType === "PROGRAM" &&
    role.isSystem &&
    PROGRAM_STAFF_ROLE_KEYS.has(role.key) &&
    can(actor, "program.coordinator.assign", scope)
  ) {
    return true;
  }
  return role.permissions.every((p) => can(actor, p as Permission, scope));
}

const PROGRAM_STAFF_ROLE_KEYS = new Set(["program_coordinator", "program_assistant"]);
