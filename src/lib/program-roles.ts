/**
 * Pure helpers that answer "what is this user's relationship to THIS
 * programme?" — the heart of the one-account / many-programme-roles rule.
 * Kept free of database access so they are trivially unit-testable.
 */

export type ProgramRole = "MENTOR" | "MENTEE";

export interface MembershipLike {
  programId: string;
  role: ProgramRole;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

/**
 * The user's ACTIVE role in one programme, or null when they are not an
 * active member. A user may be MENTOR in programme A and MENTEE in
 * programme B at the same time; each call here only ever sees one scope.
 */
export function activeRoleInProgram(
  memberships: MembershipLike[],
  programId: string
): ProgramRole | null {
  const match = memberships.find(
    (m) => m.programId === programId && m.status === "ACTIVE"
  );
  return match ? match.role : null;
}

/** True when the user participates (in ANY role) in the programme. */
export function isActiveMember(
  memberships: MembershipLike[],
  programId: string
): boolean {
  return activeRoleInProgram(memberships, programId) !== null;
}

/**
 * Whether the user may act as `role` inside `programId`. Deliberately
 * scope-scoped: being MENTOR elsewhere grants nothing here.
 */
export function canActAs(
  memberships: MembershipLike[],
  programId: string,
  role: ProgramRole
): boolean {
  return activeRoleInProgram(memberships, programId) === role;
}

/**
 * Pairing eligibility: a mentor candidate must hold an ACTIVE MENTOR
 * membership in the SAME programme the mentee cohort belongs to. The
 * mentor's role in any other programme is irrelevant — this is the check
 * that prevents cross-programme leakage by construction.
 */
export function canMentorInProgram(
  memberships: MembershipLike[],
  programId: string
): boolean {
  return canActAs(memberships, programId, "MENTOR");
}

/**
 * Validates that both sides of a proposed pairing belong to the same
 * programme scope. pairingEngine callers run this BEFORE any write.
 */
export function pairingScopeValid(input: {
  mentorProgramId: string;
  menteeProgramId: string;
  mentorMemberships: MembershipLike[];
  menteeMemberships: MembershipLike[];
}): { ok: true } | { ok: false; reason: string } {
  if (input.mentorProgramId !== input.menteeProgramId) {
    return { ok: false, reason: "cross-programme pairing is not permitted" };
  }
  if (!canMentorInProgram(input.mentorMemberships, input.mentorProgramId)) {
    return { ok: false, reason: "mentor has no active mentor membership in this programme" };
  }
  if (!canActAs(input.menteeMemberships, input.menteeProgramId, "MENTEE")) {
    return { ok: false, reason: "mentee has no active mentee membership in this programme" };
  }
  return { ok: true };
}
