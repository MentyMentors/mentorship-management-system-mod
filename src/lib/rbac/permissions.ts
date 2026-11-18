/**
 * The complete catalogue of administrative permission keys.
 *
 * Keys are declared here once. Which keys a role grants is decided by:
 *   - built-in (isSystem) roles: SYSTEM_ROLES below, authoritative in code so
 *     new permissions reach existing roles without a data migration;
 *   - custom roles: AdminRole.permissions in the database.
 *
 * Server code checks a key from this catalogue — never a role name — so adding
 * a role never means hunting for scattered `role === "ADMIN"` checks.
 * Pattern adopted from UniSpace (src/lib/rbac/permissions.ts there).
 */

export const PERMISSIONS = {
  // Platform
  PLATFORM_SETTINGS_MANAGE: "platform.settings.manage",
  PLATFORM_AUDIT_READ: "platform.audit.read",
  PLATFORM_INTEGRATIONS_MANAGE: "platform.integrations.manage",
  PLATFORM_ANALYTICS_READ: "platform.analytics.read",
  PLATFORM_BRANDING_MANAGE: "platform.branding.manage",
  /** Shared catalogues: departments, academic programmes, interests, modules. */
  CATALOG_MANAGE: "catalog.manage",
  /** Platform-wide issue reports. */
  ISSUE_MANAGE: "issue.manage",

  // Users (platform directory)
  USER_READ: "user.read",
  USER_SUSPEND: "user.suspend",
  USER_DELETE: "user.delete",

  // Roles
  ROLE_MANAGE: "role.manage",
  ROLE_ASSIGN: "role.assign",

  // Institutions
  INSTITUTION_CREATE: "institution.create",
  INSTITUTION_UPDATE: "institution.update",
  INSTITUTION_BRANDING_EDIT: "institution.branding.edit",
  INSTITUTION_SUSPEND: "institution.suspend",
  INSTITUTION_VERIFY: "institution.verify",
  INSTITUTION_ANALYTICS_READ: "institution.analytics.read",

  // Programmes
  PROGRAM_CREATE: "program.create",
  PROGRAM_READ: "program.read",
  PROGRAM_UPDATE: "program.update",
  PROGRAM_PUBLISH: "program.publish",
  PROGRAM_ARCHIVE: "program.archive",
  PROGRAM_SUSPEND: "program.suspend",
  PROGRAM_VERIFY: "program.verify",
  PROGRAM_TRANSFER: "program.transfer",
  PROGRAM_BRANDING_EDIT: "program.branding.edit",
  PROGRAM_SETTINGS_MANAGE: "program.settings.manage",
  PROGRAM_COORDINATOR_ASSIGN: "program.coordinator.assign",

  // Cohorts (Semester rows)
  COHORT_MANAGE: "cohort.manage",

  // Registration and participants
  FORM_MANAGE: "form.manage",
  REGISTRATION_READ: "registration.read",
  REGISTRATION_REVIEW: "registration.review",
  PARTICIPANT_READ: "participant.read",
  PARTICIPANT_MANAGE: "participant.manage",
  /** Bulk import/export of participant data. */
  PARTICIPANT_EXPORT: "participant.export",
  PARTICIPANT_IMPORT: "participant.import",

  // Sessions and meetings
  SESSION_READ: "session.read",
  SESSION_MANAGE: "session.manage",
  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_EXPORT: "attendance.export",
  MEETING_READ: "meeting.read",
  MEETING_MANAGE: "meeting.manage",

  // One-to-one
  PAIRING_READ: "pairing.read",
  PAIRING_MANAGE: "pairing.manage",
  MATCHING_RUN: "matching.run",
  MATCHING_APPROVE: "matching.approve",

  // Communications
  ANNOUNCEMENT_SEND: "announcement.send",
  EMAIL_SEND: "email.send",
  EMAIL_TEMPLATE_MANAGE: "email.template.manage",
  SENDER_IDENTITY_MANAGE: "sender.identity.manage",
  REMINDER_MANAGE: "reminder.manage",

  // Milestones and resources
  MILESTONE_MANAGE: "milestone.manage",
  MILESTONE_REVIEW: "milestone.review",
  RESOURCE_MANAGE: "resource.manage",

  // Insight
  PROGRAM_ANALYTICS_READ: "program.analytics.read",
  PROGRAM_AUDIT_READ: "program.audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export type ScopeType = "PLATFORM" | "INSTITUTION" | "PROGRAM";

const P = PERMISSIONS;

/** Everything a coordinator can do inside their own programme. */
const PROGRAM_OPERATIONS: Permission[] = [
  P.PROGRAM_READ,
  P.PROGRAM_UPDATE,
  P.PROGRAM_PUBLISH,
  P.PROGRAM_TRANSFER,
  P.PROGRAM_BRANDING_EDIT,
  P.PROGRAM_SETTINGS_MANAGE,
  P.PROGRAM_COORDINATOR_ASSIGN,
  P.ROLE_ASSIGN,
  P.COHORT_MANAGE,
  P.FORM_MANAGE,
  P.REGISTRATION_READ,
  P.REGISTRATION_REVIEW,
  P.PARTICIPANT_READ,
  P.PARTICIPANT_MANAGE,
  P.PARTICIPANT_EXPORT,
  P.PARTICIPANT_IMPORT,
  P.SESSION_READ,
  P.SESSION_MANAGE,
  P.ATTENDANCE_READ,
  P.ATTENDANCE_EXPORT,
  P.MEETING_READ,
  P.MEETING_MANAGE,
  P.PAIRING_READ,
  P.PAIRING_MANAGE,
  P.MATCHING_RUN,
  P.MATCHING_APPROVE,
  P.ANNOUNCEMENT_SEND,
  P.EMAIL_SEND,
  P.EMAIL_TEMPLATE_MANAGE,
  P.SENDER_IDENTITY_MANAGE,
  P.REMINDER_MANAGE,
  P.MILESTONE_MANAGE,
  P.MILESTONE_REVIEW,
  P.RESOURCE_MANAGE,
  P.PROGRAM_ANALYTICS_READ,
  P.PROGRAM_AUDIT_READ,
];

export interface SystemRoleDefinition {
  key: string;
  name: string;
  allowedScopes: readonly ScopeType[];
  permissions: readonly Permission[];
}

/**
 * Built-in roles, seeded as AdminRole rows (isSystem = true) by the Phase 1
 * migration. See docs/phase-0/02-permission-matrix.md.
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: {
    key: "super_admin",
    name: "Super Admin",
    allowedScopes: ["PLATFORM"],
    permissions: ALL_PERMISSIONS,
  },
  INSTITUTION_ADMIN: {
    key: "institution_admin",
    name: "Institution Administrator",
    allowedScopes: ["INSTITUTION"],
    // Oversight, not day-to-day operation: an institution admin is not
    // automatically the coordinator of every programme.
    permissions: [
      P.INSTITUTION_UPDATE,
      P.INSTITUTION_BRANDING_EDIT,
      P.INSTITUTION_ANALYTICS_READ,
      P.ROLE_ASSIGN,
      P.PROGRAM_CREATE,
      P.PROGRAM_READ,
      P.PROGRAM_UPDATE,
      P.PROGRAM_PUBLISH,
      P.PROGRAM_ARCHIVE,
      P.PROGRAM_TRANSFER,
      P.PROGRAM_BRANDING_EDIT,
      P.PROGRAM_SETTINGS_MANAGE,
      P.PROGRAM_COORDINATOR_ASSIGN,
      P.REGISTRATION_READ,
      P.PARTICIPANT_READ,
      P.SESSION_READ,
      P.ATTENDANCE_READ,
      P.ATTENDANCE_EXPORT,
      P.MEETING_READ,
      P.PAIRING_READ,
      P.PROGRAM_ANALYTICS_READ,
      P.PROGRAM_AUDIT_READ,
    ],
  },
  PROGRAM_COORDINATOR: {
    key: "program_coordinator",
    name: "Programme Coordinator",
    allowedScopes: ["PROGRAM"],
    permissions: PROGRAM_OPERATIONS,
  },
  PROGRAM_ASSISTANT: {
    key: "program_assistant",
    name: "Programme Assistant",
    allowedScopes: ["PROGRAM"],
    permissions: [
      P.PROGRAM_READ,
      P.REGISTRATION_READ,
      P.REGISTRATION_REVIEW,
      P.PARTICIPANT_READ,
      P.SESSION_READ,
      P.SESSION_MANAGE,
      P.ATTENDANCE_READ,
      P.ATTENDANCE_EXPORT,
      P.MEETING_READ,
      P.MEETING_MANAGE,
      P.PAIRING_READ,
      P.ANNOUNCEMENT_SEND,
      P.EMAIL_SEND,
      P.MILESTONE_REVIEW,
      P.RESOURCE_MANAGE,
      P.PROGRAM_ANALYTICS_READ,
    ],
  },
} as const satisfies Record<string, SystemRoleDefinition>;

const SYSTEM_ROLE_BY_KEY: ReadonlyMap<string, SystemRoleDefinition> = new Map(
  Object.values(SYSTEM_ROLES).map((role) => [role.key, role])
);

/**
 * The permissions a role grants. System roles always use the code-side list;
 * custom roles use the stored list, filtered to known keys.
 */
export function permissionsForRole(role: {
  key: string;
  isSystem: boolean;
  permissions: string[];
}): Permission[] {
  if (role.isSystem) {
    const definition = SYSTEM_ROLE_BY_KEY.get(role.key);
    return definition ? [...definition.permissions] : [];
  }
  const known = new Set<string>(ALL_PERMISSIONS);
  return role.permissions.filter((p): p is Permission => known.has(p));
}
