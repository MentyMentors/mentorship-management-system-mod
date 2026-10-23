import { describe, expect, it } from "vitest";
import {
  activeRoleInProgram,
  canActAs,
  canMentorInProgram,
  pairingScopeValid,
  type MembershipLike,
} from "@/lib/program-roles";

// Covers requirement tests 1-5 (identity/role) and 30 (pairing role scope)
// as pure logic — the same rules the DB-backed guards in src/lib/authz.ts
// enforce at the API boundary.

const PROG_A = "prog-mubas-engineering";
const PROG_B = "prog-women-in-engineering";

/** student@mubas.ac.mw: MENTEE in A, MENTOR in B — simultaneously. */
const dualRoleUser: MembershipLike[] = [
  { programId: PROG_A, role: "MENTEE", status: "ACTIVE" },
  { programId: PROG_B, role: "MENTOR", status: "ACTIVE" },
];

describe("one account, multiple programme roles", () => {
  it("user can be MENTEE in programme A and MENTOR in programme B", () => {
    expect(activeRoleInProgram(dualRoleUser, PROG_A)).toBe("MENTEE");
    expect(activeRoleInProgram(dualRoleUser, PROG_B)).toBe("MENTOR");
  });

  it("role in one programme does not leak into another", () => {
    expect(canActAs(dualRoleUser, PROG_A, "MENTOR")).toBe(false);
    expect(canActAs(dualRoleUser, PROG_B, "MENTEE")).toBe(false);
    expect(canMentorInProgram(dualRoleUser, PROG_A)).toBe(false);
    expect(canMentorInProgram(dualRoleUser, PROG_B)).toBe(true);
  });

  it("inactive or suspended memberships grant nothing", () => {
    const suspended: MembershipLike[] = [
      { programId: PROG_A, role: "MENTOR", status: "SUSPENDED" },
    ];
    expect(canMentorInProgram(suspended, PROG_A)).toBe(false);
    expect(activeRoleInProgram(suspended, PROG_A)).toBeNull();
  });

  it("no membership, no access", () => {
    expect(activeRoleInProgram([], PROG_A)).toBeNull();
  });
});

describe("pairing scope validation", () => {
  const menteeMemberships: MembershipLike[] = [
    { programId: PROG_A, role: "MENTEE", status: "ACTIVE" },
  ];

  it("allows same-programme mentor/mentee pairings", () => {
    const mentorMemberships: MembershipLike[] = [
      { programId: PROG_A, role: "MENTOR", status: "ACTIVE" },
      { programId: PROG_B, role: "MENTEE", status: "ACTIVE" }, // unrelated role elsewhere
    ];
    expect(
      pairingScopeValid({
        mentorProgramId: PROG_A,
        menteeProgramId: PROG_A,
        mentorMemberships,
        menteeMemberships,
      }).ok
    ).toBe(true);
  });

  it("rejects cross-programme pairings", () => {
    const mentorMemberships: MembershipLike[] = [
      { programId: PROG_B, role: "MENTOR", status: "ACTIVE" },
    ];
    const result = pairingScopeValid({
      mentorProgramId: PROG_B,
      menteeProgramId: PROG_A,
      mentorMemberships,
      menteeMemberships,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects mentors whose membership is in the wrong programme or role", () => {
    const wrongRole: MembershipLike[] = [
      { programId: PROG_A, role: "MENTEE", status: "ACTIVE" },
    ];
    expect(
      pairingScopeValid({
        mentorProgramId: PROG_A,
        menteeProgramId: PROG_A,
        mentorMemberships: wrongRole,
        menteeMemberships,
      }).ok
    ).toBe(false);
  });
});
