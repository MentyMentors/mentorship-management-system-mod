import { describe, expect, it } from "vitest";
import {
  extractDomain,
  hostMatches,
  normalizeEmail,
} from "@/lib/domains";

// Covers requirement tests 7-9 and 11 (domain policy). DB-backed tests for
// inactive-domain rejection live in tests/integration/register-api.test.ts.

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Student@MUBAS.AC.MW ")).toBe(
      "student@mubas.ac.mw"
    );
  });
});

describe("extractDomain", () => {
  it("extracts the host from a normalised address", () => {
    expect(extractDomain("student@mubas.ac.mw")).toBe("mubas.ac.mw");
  });

  it("rejects addresses without a host", () => {
    expect(extractDomain("not-an-email")).toBeNull();
    expect(extractDomain("a@")).toBeNull();
    expect(extractDomain("@b.com")).toBeNull();
    expect(extractDomain("a@localhost")).toBeNull();
  });
});

describe("hostMatches — exact domain matching (no lookalikes)", () => {
  const reg = "mubas.ac.mw";

  it("accepts the exact approved domain", () => {
    expect(hostMatches(reg, "mubas.ac.mw", false)).toBe(true);
    expect(hostMatches(reg, "MUBAS.AC.MW", false)).toBe(true); // case-safe
  });

  it("rejects lookalike / substring hosts", () => {
    // contains the approved text but is a different host
    expect(hostMatches(reg, "mubas.ac.mw.evil.com", false)).toBe(false);
    expect(hostMatches(reg, "notmubas.ac.mw", false)).toBe(false);
    expect(hostMatches(reg, "mubas.ac.mw.attacker.io", false)).toBe(false);
    expect(hostMatches(reg, "mubas-ac-mw.com", false)).toBe(false);
  });

  it("rejects subdomains unless explicitly allowed", () => {
    expect(hostMatches(reg, "cs.mubas.ac.mw", false)).toBe(false);
    expect(hostMatches(reg, "cs.mubas.ac.mw", true)).toBe(true);
    // allowance must not extend to lookalike parents either
    expect(hostMatches(reg, "mubas.ac.mw.", true)).toBe(true);
  });
});
