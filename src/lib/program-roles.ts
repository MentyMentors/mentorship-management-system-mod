/**
 * Pure helpers that answer "what is this user's relationship to THIS
 * programme?" — the heart of the one-account / many-programme-roles rule.
 * Free of database access so they are trivially unit-testable.
 *
 * A user may hold several roles in one programme (for example MENTOR and
 * PRESENTER), and unrelated roles in other programmes. Each helper here only
 * ever looks at one programme.
 */

export type ProgramRole =
  | "MENTOR"
  | "MENTEE"
  | "PRESENTER"
  | "FACILITATOR"
  | "PARTICIPANT";

export interface MembershipLike {
  programId: string;
  role: ProgramRole;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REMOVED" | "REJECTED" | "WAITLISTED" | "WITHDRAWN";
}

/** Every ACTIVE role the user holds in one programme (empty when none). */
export function activeRolesInProgram(
  memberships: MembershipLike[],
  programId: string
): ProgramRole[] {
  return memberships
    .filter((m) => m.programId === programId && m.status === "ACTIVE")
    .map((m) => m.role);
}

/** True when the user participates (in ANY role) in the programme. */
export function isActiveMember(
  memberships: MembershipLike[],
  programId: string
): boolean {
  return activeRolesInProgram(memberships, programId).length > 0;
}

/**
 * Whether the user may act as `role` inside `programId`. Being MENTOR
 * elsewhere grants nothing here.
 */
export function canActAs(
  memberships: MembershipLike[],
  programId: string,
  role: ProgramRole
): boolean {
  return activeRolesInProgram(memberships, programId).includes(role);
}

/**
 * Pairing eligibility: a mentor candidate must hold an ACTIVE MENTOR
 * membership in the SAME programme as the mentee.
 */
export function canMentorInProgram(
  memberships: MembershipLike[],
  programId: string
): boolean {
  return canActAs(memberships, programId, "MENTOR");
}

/**
 * Validates that both sides of a proposed pairing belong to the same
 * programme scope. Pairing callers run this BEFORE any write.
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
