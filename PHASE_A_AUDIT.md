# PHASE A — Repository Audit (actual codebase, verified against GitHub main)

## Stack
Next.js 15.1 (App Router) · React 19 · TypeScript 5.7 · NextAuth v5 beta.25
(credentials provider, JWT sessions, bcryptjs) · Prisma 6.2 · PostgreSQL on
Neon (`DATABASE_URL`/`DIRECT_URL`) · Tailwind + shadcn/ui · nodemailer ·
Vitest 2.1 (tests in `tests/unit`, `tests/integration`) · Vercel deploy.

## Existing data model (prisma/schema.prisma, 7 migrations)
- `User`: global `Role` enum { ADMIN, MENTOR, MENTEE } + `UserStatus`
  { PENDING, APPROVED, REJECTED }. **This is the core blocker**: one global
  role per account.
- `MentorProfile.userId @unique` / `MenteeProfile.userId @unique` — a user
  can be a mentor XOR mentee, exactly once, globally.
- `Semester` = cohort (dates, isActive, registrationOpen, isArchived).
- `Pairing` scoped by semester; status ACTIVE/ENDED; `attemptPairing()` in
  `src/lib/pairing.ts` scores by department (100) + shared interests (10) +
  capacity/hours, with a transactional capacity re-check and waitlist flag
  on MenteeProfile. Sound engine — keep and scope.
- `Announcement` (audience ALL/MENTORS/MENTEES, optional semesterId),
  `Message`, `Meeting` (+Zoom), `IssueReport`, `AuditLog` (actor/action/
  target/metadata), `Notification`, `PasswordResetToken`,
  `EmailVerificationToken` — email verification already enforced at login
  (`emailVerifiedAt` + APPROVED).
- Catalog tables: Department, Programme (academic programme — NOT a
  mentorship programme; keep as-is), Interest, StrongModule.

## Authorization today
`src/lib/authz.ts` has only `requireSession(roles?)` against the global
role; middleware is an edge gate via `authConfig.callbacks.authorized`.
No institution/programme/cohort scoping exists anywhere.

## Registration flow
`/api/register` + zod discriminated union (mentor/mentee) → creates User
(PENDING) + profile → verification email → admin approves →
`attemptPairing` runs immediately. **Approval and pairing are coupled**
(requirement 9 says they must be distinct).

## What's reusable vs missing
Reusable: pairing engine scoring, waitlist mechanism, email verification +
reset tokens, audit log, announcements + chunked bulk email, CSV import/
export, catalog CRUD, dashboards' UI shell, Vitest setup.
Missing: institutions, domains, mentorship programmes, coordinators,
programme-scoped roles/memberships, application workflow distinct from
registration, form builder, tenant isolation, programme discovery.

## Key security risks found
1. Global MENTOR/MENTEE role (no per-programme semantics).
2. Approval auto-pairs (application ≠ membership ≠ pairing).
3. Admin checks are global-role only; no IDOR scoping on semester/user IDs.
4. No email-domain allowlist at all (any domain can register).
5. Announcements/bulk-email audience is global per role.
6. `MentorProfile.userId` unique constraint actively prevents multi-role.

## Proposed schema changes → delivered in this increment
See `prisma/schema.prisma` + migration SQL: Institution, InstitutionDomain,
InstitutionalAffiliation, MentorshipProgram, ProgramCoordinator,
ProgramMembership (role per programme — THE fix for requirement 2),
RegistrationForm, FormQuestion, ProgramApplication, Semester.programId
(cohort scoping), Announcement.programId, AuditLog institution/program
columns, PairingStatus lifecycle extended, profile per-user uniqueness
dropped, idempotent legacy backfill.

## Implementation sequence (dependency order)
Stage 1 DB foundation (DONE — this increment) → Stage 2 authz + domain
gate + register route wiring → Stage 3 discovery/application workflow →
Stage 4 dashboards + programme-scoped pairing → Stage 5 comms/exports
scoping → Stage 6 cleanup migration (drop legacy global role usage).
