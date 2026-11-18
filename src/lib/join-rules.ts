/**
 * Pure rules for joining a programme (unit tested in tests/unit/join-rules.test.ts).
 * The service layer gathers the facts; these functions decide.
 */

export type JoinRole = "MENTEE" | "MENTOR" | "PARTICIPANT";
export type DeliveryModel = "PRESENTER_LED" | "ONE_TO_ONE" | "HYBRID";

/**
 * Roles people can sign up for themselves. Presenters and facilitators are
 * appointed by coordinators, never self-registered. Presenter-led programmes
 * have no individual pairing, so there are no mentee/mentor sign-ups.
 */
export function selfServiceRoles(model: DeliveryModel): JoinRole[] {
  switch (model) {
    case "PRESENTER_LED":
      return ["PARTICIPANT"];
    case "ONE_TO_ONE":
      return ["MENTEE", "MENTOR"];
    case "HYBRID":
      return ["PARTICIPANT", "MENTOR"];
  }
}

export const JOIN_ROLE_LABEL: Record<JoinRole, string> = {
  MENTEE: "Mentee — I'm looking for a mentor",
  MENTOR: "Mentor — I want to guide others",
  PARTICIPANT: "Participant — I want to take part",
};

/** Roles that count towards a programme's participant capacity. */
export const CAPACITY_ROLES: JoinRole[] = ["MENTEE", "PARTICIPANT"];

export interface Eligibility {
  mode?: "OPEN" | "INSTITUTIONS" | "DEPARTMENTS" | "YEARS_OF_STUDY" | "INVITE_ONLY" | "CUSTOM";
  institutionIds?: string[];
  departments?: string[];
  yearsOfStudy?: number[];
  note?: string;
}

export type EligibilityResult =
  | { eligible: true; needsReview: boolean; message?: string }
  | { eligible: false; message: string };

/**
 * Decides eligibility from what Menty knows about the person.
 * Institutional affiliation comes from verified email domains and
 * affiliations — it is an attribute, never a platform-wide restriction.
 * Criteria Menty cannot check yet (department, year, custom) are left to the
 * coordinator: the registration is always reviewed.
 */
export function checkEligibility(
  eligibility: Eligibility | null | undefined,
  person: { institutionIds: string[] },
  institutionNames: Record<string, string> = {}
): EligibilityResult {
  const e = eligibility ?? {};
  switch (e.mode ?? "OPEN") {
    case "OPEN":
      return { eligible: true, needsReview: false };
    case "INSTITUTIONS": {
      const allowed = e.institutionIds ?? [];
      if (allowed.length === 0) return { eligible: true, needsReview: true };
      if (person.institutionIds.some((id) => allowed.includes(id))) return { eligible: true, needsReview: false };
      const names = allowed.map((id) => institutionNames[id]).filter(Boolean);
      return {
        eligible: false,
        message: `This programme is for members of ${names.length ? names.join(", ") : "specific institutions"}. Sign in with your institutional email address to join.`,
      };
    }
    case "DEPARTMENTS":
      return { eligible: true, needsReview: true, message: `Open to: ${(e.departments ?? []).join(", ") || "selected departments"}. The programme team will check this.` };
    case "YEARS_OF_STUDY":
      return { eligible: true, needsReview: true, message: `Open to year ${(e.yearsOfStudy ?? []).join(", ") || "selected years"} students. The programme team will check this.` };
    case "CUSTOM":
      return { eligible: true, needsReview: true, message: e.note || "The programme team will check that you meet its criteria." };
    case "INVITE_ONLY":
      return { eligible: false, message: "This programme is by invitation only." };
  }
}

export interface WindowFacts {
  status: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

/** Whether new registrations are accepted right now. */
export function registrationWindow(p: WindowFacts, now = new Date()): { open: true } | { open: false; message: string } {
  if (p.status !== "PUBLISHED" && p.status !== "ACTIVE") {
    return { open: false, message: p.status === "PAUSED" ? "Registration is paused." : "This programme is not taking registrations." };
  }
  if (p.registrationOpensAt && p.registrationOpensAt > now) return { open: false, message: "Registration has not opened yet." };
  if (p.registrationClosesAt && p.registrationClosesAt < now) return { open: false, message: "Registration has closed." };
  return { open: true };
}

/**
 * Initial membership status. Over capacity → waitlist (participants only);
 * approval required or criteria to check → pending; otherwise straight in.
 */
export function initialStatus(input: {
  role: JoinRole;
  requiresApproval: boolean;
  needsReview: boolean;
  capacity: number | null;
  taken: number;
}): "ACTIVE" | "PENDING" | "WAITLISTED" {
  if (CAPACITY_ROLES.includes(input.role) && input.capacity !== null && input.taken >= input.capacity) return "WAITLISTED";
  if (input.requiresApproval || input.needsReview) return "PENDING";
  return "ACTIVE";
}

/** Statuses that occupy a place (count toward capacity / block re-joining). */
export const LIVE_STATUSES = ["PENDING", "ACTIVE", "WAITLISTED"] as const;

export type DecisionAction = "approve" | "reject" | "waitlist" | "remove";

/** Allowed coordinator decisions per current status. */
export function decisionAllowed(current: string, action: DecisionAction): boolean {
  switch (action) {
    case "approve":
      return current === "PENDING" || current === "WAITLISTED" || current === "REJECTED";
    case "reject":
      return current === "PENDING" || current === "WAITLISTED";
    case "waitlist":
      return current === "PENDING";
    case "remove":
      return current === "ACTIVE" || current === "SUSPENDED";
  }
}
