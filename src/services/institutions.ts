import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/email/mailer";
import { institutionDecisionEmail } from "@/lib/email/templates";
import { administrativeReach, assertCan, RequestError, type Actor } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { institutionRequestSchema, institutionUpdateSchema } from "@/lib/program-validators";
import { slugify } from "@/lib/program-rules";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import type { ServiceUser } from "@/services/programs";

type RequestInput = z.infer<typeof institutionRequestSchema>;
type UpdateInput = z.infer<typeof institutionUpdateSchema>;

async function uniqueInstitutionSlug(name: string, shortName?: string): Promise<string> {
  const base = slugify(shortName || name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.institution.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function profileData(input: RequestInput) {
  return {
    name: sanitizeText(input.name),
    shortName: input.shortName ? sanitizeText(input.shortName) : null,
    websiteUrl: input.websiteUrl ?? null,
    description: input.description ? sanitizeMultiline(input.description) : null,
    contactName: sanitizeText(input.contactName),
    contactEmail: input.contactEmail,
  };
}

/**
 * Anyone signed in can ask to register an institution. It stays
 * PENDING_VERIFICATION until a Super Admin approves it, at which point the
 * requester becomes its administrator.
 */
export async function requestInstitution(user: ServiceUser, input: RequestInput) {
  const open = await db.institution.count({
    where: { requestedById: user.id, status: "PENDING_VERIFICATION", verificationStatus: { not: "REJECTED" } },
  });
  if (open >= 3) throw new RequestError(429, "You already have registration requests waiting for review.");

  const institution = await db.institution.create({
    data: {
      ...profileData(input),
      slug: await uniqueInstitutionSlug(input.name, input.shortName),
      requestNote: input.requestNote ? sanitizeMultiline(input.requestNote) : null,
      requestedById: user.id,
      status: "PENDING_VERIFICATION",
      verificationStatus: "PENDING",
    },
  });

  // Tell platform administrators there is something to review.
  const admins = await db.user.findMany({
    where: { status: "APPROVED", roleAssignments: { some: { scopeType: "PLATFORM", revokedAt: null } } },
    select: { id: true },
  });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "SYSTEM" as const,
        title: "Institution registration request",
        body: `${institution.name} asked to join Menty.`,
      })),
    });
  }
  await logAudit({
    actorId: user.id,
    action: "institution.request",
    targetType: "Institution",
    targetId: institution.id,
    institutionId: institution.id,
    metadata: { name: institution.name },
  });
  return institution;
}

