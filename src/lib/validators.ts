import { z } from "zod";
import { MAX_CUSTOM_INTEREST_LENGTH } from "@/lib/constants";

// ------------------------------------------------------------------
// Shared primitives
// ------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(100, "Name is too long");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const registrationNumberSchema = z
  .string()
  .trim()
  .min(3, "Registration number is too short")
  .max(30, "Registration number is too long");

// Department/programme names now live in the Department/Programme tables
// (admin-managed) rather than a hardcoded enum. Shape is validated here;
// membership in the current catalog is checked against the database at
// the registration API route.
const departmentSchema = z
  .string()
  .trim()
  .min(1, "Select a department")
  .max(120);

const programmeSchema = z
  .string()
  .trim()
  .min(1, "Select a programme")
  .max(120);

const interestsSchema = z
  .array(z.string().trim().min(1).max(MAX_CUSTOM_INTEREST_LENGTH))
  .min(1, "Select at least one interest")
  .max(10, "Select at most 10 interests");

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const baseRegistration = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  registrationNumber: registrationNumberSchema,
  department: departmentSchema,
  programme: programmeSchema,
  interests: interestsSchema,
});

export const mentorRegistrationSchema = baseRegistration.extend({
  role: z.literal("MENTOR"),
  yearOfStudy: z.coerce.number().int().min(2).max(6),
  strongModules: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Select at least one strong module")
    .max(8),
  hoursPerWeek: z.coerce.number().int().min(1).max(20),
  maxMentees: z.coerce.number().int().min(1).max(10),
  crossDepartment: z.boolean(),
});

export const menteeRegistrationSchema = baseRegistration.extend({
  role: z.literal("MENTEE"),
  sameDepartmentPreferred: z.boolean(),
});

export const registrationSchema = z.discriminatedUnion("role", [
  mentorRegistrationSchema,
  menteeRegistrationSchema,
]);

export type MentorRegistrationInput = z.infer<typeof mentorRegistrationSchema>;
export type MenteeRegistrationInput = z.infer<typeof menteeRegistrationSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ------------------------------------------------------------------
// Profiles
// ------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  interests: interestsSchema.optional(),
  // Mentor-only fields (ignored for mentees server-side)
  hoursPerWeek: z.coerce.number().int().min(1).max(20).optional(),
  maxMentees: z.coerce.number().int().min(1).max(10).optional(),
  crossDepartment: z.boolean().optional(),
  strongModules: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ------------------------------------------------------------------
// Semesters
// ------------------------------------------------------------------

export const semesterSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((s) => s.endDate > s.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export const semesterActionSchema = z.object({
  action: z.enum([
    "activate",
    "archive",
    "unarchive",
    "openRegistration",
    "closeRegistration",
  ]),
});

export type SemesterInput = z.infer<typeof semesterSchema>;

// ------------------------------------------------------------------
// Meetings
// ------------------------------------------------------------------

export const meetingLogSchema = z.object({
  pairingId: z.string().min(1),
  date: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  topics: z.string().trim().min(3, "Describe the topics discussed").max(500),
  notes: z.string().trim().max(2000).optional(),
});

export type MeetingLogInput = z.infer<typeof meetingLogSchema>;

// ------------------------------------------------------------------
// Messaging
// ------------------------------------------------------------------

export const messageSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().trim().min(1, "Message cannot be empty").max(4000),
});

export type MessageInput = z.infer<typeof messageSchema>;

// ------------------------------------------------------------------
// Issue reports
// ------------------------------------------------------------------

export const issueReportSchema = z.object({
  subject: z.string().trim().min(3, "Give it a short title").max(150),
  description: z
    .string()
    .trim()
    .min(10, "Add a bit more detail")
    .max(3000),
});

export type IssueReportInput = z.infer<typeof issueReportSchema>;

export const issueDecisionSchema = z.object({
  status: z.literal("RESOLVED"),
});

// ------------------------------------------------------------------
// Announcements & bulk email
// ------------------------------------------------------------------

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(3).max(5000),
  audience: z.enum(["ALL", "MENTORS", "MENTEES"]),
  sendEmail: z.boolean().default(false),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const bulkEmailSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(3).max(10000),
  audience: z.enum(["ALL", "MENTORS", "MENTEES"]),
});

export type BulkEmailInput = z.infer<typeof bulkEmailSchema>;

// Bulk sends are chunked across multiple requests from the client so a
// single serverless invocation never has to email hundreds of
// recipients in one go (see /api/admin/bulk-email). Each chunk request
// carries the running totals so the server can log one accurate audit
// entry on the final chunk without needing shared state between calls.
export const bulkEmailChunkSchema = bulkEmailSchema.extend({
  offset: z.coerce.number().int().min(0).default(0),
  runningSent: z.coerce.number().int().min(0).default(0),
  runningFailed: z.coerce.number().int().min(0).default(0),
  runningFailedEmails: z.array(z.string()).default([]),
});

export type BulkEmailChunkInput = z.infer<typeof bulkEmailChunkSchema>;

export const announcementSendChunkSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  runningSent: z.coerce.number().int().min(0).default(0),
  runningFailed: z.coerce.number().int().min(0).default(0),
  runningFailedEmails: z.array(z.string()).default([]),
});

export type AnnouncementSendChunkInput = z.infer<typeof announcementSendChunkSchema>;

// ------------------------------------------------------------------
// Admin actions
// ------------------------------------------------------------------

export const userDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const manualPairingSchema = z.object({
  menteeProfileId: z.string().min(1),
  mentorProfileId: z.string().min(1),
});

export const reassignSchema = z.object({
  mentorProfileId: z.string().min(1),
});

// ------------------------------------------------------------------
// Catalog (departments, programmes, interests) — admin managed
// ------------------------------------------------------------------

export const catalogItemCreateSchema = z.object({
  name: z.string().trim().min(2, "Too short").max(120, "Too long"),
});

export type CatalogItemCreateInput = z.infer<typeof catalogItemCreateSchema>;

export const catalogItemUpdateSchema = z.object({
  name: z.string().trim().min(2, "Too short").max(120, "Too long").optional(),
  isActive: z.boolean().optional(),
});

export type CatalogItemUpdateInput = z.infer<typeof catalogItemUpdateSchema>;
