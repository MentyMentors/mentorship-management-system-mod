import { describe, expect, it } from "vitest";
import {
  checkEligibility,
  decisionAllowed,
  initialStatus,
  registrationWindow,
  selfServiceRoles,
} from "@/lib/join-rules";
import { safeNextPath } from "@/lib/safe-path";

describe("self-service roles", () => {
  it("presenter-led programmes only take participants (no pairing, AC 8 non-negotiable)", () => {
    expect(selfServiceRoles("PRESENTER_LED")).toEqual(["PARTICIPANT"]);
  });
  it("one-to-one takes mentees and mentors; hybrid takes participants and mentors", () => {
    expect(selfServiceRoles("ONE_TO_ONE")).toEqual(["MENTEE", "MENTOR"]);
    expect(selfServiceRoles("HYBRID")).toEqual(["PARTICIPANT", "MENTOR"]);
  });
  it("presenters are never self-registered", () => {
    for (const m of ["PRESENTER_LED", "ONE_TO_ONE", "HYBRID"] as const) {
      expect(selfServiceRoles(m)).not.toContain("PRESENTER");
    }
  });
});

describe("eligibility (AC 4: cross-institution by default)", () => {
  it("open programmes accept anyone from any institution", () => {
    expect(checkEligibility({ mode: "OPEN" }, { institutionIds: [] })).toEqual({ eligible: true, needsReview: false });
    expect(checkEligibility(null, { institutionIds: ["unima"] }).eligible).toBe(true);
  });
  it("institution-specific programmes check affiliation", () => {
    const rule = { mode: "INSTITUTIONS" as const, institutionIds: ["mubas", "must"] };
    expect(checkEligibility(rule, { institutionIds: ["must"] })).toEqual({ eligible: true, needsReview: false });
    const r = checkEligibility(rule, { institutionIds: ["unima"] }, { mubas: "MUBAS", must: "MUST" });
    expect(r.eligible).toBe(false);
    expect(!r.eligible && r.message).toContain("MUBAS, MUST");
  });
  it("criteria Menty cannot verify are always reviewed", () => {
    for (const mode of ["DEPARTMENTS", "YEARS_OF_STUDY", "CUSTOM"] as const) {
      const r = checkEligibility({ mode }, { institutionIds: [] });
      expect(r.eligible && r.needsReview).toBe(true);
    }
  });
  it("invite-only refuses self-registration", () => {
    expect(checkEligibility({ mode: "INVITE_ONLY" }, { institutionIds: [] }).eligible).toBe(false);
  });
});

describe("registration window", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  it("needs a published or running programme", () => {
    expect(registrationWindow({ status: "DRAFT", registrationOpensAt: null, registrationClosesAt: null }, now).open).toBe(false);
    expect(registrationWindow({ status: "PAUSED", registrationOpensAt: null, registrationClosesAt: null }, now).open).toBe(false);
    expect(registrationWindow({ status: "ACTIVE", registrationOpensAt: null, registrationClosesAt: null }, now).open).toBe(true);
  });
  it("respects opening and closing dates", () => {
    expect(registrationWindow({ status: "PUBLISHED", registrationOpensAt: new Date("2026-12-01"), registrationClosesAt: null }, now).open).toBe(false);
    expect(registrationWindow({ status: "PUBLISHED", registrationOpensAt: null, registrationClosesAt: new Date("2026-11-01") }, now).open).toBe(false);
    expect(registrationWindow({ status: "PUBLISHED", registrationOpensAt: new Date("2026-11-01"), registrationClosesAt: new Date("2026-12-01") }, now).open).toBe(true);
  });
});

describe("initial status", () => {
  it("joins straight in when no approval is needed", () => {
    expect(initialStatus({ role: "PARTICIPANT", requiresApproval: false, needsReview: false, capacity: null, taken: 0 })).toBe("ACTIVE");
  });
  it("waits for approval when required or when criteria need checking", () => {
    expect(initialStatus({ role: "MENTEE", requiresApproval: true, needsReview: false, capacity: null, taken: 0 })).toBe("PENDING");
    expect(initialStatus({ role: "MENTEE", requiresApproval: false, needsReview: true, capacity: null, taken: 0 })).toBe("PENDING");
  });
  it("wait-lists participants when full, but not mentors", () => {
    expect(initialStatus({ role: "PARTICIPANT", requiresApproval: false, needsReview: false, capacity: 80, taken: 80 })).toBe("WAITLISTED");
    expect(initialStatus({ role: "MENTOR", requiresApproval: false, needsReview: false, capacity: 80, taken: 80 })).toBe("ACTIVE");
  });
});

describe("coordinator decisions", () => {
  it("only sensible transitions are allowed", () => {
    expect(decisionAllowed("PENDING", "approve")).toBe(true);
    expect(decisionAllowed("ACTIVE", "approve")).toBe(false);
    expect(decisionAllowed("ACTIVE", "remove")).toBe(true);
    expect(decisionAllowed("PENDING", "remove")).toBe(false);
    expect(decisionAllowed("WITHDRAWN", "approve")).toBe(false);
    expect(decisionAllowed("REJECTED", "reject")).toBe(false);
  });
});

describe("post-sign-up redirect", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/p/ai/join?role=MENTOR")).toBe("/p/ai/join?role=MENTOR");
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
