# Menty Multitenant Transformation — Implementation Notes

## Status: Stage 1 complete (database foundation + authorization core)

This directory contains the first dependency-ordered increment of the
multitenant transformation, produced against the audited codebase of
`MentyMentors/mentorship-management-system-mod` (Next.js 15.1, NextAuth v5
beta, Prisma 6, PostgreSQL/Neon, Vitest).

## Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Full target schema (stage 1). Drop-in replacement. |
| `prisma/migrations/20261023000000_multitenant_core/migration.sql` | DDL + idempotent backfill |
| `src/lib/authz.ts` | Extended guards: `requireSuperAdmin`, `requireProgramCoordinator`, `requireProgramMembership`, `requireCohortAccess`, `getProgramRole` |
| `src/lib/domains.ts` | Exact-match institutional email-domain validation |
| `src/lib/program-roles.ts` | Pure role/scope rules (unit-tested) |
| `tests/unit/domains.test.ts` | Domain policy tests (7–9, 11) |
| `tests/unit/program-roles.test.ts` | Identity/role tests (1–5, 30) |

## Applying the migration (development)

```bash
# 1. Fresh dev database
createdb menty_dev
psql -v legacy_institution="'MUBAS'" \
     -v legacy_program="'MEI-MUBAS Engineering Mentorship'" \
     menty_dev -f prisma/migrations/20261023000000_multitenant_core/migration.sql

# 2. Point prisma at it and verify
DATABASE_URL=... npx prisma migrate resolve --applied 20261023000000_multitenant_core
DATABASE_URL=... npx prisma generate
DATABASE_URL=... npx prisma validate
```

Then run the validation queries included at the end of the migration SQL —
both must return 0 — before touching application code.

`psql` variables let you name the migrated institution/programme for YOUR
data; nothing is permanently hardcoded. Adjust the two `-v` values to match
the real legacy deployment.

## Staged rollout

1. **Stage 1 (this increment):** new tables/columns, profile uniqueness
   dropped, legacy data backfilled. Old code keeps working (all new columns
   nullable; `User.role` untouched).
2. **Stage 2:** copy `src/lib/authz.ts`, `src/lib/domains.ts`,
   `src/lib/program-roles.ts` into the repo; switch admin API routes from
   `requireSession(["ADMIN"])` to the new guards; wire `findInstitutionByEmail`
   into `/api/register`.
3. **Stage 3:** programme discovery + application workflow on top of
   `MentorshipProgram` / `RegistrationForm` / `ProgramApplication`.
4. **Stage 4:** coordinator + super-admin dashboards; pairing engine gains
   programme-scope checks via `pairingScopeValid`.
5. **Stage 5:** announcements/emails scoped by `programId`; exports enforce
   programme scope.
6. **Stage 6 (separate migration, only after 1–5 verified):** make
   `Semester.programId` / `Announcement.programId` NOT NULL; remove
   `MENTOR`/`MENTEE` from the global `Role` enum.

## Environment variables

No new secrets. Optional: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
(existing). Migration uses psql variables, not env vars, by design.