/** Super Admin creates an institution directly (already approved). */
export async function createInstitution(user: ServiceUser, input: RequestInput) {
  assertCan(user.actor, PERMISSIONS.INSTITUTION_CREATE, {});
  const institution = await db.institution.create({
    data: {
      ...profileData(input),
      slug: await uniqueInstitutionSlug(input.name, input.shortName),
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await logAudit({
    actorId: user.id,
    action: "institution.create",
    targetType: "Institution",
    targetId: institution.id,
    institutionId: institution.id,
    metadata: { name: institution.name },
  });
  return institution;
}

export async function institutionAction(
  user: ServiceUser,
  institutionId: string,
  action: "approve" | "reject" | "suspend" | "reactivate"
) {
  const permission =
    action === "approve" || action === "reject" ? PERMISSIONS.INSTITUTION_VERIFY : PERMISSIONS.INSTITUTION_SUSPEND;
  assertCan(user.actor, permission, {});
  const institution = await db.institution.findUnique({
    where: { id: institutionId },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
  });
  if (!institution) throw new RequestError(404, "Institution not found");

  let data: Prisma.InstitutionUpdateInput;
  switch (action) {
    case "approve":
      if (institution.status !== "PENDING_VERIFICATION") throw new RequestError(409, "Not awaiting approval.");
      data = { status: "ACTIVE", verificationStatus: "VERIFIED", verifiedAt: new Date() };
      break;
    case "reject":
      if (institution.status !== "PENDING_VERIFICATION") throw new RequestError(409, "Not awaiting approval.");
      data = { verificationStatus: "REJECTED" };
      break;
    case "suspend":
      if (institution.status !== "ACTIVE") throw new RequestError(409, "Only an active institution can be suspended.");
      data = { status: "SUSPENDED" };
      break;
    case "reactivate":
      if (institution.status !== "SUSPENDED") throw new RequestError(409, "Not suspended.");
      data = { status: "ACTIVE" };
      break;
  }

  const adminRole = await db.adminRole.findUniqueOrThrow({ where: { key: "institution_admin" } });
  await db.$transaction(async (tx) => {
    await tx.institution.update({ where: { id: institutionId }, data });
    // The person who asked becomes the first administrator.
    if (action === "approve" && institution.requestedBy) {
      const live = await tx.roleAssignment.findFirst({
        where: { userId: institution.requestedBy.id, roleId: adminRole.id, institutionId, revokedAt: null },
      });
      if (!live) {
        await tx.roleAssignment.create({
          data: {
            userId: institution.requestedBy.id,
            roleId: adminRole.id,
            scopeType: "INSTITUTION",
            institutionId,
            grantedById: user.id,
          },
        });
      }
    }
  });

  if ((action === "approve" || action === "reject") && institution.requestedBy) {
    await sendMail({
      to: institution.requestedBy.email,
      ...institutionDecisionEmail({
        name: institution.requestedBy.name,
        institutionName: institution.name,
        approved: action === "approve",
      }),
    });
  }
  await logAudit({
    actorId: user.id,
    action: `institution.${action}`,
    targetType: "Institution",
    targetId: institutionId,
    institutionId,
  });
}

export async function updateInstitution(user: ServiceUser, institutionId: string, input: UpdateInput) {
  assertCan(user.actor, PERMISSIONS.INSTITUTION_UPDATE, { institutionId });
  const institution = await db.institution.findUnique({ where: { id: institutionId } });
  if (!institution) throw new RequestError(404, "Institution not found");

  const brandingChanged =
    input.logoUrl !== undefined || input.coverImageUrl !== undefined || input.primaryColor || input.secondaryColor || input.accentColor;
  if (brandingChanged) assertCan(user.actor, PERMISSIONS.INSTITUTION_BRANDING_EDIT, { institutionId });

  await db.$transaction(async (tx) => {
    await tx.institution.update({
      where: { id: institutionId },
      data: {
        name: sanitizeText(input.name),
        shortName: input.shortName ? sanitizeText(input.shortName) : null,
        websiteUrl: input.websiteUrl ?? null,
        description: input.description ? sanitizeMultiline(input.description) : null,
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
      },
    });
    if (input.primaryColor || input.secondaryColor || input.accentColor) {
      const colours = {
        ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
        ...(input.secondaryColor ? { secondaryColor: input.secondaryColor } : {}),
        ...(input.accentColor ? { accentColor: input.accentColor } : {}),
      };
      await tx.institutionTheme.upsert({
        where: { institutionId_variant: { institutionId, variant: "PUBLISHED" } },
        create: { institutionId, variant: "PUBLISHED", ...colours },
        update: colours,
      });
    }
  });
  await logAudit({
    actorId: user.id,
    action: "institution.update",
    targetType: "Institution",
    targetId: institutionId,
    institutionId,
  });
}

/** Institutions the actor can see administratively. */
export async function listManagedInstitutions(actor: Actor) {
  const reach = administrativeReach(actor);
  if (!reach.platform && reach.institutionIds.length === 0) return [];
  return db.institution.findMany({
    where: reach.platform ? {} : { id: { in: reach.institutionIds } },
    include: { _count: { select: { programs: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

/** Institutions that can receive programmes (for transfer and creation pickers). */
export function listActiveInstitutions() {
  return db.institution.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, shortName: true },
    orderBy: { name: "asc" },
  });
}

/** The user's own pending/rejected registration requests. */
export function myInstitutionRequests(userId: string) {
  return db.institution.findMany({
    where: { requestedById: userId, status: "PENDING_VERIFICATION" },
    select: { id: true, name: true, verificationStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
