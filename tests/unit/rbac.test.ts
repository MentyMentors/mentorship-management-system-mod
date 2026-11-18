import { describe, expect, it } from "vitest";
import {
  administrativeReach,
  assertCan,
  can,
  canGrantRole,
  isParticipant,
  type Actor,
  type ActorAssignment,
} from "@/lib/rbac/authorize";
import {
  ALL_PERMISSIONS,
  PERMISSIONS as P,
  SYSTEM_ROLES,
  permissionsForRole,
} from "@/lib/rbac/permissions";

// Tenants used throughout.
const MUBAS = "inst_mubas";
const UNIMA = "inst_unima";
const ENG = { programId: "prog_eng", institutionId: MUBAS }; // MUBAS programme
const WIS = { programId: "prog_wis", institutionId: MUBAS }; // sibling MUBAS programme
const UNIMA_AI = { programId: "prog_ai", institutionId: UNIMA };
const INDEPENDENT = { programId: "prog_indep", institutionId: null };

function assignment(
  role: keyof typeof SYSTEM_ROLES,
  scope: Partial<Pick<ActorAssignment, "institutionId" | "programId">> = {}
): ActorAssignment {
  const def = SYSTEM_ROLES[role];
  const scopeType = def.allowedScopes[0];
  return {
    roleKey: def.key,
    scopeType,
    institutionId: scope.institutionId ?? null,
    programId: scope.programId ?? null,
    permissions: [...def.permissions],
  };
}

function actor(
  assignments: ActorAssignment[],
  memberships: Actor["memberships"] = []
): Actor {
  return { id: "u", assignments, memberships };
}

const superAdmin = actor([assignment("SUPER_ADMIN")]);
const mubasAdmin = actor([assignment("INSTITUTION_ADMIN", { institutionId: MUBAS })]);
const engCoordinator = actor([assignment("PROGRAM_COORDINATOR", { programId: ENG.programId })]);
const engAssistant = actor([assignment("PROGRAM_ASSISTANT", { programId: ENG.programId })]);

const roleDef = (role: keyof typeof SYSTEM_ROLES) => ({
  key: SYSTEM_ROLES[role].key,
  isSystem: true,
  permissions: [...SYSTEM_ROLES[role].permissions],
  allowedScopes: [...SYSTEM_ROLES[role].allowedScopes],
});

describe("super admin", () => {
  it("can do everything everywhere", () => {
    for (const scope of [ENG, WIS, UNIMA_AI, INDEPENDENT, {}]) {
      expect(can(superAdmin, P.PAIRING_MANAGE, scope)).toBe(true);
      expect(can(superAdmin, P.PLATFORM_SETTINGS_MANAGE, scope)).toBe(true);
    }
  });
});

describe("institution admin (AC 22)", () => {
  it("manages programmes of their own institution", () => {
    expect(can(mubasAdmin, P.PROGRAM_UPDATE, ENG)).toBe(true);
    expect(can(mubasAdmin, P.PROGRAM_COORDINATOR_ASSIGN, WIS)).toBe(true);
    expect(can(mubasAdmin, P.PROGRAM_CREATE, { institutionId: MUBAS })).toBe(true);
  });

  it("cannot reach another institution or independent programmes", () => {
    expect(can(mubasAdmin, P.PROGRAM_READ, UNIMA_AI)).toBe(false);
    expect(can(mubasAdmin, P.PROGRAM_CREATE, { institutionId: UNIMA })).toBe(false);
    expect(can(mubasAdmin, P.PROGRAM_READ, INDEPENDENT)).toBe(false);
  });

  it("cannot reach platform administration (vertical escalation)", () => {
    for (const p of [
      P.PLATFORM_SETTINGS_MANAGE,
      P.ROLE_MANAGE,
      P.INSTITUTION_VERIFY,
      P.INSTITUTION_CREATE,
      P.USER_READ,
      P.CATALOG_MANAGE,
    ]) {
      expect(can(mubasAdmin, p, { institutionId: MUBAS })).toBe(false);
      expect(can(mubasAdmin, p, {})).toBe(false);
    }
  });

  it("oversees but does not run programmes by default", () => {
    expect(can(mubasAdmin, P.PAIRING_READ, ENG)).toBe(true);
    expect(can(mubasAdmin, P.PAIRING_MANAGE, ENG)).toBe(false);
    expect(can(mubasAdmin, P.EMAIL_SEND, ENG)).toBe(false);
  });

  it("is ignored when the scope omits the institution", () => {
    // A caller that forgot to resolve the institution gets nothing.
    expect(can(mubasAdmin, P.PROGRAM_READ, { programId: ENG.programId })).toBe(false);
  });
});

