import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  administrativeReach,
  AuthorizationError,
  assertCan,
  can,
  RequestError,
  type Actor,
} from "@/lib/rbac/authorize";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import { resolveProgramScope, type ProgramScope } from "@/lib/rbac/scope";
import {
  type ProgramAction,
  type programCreateSchema,
  type programUpdateSchema,
  type themeInputSchema,
} from "@/lib/program-validators";
import { ACTION_PERMISSION, modulesFor, RESERVED_SLUGS, slugify, transition } from "@/lib/program-rules";
import { auditThemeContrast, buildTheme, MENTY_THEME, type ThemeTokens } from "@/lib/theme/tokens";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";

type CreateInput = z.infer<typeof programCreateSchema>;
type UpdateInput = z.infer<typeof programUpdateSchema>;
type ThemeInput = z.infer<typeof themeInputSchema>;

export interface ServiceUser {
  id: string;
  actor: Actor;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function uniqueProgramSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 && !RESERVED_SLUGS.has(base) ? base : `${base}-${i + 1}`;
    const taken = await db.mentorshipProgram.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const text = (v: string | undefined | null) => (v ? sanitizeText(v) : null);
const multiline = (v: string | undefined | null) => (v ? sanitizeMultiline(v) : null);

function basicsData(b: CreateInput["basics"]) {
  return {
    name: sanitizeText(b.name),
    tagline: text(b.tagline),
    description: multiline(b.description),
    objectives: multiline(b.objectives),
    category: text(b.category),
    targetAudience: text(b.targetAudience),
    welcomeMessage: multiline(b.welcomeMessage),
    durationLabel: text(b.durationLabel),
    registrationOpensAt: b.registrationOpensAt ?? null,
    registrationClosesAt: b.registrationClosesAt ?? null,
    startsAt: b.startsAt ?? null,
    endsAt: b.endsAt ?? null,
  };
}

function checkDates(b: CreateInput["basics"]) {
  if (b.registrationOpensAt && b.registrationClosesAt && b.registrationClosesAt < b.registrationOpensAt) {
    throw new RequestError(422, "Registration must close after it opens.");
  }
  if (b.startsAt && b.endsAt && b.endsAt < b.startsAt) {
    throw new RequestError(422, "The programme must end after it starts.");
  }
}

function registrationData(r: CreateInput["registration"]) {
  return {
    visibility: r.visibility,
    requiresApproval: r.requiresApproval,
    capacity: r.capacity ?? null,
    eligibility: {
      ...r.eligibility,
      note: r.eligibility.note ? sanitizeMultiline(r.eligibility.note) : undefined,
    } as Prisma.InputJsonValue,
    careerTags: [...new Set(r.careerTags.map((t) => sanitizeText(t)))],
  };
}

function themeRow(t: ThemeTokens) {
  return {
    primaryColor: t.primaryColor,
    primaryContrast: t.primaryContrast,
    secondaryColor: t.secondaryColor,
    secondaryContrast: t.secondaryContrast,
    accentColor: t.accentColor,
    accentContrast: t.accentContrast,
    backgroundColor: t.backgroundColor,
    foregroundColor: t.foregroundColor,
    radius: t.radius,
    appearance: t.appearance,
  };
}

function themeFromInput(t: ThemeInput): ThemeTokens {
  return buildTheme(
    {
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      accentColor: t.accentColor,
      backgroundColor: t.backgroundColor,
      foregroundColor: t.foregroundColor,
    },
    { radius: t.radius, appearance: t.appearance }
  );
}

async function authorise(user: ServiceUser, permission: Permission, programId: string): Promise<ProgramScope> {
  const scope = await resolveProgramScope(programId);
  assertCan(user.actor, permission, scope);
  return scope;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a programme in DRAFT.
 *  - INSTITUTION: requires program.create at that institution.
 *  - PLATFORM:    requires program.create platform-wide (Menty's own).
 *  - INDEPENDENT: any signed-in user; they own it and coordinate it.
 */
export async function createProgram(user: ServiceUser, input: CreateInput) {
  checkDates(input.basics);
  let institutionId: string | null = null;

  if (input.ownerType === "INSTITUTION") {
    const institution = await db.institution.findUnique({
      where: { id: input.institutionId! },
      select: { id: true, status: true },
    });
    if (!institution) throw new RequestError(404, "Institution not found");
    if (institution.status !== "ACTIVE") {
      throw new RequestError(409, "The institution must be approved before it can host programmes.");
    }
    assertCan(user.actor, PERMISSIONS.PROGRAM_CREATE, { institutionId: institution.id });
    institutionId = institution.id;
  } else if (input.ownerType === "PLATFORM") {
    assertCan(user.actor, PERMISSIONS.PROGRAM_CREATE, {});
  }

  const coordinate = input.ownerType === "INDEPENDENT" ? true : input.coordinateMyself;
  const theme = input.theme ? themeFromInput(input.theme) : MENTY_THEME;
  if (input.theme && auditThemeContrast(theme).length > 0) {
    throw new RequestError(422, "Some colour combinations are hard to read. Adjust them in the branding step.");
  }
  const slug = await uniqueProgramSlug(input.basics.name);
  const coordinatorRole = await db.adminRole.findUniqueOrThrow({ where: { key: "program_coordinator" } });

  const program = await db.$transaction(async (tx) => {
    const created = await tx.mentorshipProgram.create({
      data: {
        slug,
        ...basicsData(input.basics),
        ownerType: input.ownerType,
        institutionId,
        ownerUserId: input.ownerType === "INDEPENDENT" ? user.id : null,
        status: "DRAFT",
        verificationStatus: input.ownerType === "INDEPENDENT" ? "UNVERIFIED" : "VERIFIED",
        deliveryModel: input.delivery.deliveryModel,
        deliveryMode: input.delivery.deliveryMode,
        matchingMode: input.delivery.matchingMode,
        enabledModules: modulesFor(input.delivery.deliveryModel),
        logoUrl: input.assets?.logoUrl ?? null,
        coverImageUrl: input.assets?.coverImageUrl ?? null,
        contactEmail: input.communications?.contactEmail ?? null,
        ...registrationData(input.registration),
      },
    });
    await tx.programTheme.createMany({
      data: [
        { programId: created.id, variant: "PUBLISHED", ...themeRow(theme) },
        { programId: created.id, variant: "DRAFT", ...themeRow(theme) },
      ],
    });
    if (coordinate) {
      await tx.roleAssignment.create({
        data: {
          userId: user.id,
          roleId: coordinatorRole.id,
          scopeType: "PROGRAM",
          programId: created.id,
          grantedById: user.id,
        },
      });
    }
    return created;
  });

  await logAudit({
    actorId: user.id,
    action: "program.create",
    targetType: "MentorshipProgram",
    targetId: program.id,
    programId: program.id,
    institutionId,
    metadata: { name: program.name, ownerType: program.ownerType, deliveryModel: program.deliveryModel },
  });
  return program;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Programmes the user can administer, for the /manage list. */
export async function listManagedPrograms(actor: Actor) {
  const reach = administrativeReach(actor);
  const where: Prisma.MentorshipProgramWhereInput = reach.platform
    ? {}
    : {
        OR: [
          ...(reach.programIds.length ? [{ id: { in: reach.programIds } }] : []),
          ...(reach.institutionIds.length ? [{ institutionId: { in: reach.institutionIds } }] : []),
        ],
      };
  if (!reach.platform && reach.programIds.length === 0 && reach.institutionIds.length === 0) return [];
  return db.mentorshipProgram.findMany({
    where,
    include: {
      institution: { select: { id: true, name: true, shortName: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** Full programme for the management screens (caller must hold program.read). */
export async function getProgramForManagement(user: ServiceUser, programId: string) {
  const scope = await authorise(user, PERMISSIONS.PROGRAM_READ, programId);
  const program = await db.mentorshipProgram.findUniqueOrThrow({
    where: { id: programId },
    include: {
      institution: { select: { id: true, name: true, shortName: true } },
      owner: { select: { id: true, name: true, email: true } },
      themes: true,
      transfers: {
        where: { status: "REQUESTED" },
        include: { toInstitution: { select: { id: true, name: true } } },
      },
      _count: { select: { memberships: true, cohorts: true } },
    },
  });
  return { program, scope };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const SECTION_PERMISSION: Record<UpdateInput["section"], Permission> = {
  basics: PERMISSIONS.PROGRAM_UPDATE,
  assets: PERMISSIONS.PROGRAM_BRANDING_EDIT,
  communications: PERMISSIONS.PROGRAM_UPDATE,
  delivery: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
  registration: PERMISSIONS.PROGRAM_SETTINGS_MANAGE,
};

export async function updateProgram(user: ServiceUser, programId: string, update: UpdateInput) {
  const scope = await authorise(user, SECTION_PERMISSION[update.section], programId);
  const current = await db.mentorshipProgram.findUniqueOrThrow({ where: { id: programId } });
  if (current.status === "SUSPENDED") throw new RequestError(409, "This programme is suspended by Menty.");

  let data: Prisma.MentorshipProgramUpdateInput;
  switch (update.section) {
    case "basics":
      checkDates(update.data);
      data = basicsData(update.data);
      break;
    case "assets":
      data = { logoUrl: update.data.logoUrl ?? null, coverImageUrl: update.data.coverImageUrl ?? null };
      break;
    case "communications":
      data = { contactEmail: update.data.contactEmail ?? null };
      break;
    case "delivery": {
      // Switching away from one-to-one must not orphan live pairings.
      if (update.data.deliveryModel === "PRESENTER_LED" && current.deliveryModel !== "PRESENTER_LED") {
        const live = await db.pairing.count({ where: { programId, status: "ACTIVE" } });
        if (live > 0) {
          throw new RequestError(409, `End the ${live} active pairing(s) before switching to presenter-led.`);
        }
      }
      data = {
        deliveryModel: update.data.deliveryModel,
        deliveryMode: update.data.deliveryMode,
        matchingMode: update.data.matchingMode,
        enabledModules: modulesFor(update.data.deliveryModel),
      };
      break;
    }
    case "registration":
      data = registrationData(update.data);
      break;
  }

  const program = await db.mentorshipProgram.update({ where: { id: programId }, data });
  await logAudit({
    actorId: user.id,
    action: `program.update.${update.section}`,
    targetType: "MentorshipProgram",
    targetId: programId,
    ...scope,
  });
  return program;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function applyProgramAction(user: ServiceUser, programId: string, action: ProgramAction) {
  const scope = await authorise(user, ACTION_PERMISSION[action], programId);
  const program = await db.mentorshipProgram.findUniqueOrThrow({ where: { id: programId } });
  const result = transition(program, action, {
    independentRequiresVerification:
      (await getSetting("programs.independent_requires_verification")) === "true",
  });
  if (!result.ok) throw new RequestError(409, result.error);

  const updated = await db.mentorshipProgram.update({ where: { id: programId }, data: result.changes });
  await logAudit({
    actorId: user.id,
    action: `program.${action}`,
    targetType: "MentorshipProgram",
    targetId: programId,
    ...scope,
    metadata: { from: program.status, to: updated.status, verification: updated.verificationStatus },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export async function saveDraftTheme(user: ServiceUser, programId: string, input: ThemeInput) {
  const scope = await authorise(user, PERMISSIONS.PROGRAM_BRANDING_EDIT, programId);
  const theme = themeFromInput(input);
  const row = themeRow(theme);
  await db.programTheme.upsert({
    where: { programId_variant: { programId, variant: "DRAFT" } },
    create: { programId, variant: "DRAFT", ...row },
    update: row,
  });
  await logAudit({ actorId: user.id, action: "program.theme.save", targetType: "ProgramTheme", ...scope });
  return { theme, issues: auditThemeContrast(theme) };
}

/** Copies the draft theme live. Blocked while any colour pairing fails WCAG AA. */
export async function publishTheme(user: ServiceUser, programId: string) {
  const scope = await authorise(user, PERMISSIONS.PROGRAM_BRANDING_EDIT, programId);
  const draft = await db.programTheme.findUnique({
    where: { programId_variant: { programId, variant: "DRAFT" } },
  });
  if (!draft) throw new RequestError(404, "Save a draft theme first.");
  const tokens: ThemeTokens = { ...draft, appearance: draft.appearance };
  const issues = auditThemeContrast(tokens);
  if (issues.length > 0) {
    throw new RequestError(422, `Not published: ${issues.map((i) => i.pair.toLowerCase()).join(", ")} too low in contrast.`);
  }
  const row = themeRow(tokens);
  await db.programTheme.upsert({
    where: { programId_variant: { programId, variant: "PUBLISHED" } },
    create: { programId, variant: "PUBLISHED", ...row },
    update: row,
  });
  await logAudit({ actorId: user.id, action: "program.theme.publish", targetType: "ProgramTheme", ...scope });
}

// ---------------------------------------------------------------------------
// Ownership transfer (independent -> institution)
// ---------------------------------------------------------------------------

export async function requestTransfer(user: ServiceUser, programId: string, institutionId: string, note?: string) {
  const scope = await authorise(user, PERMISSIONS.PROGRAM_TRANSFER, programId);
  const program = await db.mentorshipProgram.findUniqueOrThrow({ where: { id: programId } });
  if (program.ownerType !== "INDEPENDENT") {
    throw new RequestError(409, "Only independent programmes can be transferred to an institution.");
  }
  const institution = await db.institution.findUnique({ where: { id: institutionId } });
  if (!institution || institution.status !== "ACTIVE") throw new RequestError(404, "Institution not found");
  const open = await db.programTransfer.findFirst({ where: { programId, status: "REQUESTED" } });
  if (open) throw new RequestError(409, "A transfer request is already waiting for a decision.");

  const transfer = await db.programTransfer.create({
    data: { programId, toInstitutionId: institutionId, requestedById: user.id, note: note ? sanitizeMultiline(note) : null },
  });
  await logAudit({
    actorId: user.id,
    action: "program.transfer.request",
    targetType: "ProgramTransfer",
    targetId: transfer.id,
    ...scope,
    metadata: { toInstitutionId: institutionId },
  });
  return transfer;
}

/**
 * accept/decline: an administrator of the receiving institution.
 * cancel: someone who may transfer the programme.
 * Accepting moves ownership only; participants, staff and history stay.
 */
export async function decideTransfer(user: ServiceUser, transferId: string, action: "accept" | "decline" | "cancel") {
  const transfer = await db.programTransfer.findUnique({ where: { id: transferId } });
  if (!transfer || transfer.status !== "REQUESTED") throw new RequestError(404, "Transfer request not found");

  if (action === "cancel") {
    await authorise(user, PERMISSIONS.PROGRAM_TRANSFER, transfer.programId);
  } else if (!can(user.actor, PERMISSIONS.PROGRAM_TRANSFER, { institutionId: transfer.toInstitutionId })) {
    throw new AuthorizationError(403, "Only the receiving institution can decide this request");
  }

  const status = action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED";
  await db.$transaction(async (tx) => {
    await tx.programTransfer.update({
      where: { id: transferId },
      data: { status, decidedById: user.id, decidedAt: new Date() },
    });
    if (action === "accept") {
      await tx.mentorshipProgram.update({
        where: { id: transfer.programId },
        data: { ownerType: "INSTITUTION", institutionId: transfer.toInstitutionId, verificationStatus: "VERIFIED" },
      });
    }
  });
  await logAudit({
    actorId: user.id,
    action: `program.transfer.${action}`,
    targetType: "ProgramTransfer",
    targetId: transferId,
    programId: transfer.programId,
    institutionId: transfer.toInstitutionId,
  });
}

/** Open transfer requests addressed to institutions the actor administers. */
export async function incomingTransfers(actor: Actor) {
  const reach = administrativeReach(actor);
  if (!reach.platform && reach.institutionIds.length === 0) return [];
  return db.programTransfer.findMany({
    where: {
      status: "REQUESTED",
      ...(reach.platform ? {} : { toInstitutionId: { in: reach.institutionIds } }),
    },
    include: {
      program: { select: { id: true, name: true, slug: true } },
      toInstitution: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
