# Menty multi-tenancy — developer guide

Status: **Phases 1–3 implemented** (foundation; programme creation and customisation;
homepage, marketplace and onboarding). Phase 3: `docs/phase-3/README.md`.
Design: `docs/phase-0/`. Deployment: `docs/phase-1/DEPLOY.md`. Phase 2: `docs/phase-2/README.md`.

## The model in one paragraph

A **programme** (`MentorshipProgram`) is the tenant boundary. It is owned by an institution, by
an individual (independent), or by Menty itself. A person has **one** `User` account. They take
part in programmes through `ProgramMembership` (one row per programme and role: MENTOR, MENTEE,
PRESENTER, FACILITATOR, PARTICIPANT) and administer through `RoleAssignment` (a role at
PLATFORM, INSTITUTION or PROGRAM scope). `User.role` is legacy: it still routes the original
mentor/mentee dashboards until Phase 3, and is never used to authorise administrative actions.

## Authorising code — the rules

1. Use a guard from `src/lib/authz.ts`, never `session.user.role`:
   - `requireProgramPermission(PERMISSIONS.X, programId)` — programme-scoped API routes;
   - `requireDefaultProgramPermission(PERMISSIONS.X)` — the original single-programme admin
     screens (the programme comes from the `legacy.default_program_id` platform setting);
   - `requirePlatformPermission(PERMISSIONS.X)` — catalogues, audit log, issue reports;
   - `requireProgramMembership(programId, roles?)` — participant features.
   - Server components: `programPage()` / `platformPage()` from `src/lib/admin-pages.ts`.
2. Permission keys live in `src/lib/rbac/permissions.ts`. Built-in roles' permissions are
   defined there too (authoritative in code); custom roles store theirs in `AdminRole`.
3. A programme id from the client is a lookup key only. Scopes are resolved from the database
   (`src/lib/rbac/scope.ts`). After loading a record by id, call `assertInProgram(record, scope)`
   so records of other programmes return 404.
4. Every query in a programme-scoped route filters by `programId`.
5. Creating a mentor/mentee profile? Call `upsertMembership()` in the same transaction.
6. Changing someone's status or roles? Call `bumpSessionVersion(userId)` so their open sessions
   pick it up on the next request.
7. Business-rule failures throw `RequestError(status, message)` (rendered by `errorResponse`).
   Programme/institution logic lives in `src/services/` (programs, institutions, staff); routes stay thin.
8. Audit entries carry `programId` / `institutionId`; secrets in metadata are redacted.

## Tests

- `tests/unit/rbac.test.ts` — scope rules and privilege-escalation cases (cross-programme,
  cross-institution, vertical).
- `tests/unit/program-roles.test.ts` — one account, many programme roles.
- `tests/unit/migrations.test.ts` — no psql-only syntax and no row deletion in migrations.

## Rehearsing migrations locally

`scripts/migration-rehearsal/legacy-sample.sql` is synthetic data shaped like production before
Phase 1. Load it into a database at the pre-October migrations, then apply the Phase 1
migration and compare.
