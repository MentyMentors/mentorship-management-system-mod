import type { MembershipStatus, Prisma, ProgramRole } from "@prisma/client";

/**
 * Records (or updates) a user's role in a programme. Every path that creates
 * a mentor or mentee profile must call this in the same transaction, so the
 * programme membership — the record authorisation reads — always exists.
 */
export async function upsertMembership(
  tx: Prisma.TransactionClient,
  input: {
    programId: string;
    userId: string;
    role: ProgramRole;
    status: MembershipStatus;
    cohortId?: string | null;
    capacity?: number | null;
  }
) {
  const joinedAt = input.status === "ACTIVE" ? new Date() : null;
  return tx.programMembership.upsert({
    where: {
      programId_userId_role: {
        programId: input.programId,
        userId: input.userId,
        role: input.role,
      },
    },
    create: {
      programId: input.programId,
      userId: input.userId,
      role: input.role,
      status: input.status,
      cohortId: input.cohortId ?? null,
      capacity: input.capacity ?? null,
      joinedAt,
    },
    update: {
      status: input.status,
      cohortId: input.cohortId ?? undefined,
      capacity: input.capacity ?? undefined,
      ...(joinedAt ? { joinedAt } : {}),
    },
  });
}
