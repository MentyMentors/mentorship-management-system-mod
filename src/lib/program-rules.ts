import type { ProgramAction } from "@/lib/program-validators";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

/**
 * Pure programme rules: lifecycle transitions, which dashboard modules a
 * delivery model switches on, and slugs. No database access (unit tested in
 * tests/unit/program-rules.test.ts).
 */

export type ProgramStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "SUSPENDED";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type DeliveryModel = "PRESENTER_LED" | "ONE_TO_ONE" | "HYBRID";

export interface ProgramState {
  status: ProgramStatus;
  verificationStatus: VerificationStatus;
  ownerType: "PLATFORM" | "INSTITUTION" | "INDEPENDENT";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  description: string | null;
  publishedAt: Date | null;
}

export interface TransitionContext {
  /** Platform setting programs.independent_requires_verification. */
  independentRequiresVerification: boolean;
  now?: Date;
}

export type TransitionResult =
  | {
      ok: true;
      changes: Partial<{
        status: ProgramStatus;
        verificationStatus: VerificationStatus;
        publishedAt: Date | null;
        archivedAt: Date | null;
      }>;
    }
  | { ok: false; error: string };

/** Which permission each action needs (checked in the programme's scope). */
export const ACTION_PERMISSION: Record<ProgramAction, Permission> = {
  publish: PERMISSIONS.PROGRAM_PUBLISH,
  unpublish: PERMISSIONS.PROGRAM_PUBLISH,
  start: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
  pause: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
  resume: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
  complete: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
  archive: PERMISSIONS.PROGRAM_ARCHIVE,
  unarchive: PERMISSIONS.PROGRAM_ARCHIVE,
  requestVerification: PERMISSIONS.PROGRAM_UPDATE,
  verify: PERMISSIONS.PROGRAM_VERIFY,
  rejectVerification: PERMISSIONS.PROGRAM_VERIFY,
  suspend: PERMISSIONS.PROGRAM_SUSPEND,
  unsuspend: PERMISSIONS.PROGRAM_SUSPEND,
};

const fail = (error: string): TransitionResult => ({ ok: false, error });

export function transition(
  state: ProgramState,
  action: ProgramAction,
  context: TransitionContext
): TransitionResult {
  const now = context.now ?? new Date();
  const { status } = state;

  // A suspended programme can only be unsuspended (by Menty).
  if (status === "SUSPENDED" && action !== "unsuspend" && action !== "verify" && action !== "rejectVerification") {
    return fail("This programme is suspended by Menty.");
  }

  switch (action) {
    case "publish": {
      if (status !== "DRAFT") return fail("Only a draft programme can be published.");
      if (!state.description?.trim()) return fail("Add a description before publishing.");
      if (
        state.ownerType === "INDEPENDENT" &&
        state.visibility === "PUBLIC" &&
        context.independentRequiresVerification &&
        state.verificationStatus !== "VERIFIED"
      ) {
        return fail("Independent programmes must be verified by Menty before they are listed publicly.");
      }
      return { ok: true, changes: { status: "PUBLISHED", publishedAt: state.publishedAt ?? now } };
    }
    case "unpublish":
      if (status !== "PUBLISHED") return fail("Only a published programme that has not started can be unpublished.");
      return { ok: true, changes: { status: "DRAFT" } };
    case "start":
      if (status !== "PUBLISHED") return fail("Publish the programme before starting it.");
      return { ok: true, changes: { status: "ACTIVE" } };
    case "pause":
      if (status !== "ACTIVE") return fail("Only a running programme can be paused.");
      return { ok: true, changes: { status: "PAUSED" } };
    case "resume":
      if (status !== "PAUSED") return fail("Only a paused programme can be resumed.");
      return { ok: true, changes: { status: "ACTIVE" } };
    case "complete":
      if (status !== "ACTIVE" && status !== "PAUSED") return fail("Only a running programme can be completed.");
      return { ok: true, changes: { status: "COMPLETED" } };
    case "archive":
      if (status === "ARCHIVED") return fail("Already archived.");
      return { ok: true, changes: { status: "ARCHIVED", archivedAt: now } };
    case "unarchive":
      if (status !== "ARCHIVED") return fail("Only an archived programme can be restored.");
      return { ok: true, changes: { status: "DRAFT", archivedAt: null } };
    case "requestVerification":
      if (state.verificationStatus === "VERIFIED") return fail("Already verified.");
      if (state.verificationStatus === "PENDING") return fail("Verification already requested.");
      return { ok: true, changes: { verificationStatus: "PENDING" } };
    case "verify":
      return { ok: true, changes: { verificationStatus: "VERIFIED" } };
    case "rejectVerification":
      return { ok: true, changes: { verificationStatus: "REJECTED" } };
    case "suspend":
      if (status === "SUSPENDED") return fail("Already suspended.");
      return { ok: true, changes: { status: "SUSPENDED" } };
    case "unsuspend":
      if (status !== "SUSPENDED") return fail("Not suspended.");
      return { ok: true, changes: { status: state.publishedAt ? "PUBLISHED" : "DRAFT" } };
  }
}

/** Statuses in which a programme's public page can be visited. */
export const VISIBLE_STATUSES: ProgramStatus[] = ["PUBLISHED", "ACTIVE", "PAUSED", "COMPLETED"];

/**
 * Dashboard modules switched on by a delivery model. A presenter-led
 * programme never gets pairing or matching screens.
 */
export function modulesFor(model: DeliveryModel): string[] {
  const shared = ["announcements", "messages", "resources", "milestones", "analytics", "cohorts"];
  switch (model) {
    case "PRESENTER_LED":
      return ["sessions", "attendance", ...shared];
    case "ONE_TO_ONE":
      return ["pairings", "matching", "meetings", ...shared];
    case "HYBRID":
      return ["sessions", "attendance", "pairings", "matching", "meetings", ...shared];
  }
}

/** URL-safe slug from a name (ASCII, hyphenated, max 60 chars). */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "programme"
  );
}

export const RESERVED_SLUGS = new Set(["new", "preview", "edit", "admin", "api", "manage"]);
