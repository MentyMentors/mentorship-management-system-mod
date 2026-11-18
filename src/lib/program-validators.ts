import { z } from "zod";
import { normaliseHex, RADIUS_OPTIONS } from "@/lib/theme/tokens";

/**
 * Validation for programme and institution management. Used by the API
 * routes (authoritative) and by the client forms (convenience).
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return v === null ? null : undefined;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

export const hexColour = z
  .string()
  .transform((v, ctx) => {
    const hex = normaliseHex(v);
    if (!hex) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a colour like #1d4ed8" });
      return z.NEVER;
    }
    return hex;
  });

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .url("Enter a full https:// address")
  .refine((u) => u.startsWith("https://"), "Images must use https://")
  .optional()
  .or(z.literal("").transform(() => null))
  .or(z.null());

export const DELIVERY_MODELS = ["PRESENTER_LED", "ONE_TO_ONE", "HYBRID"] as const;
export const DELIVERY_MODES = ["ONLINE", "IN_PERSON", "BLENDED"] as const;
export const MATCHING_MODES = ["MANUAL", "AUTOMATIC", "HYBRID"] as const;
export const VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export const ELIGIBILITY_MODES = [
  "OPEN",
  "INSTITUTIONS",
  "DEPARTMENTS",
  "YEARS_OF_STUDY",
  "INVITE_ONLY",
  "CUSTOM",
] as const;

export const basicsSchema = z.object({
  name: z.string().trim().min(3, "At least 3 characters").max(120),
  tagline: optionalText(160),
  description: optionalText(5000),
  objectives: optionalText(3000),
  category: optionalText(60),
  targetAudience: optionalText(200),
  welcomeMessage: optionalText(2000),
  durationLabel: optionalText(60),
  registrationOpensAt: optionalDate,
  registrationClosesAt: optionalDate,
  startsAt: optionalDate,
  endsAt: optionalDate,
});

export const brandingAssetsSchema = z.object({
  logoUrl: imageUrl,
  coverImageUrl: imageUrl,
});

export const deliverySchema = z
  .object({
    deliveryModel: z.enum(DELIVERY_MODELS),
    deliveryMode: z.enum(DELIVERY_MODES),
    matchingMode: z.enum(MATCHING_MODES).nullable().optional(),
  })
  .transform((v) => ({
    ...v,
    // Matching only applies when there is individual mentorship.
    matchingMode: v.deliveryModel === "PRESENTER_LED" ? null : (v.matchingMode ?? "MANUAL"),
  }));

export const eligibilitySchema = z.object({
  mode: z.enum(ELIGIBILITY_MODES).default("OPEN"),
  institutionIds: z.array(z.string().max(64)).max(50).default([]),
  departments: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  yearsOfStudy: z.array(z.number().int().min(1).max(10)).max(10).default([]),
  note: optionalText(1000),
});

export const registrationSchema = z.object({
  visibility: z.enum(VISIBILITIES),
  requiresApproval: z.boolean(),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  eligibility: eligibilitySchema,
  careerTags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

export const communicationsSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const themeInputSchema = z.object({
  primaryColor: hexColour,
  secondaryColor: hexColour,
  accentColor: hexColour,
  backgroundColor: hexColour,
  foregroundColor: hexColour,
  radius: z.enum(RADIUS_OPTIONS),
  appearance: z.enum(["LIGHT", "DARK", "SYSTEM"]),
});

export const OWNER_TYPES = ["INDEPENDENT", "INSTITUTION", "PLATFORM"] as const;

export const programCreateSchema = z
  .object({
    ownerType: z.enum(OWNER_TYPES),
    institutionId: z.string().max(64).optional(),
    basics: basicsSchema,
    assets: brandingAssetsSchema.optional(),
    theme: themeInputSchema.optional(),
    delivery: deliverySchema,
    registration: registrationSchema,
    communications: communicationsSchema.optional(),
    /** Make the creator a coordinator. Always true for independent programmes. */
    coordinateMyself: z.boolean().default(true),
  })
  .refine((v) => v.ownerType !== "INSTITUTION" || Boolean(v.institutionId), {
    message: "Choose the institution",
    path: ["institutionId"],
  });

/** Partial update of one settings section. */
export const programUpdateSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("basics"), data: basicsSchema }),
  z.object({ section: z.literal("assets"), data: brandingAssetsSchema }),
  z.object({ section: z.literal("delivery"), data: deliverySchema }),
  z.object({ section: z.literal("registration"), data: registrationSchema }),
  z.object({ section: z.literal("communications"), data: communicationsSchema }),
]);

export const PROGRAM_ACTIONS = [
  "publish",
  "unpublish",
  "start",
  "pause",
  "resume",
  "complete",
  "archive",
  "unarchive",
  "requestVerification",
  "verify",
  "rejectVerification",
  "suspend",
  "unsuspend",
] as const;
export type ProgramAction = (typeof PROGRAM_ACTIONS)[number];

export const programActionSchema = z.object({ action: z.enum(PROGRAM_ACTIONS) });

export const PROGRAM_STAFF_ROLES = ["program_coordinator", "program_assistant"] as const;

export const teamAddSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  roleKey: z.enum(PROGRAM_STAFF_ROLES),
});

export const institutionAdminAddSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

export const institutionRequestSchema = z.object({
  name: z.string().trim().min(3).max(160),
  shortName: optionalText(30),
  websiteUrl: z.string().trim().url().max(300).optional().or(z.literal("").transform(() => undefined)),
  description: optionalText(3000),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().toLowerCase().email().max(200),
  requestNote: optionalText(2000),
});

export const institutionUpdateSchema = z.object({
  name: z.string().trim().min(3).max(160),
  shortName: optionalText(30),
  websiteUrl: z.string().trim().url().max(300).optional().or(z.literal("").transform(() => undefined)),
  description: optionalText(3000),
  logoUrl: imageUrl,
  coverImageUrl: imageUrl,
  primaryColor: hexColour.optional(),
  secondaryColor: hexColour.optional(),
  accentColor: hexColour.optional(),
});

export const institutionActionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
});

export const transferRequestSchema = z.object({
  institutionId: z.string().min(1).max(64),
  note: optionalText(1000),
});

export const transferDecisionSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});

export const inviteAcceptSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number")
    .optional(),
});