describe("programme coordinator (AC 23)", () => {
  it("runs their own programme", () => {
    for (const p of [P.PAIRING_MANAGE, P.EMAIL_SEND, P.COHORT_MANAGE, P.PROGRAM_BRANDING_EDIT]) {
      expect(can(engCoordinator, p, ENG)).toBe(true);
    }
  });

  it("cannot touch a sibling programme in the same institution", () => {
    expect(can(engCoordinator, P.PROGRAM_READ, WIS)).toBe(false);
    expect(can(engCoordinator, P.PAIRING_MANAGE, WIS)).toBe(false);
  });

  it("cannot touch another institution's programme", () => {
    expect(can(engCoordinator, P.PROGRAM_READ, UNIMA_AI)).toBe(false);
  });

  it("gets nothing at institution or platform level", () => {
    expect(can(engCoordinator, P.INSTITUTION_UPDATE, { institutionId: MUBAS })).toBe(false);
    expect(can(engCoordinator, P.PROGRAM_CREATE, { institutionId: MUBAS })).toBe(false);
    expect(can(engCoordinator, P.CATALOG_MANAGE, {})).toBe(false);
    expect(can(engCoordinator, P.PROGRAM_VERIFY, ENG)).toBe(false);
    expect(can(engCoordinator, P.PROGRAM_SUSPEND, ENG)).toBe(false);
  });

  it("assertCan throws a 403", () => {
    expect(() => assertCan(engCoordinator, P.PROGRAM_READ, WIS)).toThrowError(
      expect.objectContaining({ status: 403 })
    );
  });
});

describe("assistant", () => {
  it("helps without changing settings", () => {
    expect(can(engAssistant, P.REGISTRATION_REVIEW, ENG)).toBe(true);
    expect(can(engAssistant, P.PROGRAM_SETTINGS_MANAGE, ENG)).toBe(false);
    expect(can(engAssistant, P.PAIRING_MANAGE, ENG)).toBe(false);
  });
});

describe("one account, many roles (AC 8, 9)", () => {
  const multi = actor(
    [assignment("PROGRAM_COORDINATOR", { programId: WIS.programId })],
    [
      { programId: ENG.programId, role: "MENTEE", status: "ACTIVE" },
      { programId: UNIMA_AI.programId, role: "MENTOR", status: "ACTIVE" },
    ]
  );

  it("coordinating one programme grants nothing in the others", () => {
    expect(can(multi, P.PARTICIPANT_READ, WIS)).toBe(true);
    expect(can(multi, P.PARTICIPANT_READ, ENG)).toBe(false);
    expect(can(multi, P.PARTICIPANT_READ, UNIMA_AI)).toBe(false);
  });

  it("participant roles are per programme", () => {
    expect(isParticipant(multi, ENG.programId, ["MENTEE"])).toBe(true);
    expect(isParticipant(multi, ENG.programId, ["MENTOR"])).toBe(false);
    expect(isParticipant(multi, UNIMA_AI.programId, ["MENTOR"])).toBe(true);
    expect(isParticipant(multi, WIS.programId)).toBe(false);
  });

  it("memberships never confer administrative permissions", () => {
    expect(can(multi, P.PAIRING_READ, ENG)).toBe(false);
  });

  it("non-active memberships grant nothing", () => {
    const pending = actor([], [{ programId: ENG.programId, role: "MENTOR", status: "PENDING" }]);
    expect(isParticipant(pending, ENG.programId)).toBe(false);
  });
});

