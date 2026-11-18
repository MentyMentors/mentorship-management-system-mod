import { describe, expect, it } from "vitest";
import { modulesFor, slugify, transition, type ProgramState } from "@/lib/program-rules";

const base: ProgramState = {
  status: "DRAFT",
  verificationStatus: "UNVERIFIED",
  ownerType: "INSTITUTION",
  visibility: "PUBLIC",
  description: "A programme",
  publishedAt: null,
};
const ctx = { independentRequiresVerification: false, now: new Date("2026-11-18T10:00:00Z") };

describe("programme lifecycle", () => {
  it("publishes a draft with a description", () => {
    const r = transition(base, "publish", ctx);
    expect(r).toEqual({ ok: true, changes: { status: "PUBLISHED", publishedAt: ctx.now } });
  });

  it("refuses to publish without a description", () => {
    expect(transition({ ...base, description: "  " }, "publish", ctx).ok).toBe(false);
  });

  it("requires verification for public independent programmes only when the setting is on", () => {
    const indep = { ...base, ownerType: "INDEPENDENT" as const };
    expect(transition(indep, "publish", ctx).ok).toBe(true);
    const strict = { ...ctx, independentRequiresVerification: true };
    expect(transition(indep, "publish", strict).ok).toBe(false);
    expect(transition({ ...indep, visibility: "UNLISTED" }, "publish", strict).ok).toBe(true);
    expect(transition({ ...indep, verificationStatus: "VERIFIED" }, "publish", strict).ok).toBe(true);
  });

  it("runs published -> active -> paused -> active -> completed", () => {
    let s: ProgramState = { ...base, status: "PUBLISHED", publishedAt: ctx.now };
    for (const [action, expected] of [
      ["start", "ACTIVE"],
      ["pause", "PAUSED"],
      ["resume", "ACTIVE"],
      ["complete", "COMPLETED"],
    ] as const) {
      const r = transition(s, action, ctx);
      expect(r.ok && r.changes.status).toBe(expected);
      if (r.ok) s = { ...s, ...r.changes } as ProgramState;
    }
  });

  it("rejects out-of-order transitions", () => {
    expect(transition(base, "start", ctx).ok).toBe(false);
    expect(transition(base, "pause", ctx).ok).toBe(false);
    expect(transition({ ...base, status: "ACTIVE" }, "unpublish", ctx).ok).toBe(false);
  });

  it("suspension locks everything except unsuspend and verification decisions", () => {
    const s = { ...base, status: "SUSPENDED" as const, publishedAt: ctx.now };
    expect(transition(s, "publish", ctx).ok).toBe(false);
    expect(transition(s, "archive", ctx).ok).toBe(false);
    const r = transition(s, "unsuspend", ctx);
    expect(r.ok && r.changes.status).toBe("PUBLISHED");
    const neverPublished = transition({ ...s, publishedAt: null }, "unsuspend", ctx);
    expect(neverPublished.ok && neverPublished.changes.status).toBe("DRAFT");
  });

  it("verification requests cannot be repeated", () => {
    expect(transition(base, "requestVerification", ctx).ok).toBe(true);
    expect(transition({ ...base, verificationStatus: "PENDING" }, "requestVerification", ctx).ok).toBe(false);
    expect(transition({ ...base, verificationStatus: "VERIFIED" }, "requestVerification", ctx).ok).toBe(false);
  });

  it("archive and restore", () => {
    const a = transition({ ...base, status: "COMPLETED" }, "archive", ctx);
    expect(a.ok && a.changes).toEqual({ status: "ARCHIVED", archivedAt: ctx.now });
    const u = transition({ ...base, status: "ARCHIVED" }, "unarchive", ctx);
    expect(u.ok && u.changes).toEqual({ status: "DRAFT", archivedAt: null });
  });
});

describe("delivery model modules", () => {
  it("presenter-led programmes never get pairing or matching (non-negotiable 8)", () => {
    const m = modulesFor("PRESENTER_LED");
    expect(m).toContain("sessions");
    expect(m).not.toContain("pairings");
    expect(m).not.toContain("matching");
  });
  it("one-to-one has pairings but no sessions; hybrid has both", () => {
    expect(modulesFor("ONE_TO_ONE")).toContain("pairings");
    expect(modulesFor("ONE_TO_ONE")).not.toContain("sessions");
    expect(modulesFor("HYBRID")).toEqual(expect.arrayContaining(["sessions", "pairings"]));
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Women in STEM — Mentorship 2026!")).toBe("women-in-stem-mentorship-2026");
    expect(slugify("Engineering & Design")).toBe("engineering-and-design");
    expect(slugify("Ünïcödé")).toBe("unicode");
    expect(slugify("!!!")).toBe("programme");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
