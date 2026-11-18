import { cache } from "react";
import { db } from "@/lib/db";
import { AuthorizationError, type ResourceScope } from "./authorize";

/**
 * Scope resolution. Every authorisation check uses the scope of the resource
 * as recorded in the database. An id sent by the client is only ever a lookup
 * key: a forged programmeId cannot widen what the caller can reach.
 */

export interface ProgramScope extends ResourceScope {
  programId: string;
  institutionId: string | null;
}

/** The programme's real scope, or 404. */
export async function resolveProgramScope(programId: string): Promise<ProgramScope> {
  const program = await db.mentorshipProgram.findUnique({
    where: { id: programId },
    select: { id: true, institutionId: true },
  });
  if (!program) throw new AuthorizationError(404, "Programme not found");
  return { programId: program.id, institutionId: program.institutionId };
}

export const DEFAULT_PROGRAM_SETTING = "legacy.default_program_id";

/**
 * The programme the original (pre-multi-tenant) admin dashboard, registration
 * form and mentor/mentee dashboards operate on. Configured as a platform
 * setting by the Phase 1 migration; nothing in code names a programme.
 */
export const getDefaultProgramScope = cache(async (): Promise<ProgramScope> => {
  const setting = await db.platformSetting.findUnique({
    where: { key: DEFAULT_PROGRAM_SETTING },
  });
  if (!setting?.value) {
    throw new AuthorizationError(500, "Default programme is not configured");
  }
  return resolveProgramScope(setting.value);
});

/** Scope of a cohort (Semester row), via its programme. */
export async function resolveCohortScope(cohortId: string): Promise<ProgramScope> {
  const cohort = await db.semester.findUnique({
    where: { id: cohortId },
    select: { programId: true, program: { select: { institutionId: true } } },
  });
  if (!cohort) throw new AuthorizationError(404, "Cohort not found");
  if (!cohort.programId) {
    throw new AuthorizationError(409, "Cohort is not attached to a programme");
  }
  return { programId: cohort.programId, institutionId: cohort.program?.institutionId ?? null };
}

/**
 * Throws 404 unless the record's programId matches the scope that was
 * authorised. Use after loading a record by id inside a programme-scoped
 * route, so a record from another programme looks like it does not exist.
 */
export function assertInProgram<T extends { programId: string | null }>(
  record: T | null | undefined,
  scope: { programId: string },
  label = "Record"
): asserts record is T & { programId: string } {
  if (!record || record.programId !== scope.programId) {
    throw new AuthorizationError(404, `${label} not found`);
  }
}