describe("role grants (privilege escalation)", () => {
  it("a coordinator may appoint a co-coordinator in their programme only", () => {
    expect(canGrantRole(engCoordinator, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PROGRAM", ...ENG })).toBe(true);
    expect(canGrantRole(engCoordinator, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PROGRAM", ...WIS })).toBe(false);
  });

  it("a coordinator cannot grant institution or platform roles", () => {
    expect(canGrantRole(engCoordinator, roleDef("INSTITUTION_ADMIN"), { scopeType: "INSTITUTION", institutionId: MUBAS })).toBe(false);
    expect(canGrantRole(engCoordinator, roleDef("SUPER_ADMIN"), { scopeType: "PLATFORM" })).toBe(false);
  });

  it("an institution admin appoints coordinators inside the institution only", () => {
    expect(canGrantRole(mubasAdmin, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PROGRAM", ...ENG })).toBe(true);
    expect(canGrantRole(mubasAdmin, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PROGRAM", ...UNIMA_AI })).toBe(false);
    expect(canGrantRole(mubasAdmin, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PROGRAM", ...INDEPENDENT })).toBe(false);
  });

  it("an institution admin may add a peer for their own institution, never above it", () => {
    expect(canGrantRole(mubasAdmin, roleDef("INSTITUTION_ADMIN"), { scopeType: "INSTITUTION", institutionId: MUBAS })).toBe(true);
    expect(canGrantRole(mubasAdmin, roleDef("INSTITUTION_ADMIN"), { scopeType: "INSTITUTION", institutionId: UNIMA })).toBe(false);
    expect(canGrantRole(mubasAdmin, roleDef("SUPER_ADMIN"), { scopeType: "PLATFORM" })).toBe(false);
  });

  it("an assistant cannot appoint anyone", () => {
    expect(canGrantRole(engAssistant, roleDef("PROGRAM_ASSISTANT"), { scopeType: "PROGRAM", ...ENG })).toBe(false);
  });

  it("roles can only be granted at their allowed scope", () => {
    expect(canGrantRole(superAdmin, roleDef("PROGRAM_COORDINATOR"), { scopeType: "PLATFORM" })).toBe(false);
    expect(canGrantRole(superAdmin, roleDef("SUPER_ADMIN"), { scopeType: "PLATFORM" })).toBe(true);
  });

  it("a custom role carrying more than the granter holds is refused", () => {
    const custom = { key: "custom", isSystem: false, allowedScopes: ["PROGRAM" as const], permissions: [P.PAIRING_MANAGE, P.PROGRAM_VERIFY] };
    expect(canGrantRole(engCoordinator, custom, { scopeType: "PROGRAM", ...ENG })).toBe(false);
  });
});

describe("reach and role definitions", () => {
  it("reports administrative reach for dashboard filtering", () => {
    expect(administrativeReach(engCoordinator)).toEqual({ platform: false, institutionIds: [], programIds: [ENG.programId] });
    expect(administrativeReach(superAdmin).platform).toBe(true);
    expect(administrativeReach(null).platform).toBe(false);
  });

  it("system roles use the code-side permission list, not the stored one", () => {
    expect(permissionsForRole({ key: "super_admin", isSystem: true, permissions: [] })).toEqual(ALL_PERMISSIONS);
  });

  it("custom roles drop unknown permission keys", () => {
    expect(permissionsForRole({ key: "x", isSystem: false, permissions: ["pairing.read", "made.up"] })).toEqual(["pairing.read"]);
  });

  it("no actor, no access", () => {
    expect(can(null, P.PROGRAM_READ, ENG)).toBe(false);
  });
});
