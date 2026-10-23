import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProgramRole, Role } from "@prisma/client";
import type { Session } from "next-auth";

export class AuthorizationError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Server-side guard for API routes and server actions.
 * Returns the session or throws an AuthorizationError.
 *
 * LEGACY COMPAT (stage 1): role checks against the global User.role enum are
 * kept working during the transition. New code must use the programme-scoped
 * guards below instead of relying on a global MENTOR/MENTEE role.
 */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthorizationError(401, "Authentication required");
  }
  if (session.user.status !== "APPROVED") {
    throw new AuthorizationError(403, "Account is not approved");
  }
  if (roles && !roles.includes(session.user.role)) {
    throw new AuthorizationError(403, "Insufficient permissions");
  }

  return session;
}

/**
 * Platform-level Super Admin guard.
 * Super Admin status derives ONLY from User.role === "ADMIN" (set through a
 * trusted administrative process, never via public registration) — never
 * from a client-supplied value, and never self-grantable.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    throw new AuthorizationError(403, "Platform administrator access required");
  }
  return session;
}

/**
 * Returns true when the user coordinates the given programme. Super Admins
 * pass through so they can intervene platform-wide.
 */
export async function isProgramCoordinator(
  userId: string,
  programId: string
): Promise<boolean> {
  const [membership, isAdmin] = await Promise.all([
    db.programCoordinator.findUnique({
      where: { programId_userId: { programId, userId } },
    }),
    db.user.findFirst({
      where: { id: userId, role: "ADMIN", status: "APPROVED" },
      select: { id: true },
    }),
  ]);
  return Boolean(membership || isAdmin);
}

/**
 * Coordinator guard: the authenticated user must be explicitly assigned to
 * THIS programme (or be a platform Super Admin). The caller supplies the
 * programId from the route/body — this function validates the assignment;
 * callers must additionally verify the target record actually belongs to
 * the claimed programId to prevent IDOR.
 */
export async function requireProgramCoordinator(
  programId: string
): Promise<Session> {
  const session = await requireSession();
  if (session.user.role === "ADMIN") return session;
  if (!(await isProgramCoordinator(session.user.id, programId))) {
    throw new AuthorizationError(
      403,
      "You are not a coordinator for this programme"
    );
  }
  return session;
}

/**
 * Programme participant guard: the user must hold an ACTIVE membership in
 * this programme, optionally in a specific role (MENTOR | MENTEE).
 * This is the record that answers "what is this user's role HERE" — the
 * same account may hold different roles in different programmes.
 */
export async function requireProgramMembership(
  programId: string,
  role?: ProgramRole
): Promise<Session> {
  const session = await requireSession();
  const membership = await db.programMembership.findFirst({
    where: {
      programId,
      userId: session.user.id,
      status: "ACTIVE",
      ...(role ? { role } : {}),
    },
    select: { id: true },
  });
  if (!membership) {
    throw new AuthorizationError(403, "No active membership in this programme");
  }
  return session;
}

/**
 * Convenience: the user's programme-scoped role, or null when not an active
 * member. Never reads the deprecated global User.role.
 */
export async function getProgramRole(
  userId: string,
  programId: string
): Promise<ProgramRole | null> {
  const membership = await db.programMembership.findFirst({
    where: { programId, userId, status: "ACTIVE" },
    select: { role: true },
  });
  return membership?.role ?? null;
}

/**
 * Cohort guard: membership in the cohort's parent programme is required.
 * Verifies the cohort -> programme chain so a client cannot smuggle an
 * unrelated cohortId past the check.
 */
export async function requireCohortAccess(cohortId: string): Promise<{
  session: Session;
  programId: string;
}> {
  const session = await requireSession();
  const cohort = await db.semester.findUnique({
    where: { id: cohortId },
    select: { programId: true },
  });
  if (!cohort?.programId) {
    throw new AuthorizationError(404, "Cohort not found");
  }
  if (session.user.role !== "ADMIN") {
    const isCoordinator = await isProgramCoordinator(
      session.user.id,
      cohort.programId
    );
    const isMember = await db.programMembership.findFirst({
      where: {
        programId: cohort.programId,
        userId: session.user.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!isCoordinator && !isMember) {
      throw new AuthorizationError(403, "No access to this cohort's programme");
    }
  }
  return { session, programId: cohort.programId };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
