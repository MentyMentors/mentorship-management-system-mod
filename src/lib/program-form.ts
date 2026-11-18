/**
 * Programme form state and its conversion to/from API payloads.
 * Plain module (no "use client") so server pages can build initial form
 * state too; the field components live in components/program/program-fields.
 */

// ---------------------------------------------------------------------------
// Form state (strings for inputs) and conversion to API payloads
// ---------------------------------------------------------------------------

export interface BasicsValue {
  name: string;
  tagline: string;
  description: string;
  objectives: string;
  category: string;
  targetAudience: string;
  welcomeMessage: string;
  durationLabel: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
}

export interface DeliveryValue {
  deliveryModel: "PRESENTER_LED" | "ONE_TO_ONE" | "HYBRID";
  deliveryMode: "ONLINE" | "IN_PERSON" | "BLENDED";
  matchingMode: "MANUAL" | "AUTOMATIC" | "HYBRID" | null;
}

export interface RegistrationValue {
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  requiresApproval: boolean;
  capacity: string;
  eligibility: {
    mode: "OPEN" | "INSTITUTIONS" | "DEPARTMENTS" | "YEARS_OF_STUDY" | "INVITE_ONLY" | "CUSTOM";
    institutionIds: string[];
    departments: string;
    yearsOfStudy: number[];
    note: string;
  };
  careerTags: string;
}

export const EMPTY_BASICS: BasicsValue = {
  name: "",
  tagline: "",
  description: "",
  objectives: "",
  category: "",
  targetAudience: "",
  welcomeMessage: "",
  durationLabel: "",
  registrationOpensAt: "",
  registrationClosesAt: "",
  startsAt: "",
  endsAt: "",
};

export const DEFAULT_DELIVERY: DeliveryValue = {
  deliveryModel: "PRESENTER_LED",
  deliveryMode: "ONLINE",
  matchingMode: null,
};

export const DEFAULT_REGISTRATION: RegistrationValue = {
  visibility: "PUBLIC",
  requiresApproval: true,
  capacity: "",
  eligibility: { mode: "OPEN", institutionIds: [], departments: "", yearsOfStudy: [], note: "" },
  careerTags: "",
};

const dateOrNull = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : null);
const list = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function basicsPayload(v: BasicsValue) {
  return {
    ...v,
    registrationOpensAt: dateOrNull(v.registrationOpensAt),
    registrationClosesAt: dateOrNull(v.registrationClosesAt),
    startsAt: dateOrNull(v.startsAt),
    endsAt: dateOrNull(v.endsAt),
  };
}

export function registrationPayload(v: RegistrationValue) {
  return {
    visibility: v.visibility,
    requiresApproval: v.requiresApproval,
    capacity: v.capacity ? Number(v.capacity) : null,
    eligibility: {
      mode: v.eligibility.mode,
      institutionIds: v.eligibility.mode === "INSTITUTIONS" ? v.eligibility.institutionIds : [],
      departments: v.eligibility.mode === "DEPARTMENTS" ? list(v.eligibility.departments) : [],
      yearsOfStudy: v.eligibility.mode === "YEARS_OF_STUDY" ? v.eligibility.yearsOfStudy : [],
      note: v.eligibility.note,
    },
    careerTags: list(v.careerTags),
  };
}

const toDateInput = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Builds form state from a stored programme (settings screens). */
export function fromProgram(p: {
  name: string;
  tagline: string | null;
  description: string | null;
  objectives: string | null;
  category: string | null;
  targetAudience: string | null;
  welcomeMessage: string | null;
  durationLabel: string | null;
  registrationOpensAt: Date | string | null;
  registrationClosesAt: Date | string | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  deliveryModel: DeliveryValue["deliveryModel"];
  deliveryMode: DeliveryValue["deliveryMode"];
  matchingMode: DeliveryValue["matchingMode"];
  visibility: RegistrationValue["visibility"];
  requiresApproval: boolean;
  capacity: number | null;
  eligibility: unknown;
  careerTags: string[];
}) {
  const e = (p.eligibility ?? {}) as Partial<{
    mode: RegistrationValue["eligibility"]["mode"];
    institutionIds: string[];
    departments: string[];
    yearsOfStudy: number[];
    note: string;
  }>;
  return {
    basics: {
      name: p.name,
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      objectives: p.objectives ?? "",
      category: p.category ?? "",
      targetAudience: p.targetAudience ?? "",
      welcomeMessage: p.welcomeMessage ?? "",
      durationLabel: p.durationLabel ?? "",
      registrationOpensAt: toDateInput(p.registrationOpensAt),
      registrationClosesAt: toDateInput(p.registrationClosesAt),
      startsAt: toDateInput(p.startsAt),
      endsAt: toDateInput(p.endsAt),
    } satisfies BasicsValue,
    delivery: { deliveryModel: p.deliveryModel, deliveryMode: p.deliveryMode, matchingMode: p.matchingMode } satisfies DeliveryValue,
    registration: {
      visibility: p.visibility,
      requiresApproval: p.requiresApproval,
      capacity: p.capacity ? String(p.capacity) : "",
      eligibility: {
        mode: e.mode ?? "OPEN",
        institutionIds: e.institutionIds ?? [],
        departments: (e.departments ?? []).join(", "),
        yearsOfStudy: e.yearsOfStudy ?? [],
        note: e.note ?? "",
      },
      careerTags: p.careerTags.join(", "),
    } satisfies RegistrationValue,
  };
}

