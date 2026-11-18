import { cache } from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { loadActor } from "@/lib/rbac/actor";
import { can, isParticipant } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { VISIBLE_STATUSES, type ProgramStatus } from "@/lib/program-rules";
import { DEFAULT_PROGRAM_SETTING } from "@/lib/rbac/scope";

/**
 * Loads a programme for its public page, applying visibility rules:
 *  - DRAFT/ARCHIVED/SUSPENDED: staff preview only;
 *  - PRIVATE: active members and staff only;
 *  - PUBLIC/UNLISTED: anyone with the link.
 * Returns null whenever the visitor may not see it (rendered as 404).
 */
export const loadPublicProgram = cache(async (slug: string, wantPreview: boolean) => {
  const program = await db.mentorshipProgram.findUnique({
    where: { slug },
    include: {
      institution: { select: { name: true, shortName: true, websiteUrl: true } },
      owner: { select: { name: true } },
      themes: true,
    },
  });
  if (!program) return null;

  const session = await auth();
  const actor = session?.user?.id ? await loadActor(session.user.id) : null;
  const scope = { programId: program.id, institutionId: program.institutionId };
  const isStaff = can(actor, PERMISSIONS.PROGRAM_READ, scope);
  const isMember = isParticipant(actor, program.id);

  const preview = wantPreview && isStaff;
  const publiclyVisible = VISIBLE_STATUSES.includes(program.status as ProgramStatus);
  if (!preview && !publiclyVisible) return null;
  if (!preview && program.visibility === "PRIVATE" && !isMember && !isStaff) return null;

  const theme =
    program.themes.find((t) => t.variant === (preview ? "DRAFT" : "PUBLISHED")) ??
    program.themes.find((t) => t.variant === "PUBLISHED") ??
    null;

  const defaultProgram = await db.platformSetting.findUnique({ where: { key: DEFAULT_PROGRAM_SETTING } });
  return {
    program,
    theme,
    preview,
    isMember,
    isStaff,
    /** The original MUBAS registration form still joins the default programme. */
    usesLegacyRegistration: defaultProgram?.value === program.id,
  };
});
