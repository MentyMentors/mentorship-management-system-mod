# Phase 0 — Implementation Plan and Migration Strategy

Each phase ends with: migrations rehearsed on a Neon branch, tests green, `next build` green, a
short demo note, and your approval before the next phase starts. "Done" means backend, database,
permissions, validation and error handling work, not just the screen.

## Phase 0 — Audit and architecture (this delivery)

Architecture report, permission matrix, proposed schema, diagrams, this plan. **No code changes.**

## Phase 1 — Multi-tenant foundation

Schema (one migration, expand-only):

- Replace the broken `20261023000000_multitenant_core` (see report §1.1 and §6).
- Add `AdminRole`, `RoleAssignment`, `AdminInvite`, reshaped `Institution`,
  `InstitutionMembership`, `MentorshipProgram` (ownerType, nullable institutionId, slug,
  delivery model, visibility), `ProgramMembership` (new roles, PENDING status), `PlatformSetting`,
  `User.sessionVersion`, `programId` columns on Pairing / Meeting / profiles / Message.
- Hand-written partial unique indexes for nullable compound keys.

Data migration (plain SQL, idempotent, literal names — no psql variables):

1. Create the first-party programme (default: "Menty Volunteer Mentor Network",
   `ownerType = PLATFORM`, `deliveryModel = ONE_TO_ONE`, status ACTIVE, visibility PUBLIC).
2. Point every `Semester`, `Announcement`, `MentorProfile`, `MenteeProfile`, `Pairing`, `Meeting`
   at it.
3. One `ProgramMembership` per existing profile (MENTOR / MENTEE), ACTIVE if the user is
   APPROVED, otherwise PENDING.
4. `User.role = ADMIN` → `RoleAssignment(super_admin, PLATFORM)` **and** coordinator of the
   first-party programme.
5. Verification queries (must all return 0) run in CI against the rehearsal branch.

Code:

- `src/lib/rbac/permissions.ts`, `authorize.ts` (ported from UniSpace), `loadActor()`,
  `resolveProgramScope()`, `requirePermission()`.
- Auth.js `jwt` callback checks `sessionVersion`; token no longer drives authorisation.
- Middleware reduced to "signed in?"; `/mentor`, `/mentee`, `/admin` redirect to the new
  dashboards with the first-party programme pre-selected, so existing users land where they did.
- Every existing admin API route moves from `requireSession(["ADMIN"])` to permission checks
  scoped to the first-party programme. Behaviour is unchanged for current admins.
- Seed system roles. `provision-super-admin` script.
- Tests: RBAC unit tests + escalation integration tests listed in the permission matrix.
- Fix the 3 stale tests.

Exit check: acceptance criteria 22, 23, 24, 25 (isolation + legacy survival).

## Phase 2 — Programme creation and customisation

- Programme wizard (basic info → branding → model → registration settings → communications →
  preview → publish). Server actions with Zod; each step saves a draft.
- Independent programme creation for any signed-in user (becomes owner + coordinator).
- Institution create (Super Admin) / request (public form → Super Admin approves) and
  institution-admin invites.
- `ProgramTheme` / `InstitutionTheme` with `ProgramThemeScope`, `--program-*` variables,
  Tailwind mapping, WCAG contrast gate, live preview, "Powered by Menty" footer.
- Uploads via the chosen storage provider (logo, cover).
- Public programme page `/p/[slug]` honouring PUBLIC / UNLISTED / PRIVATE.
- Coordinator management (add, replace, remove) and ownership transfer to an institution.
- Programme verification queue for Super Admin.

Exit check: AC 1, 2, 3, 5.

## Phase 3 — Homepage and onboarding

- New homepage with three entry points: Find your mentor (first-party programme, existing
  buttons kept), Find a programme (marketplace), Run a programme.
- Marketplace `/programs` with server-side search and filters (institution, category, model,
  online/physical, open registration, audience, career tags).
- Join flow: details → sign in / sign up → programme form → submit → confirmation → pending →
  dashboard.
- Unified dashboard `/dashboard`: my programmes with my roles, upcoming sessions, pending
  registrations, announcements, notifications; programme switcher without sign-out.

Exit check: AC 7, 8, 9, 25.

## Phase 4 — Registration forms

- Form builder (add/remove/reorder fields, sections, required, options, conditional `showIf`,
  preview, save draft, publish → new immutable version) per participant role.
- Server-side validation of answers generated from the field definitions (Zod built at runtime).
- Eligibility rules engine (open, institution, university, department, year, invite-only via
  invite codes, custom question answers) evaluated server-side on submit.
- Review queue: approve / reject / waitlist, bulk actions, capacity limits, notes; approval
  activates the membership. Approval no longer auto-pairs.
- Migrate the current hard-coded mentor/mentee registration into published default forms of
  the first-party programme, keeping `/register` working.

Exit check: AC 4, 6.

## Phase 5 — Mentorship delivery (presenter-led first)

- Presenters: invite or pick members, expertise, `PRESENTER` membership; guest speakers.
- Sessions: create/edit/cancel, multiple presenters, recurring series (RRULE expanded to rows),
  agenda, objectives, materials, Q&A, feedback.
- Session pages for participants; all ACTIVE members see all sessions.
- Attendance: manual + self check-in now; Zoom-sourced in Phase 7. CSV export.
- Resources library (programme, session, milestone level; role-restricted visibility).
- One-to-one: existing pairing UI scoped to programme; manual pairing with capacity view and
  reassignment; hybrid = sessions + selective pairing.
- Module switches hide irrelevant navigation **and** 404 the APIs.

Exit check: AC 10, 11, 12, 13, 17.

## Phase 6 — Gemini matching

- `MatchRecommender` interface; `RulesRecommender` (existing `rankMentors`) and
  `GeminiRecommender` (`@google/genai`, structured JSON output validated by Zod, server-only key
  `GEMINI_API_KEY`).
- Pipeline: collect matching signals from form fields marked `matchingSignal` → hard constraints
  filter (capacity, eligibility, status, explicit preferences, availability) → Gemini scores
  candidate pairs in batches with only anonymised signals → assignment optimiser (greedy with
  capacity, fairness pass, no duplicates) → coordinator review (accept / reject / edit / rerun /
  approve) → write `Pairing` rows.
- Persist `MatchingRun` (provider, model, algorithm version, config snapshot) and every
  `MatchRecommendation` + decision.
- Fallback to rules engine when Gemini is unavailable; never silently.

Exit check: AC 15, 16.

## Phase 7 — Zoom

- `MeetingProvider` interface; Zoom implementation extends existing Server-to-Server OAuth helper:
  create / update / cancel / recurring, waiting room, passcode, alternative hosts.
- Meeting SDK: server endpoint signs the SDK JWT only for ACTIVE members of the session's
  programme; Component View embedded on the session page. Clearly labelled "Open in Zoom" when
  the embed is unavailable — never presented as embedded when it is a link.
- Webhooks `/api/webhooks/zoom` (signature verification, URL validation challenge, idempotency
  via `ProcessedWebhook`): meeting started/ended, participant joined/left → `SessionAttendance`.
- Programme-specific Zoom credentials (encrypted) with platform account as default.
- External-link fallback when Zoom is not configured.

Exit check: AC 14.

## Phase 8 — Communications

- `EmailProvider` abstraction over Nodemailer; `EmailDelivery` log with dedup keys.
- Sender identities: Menty verified sender + coordinator Reply-To by default; custom From only
  after verification (verification email to the address; domain-level via DNS/DKIM if the
  provider supports it).
- DB email templates with variables, preview and test send; platform defaults + programme
  overrides; branded layout with programme logo/colours.
- Programme announcements with role audiences; emails respect notification preferences.
- Reminders: rows created when sessions/meetings/milestones/deadlines are scheduled
  (configurable offsets, e.g. 24h and 1h) → cron dispatcher every 15 min (Vercel cron) claims due
  rows with `FOR UPDATE SKIP LOCKED`, sends, marks SENT. Existing weekly and meeting reminder
  crons folded in.

Exit check: AC 18, 19.

## Phase 9 — Milestones and analytics

- Seed three templates; "start from template" copies into editable `Milestone` rows.
- Milestone CRUD, reorder, due dates, mandatory/optional, resources, assign to all / roles /
  selected participants, completion modes including auto-on-attendance.
- Participant checklist with completed / pending / overdue and progress %; submissions and
  coordinator review; mentors see only their mentees' or sessions' milestones.
- Analytics: programme (registrations, approval rate, attendance rate per session, milestone
  completion, pairing health), institution (roll-up of its programmes), platform.

Exit check: AC 20, 21.

## Phase 10 — Testing, contract migration, deployment

- Full acceptance-criteria test pass (scripted where possible as integration tests against a
  Neon test branch).
- Contract migration: `programId` NOT NULL where planned, drop MENTOR/MENTEE from `User.role`,
  drop the October-era unused columns.
- Load check on marketplace and dashboard queries; index review.
- Production build, deploy, smoke test, rollback plan (Neon point-in-time restore + previous
  Vercel deployment).

## Migration safety rules (all phases)

1. Forward-only Prisma migrations, created with `prisma migrate dev` against a Neon **branch**,
   never against production.
2. Expand → migrate data → switch code → contract, in separate deploys.
3. Data migrations are idempotent and contain literal values only.
4. Before each production deploy: Neon branch of production → `prisma migrate deploy` →
   verification queries → app smoke test on a Vercel preview pointed at that branch.
5. No `DELETE` of user or historical rows in any migration. Retired data is archived by status.
6. Keep `vercel.json`'s `prisma migrate deploy` in the build, but add a guard: CI fails if a
   migration file contains psql meta-syntax (`:'`, `\set`, `\i`).

## Acceptance criteria → phase

| # | Criterion | Phase |
| --- | --- | --- |
| 1 | Super Admin creates institution, assigns Institution Admin | 2 |
| 2 | Institution Admin creates multiple programmes | 2 |
| 3 | Super Admin creates independent programmes | 2 |
| 4 | Cross-university programme | 4 |
| 5 | Programme branding | 2 |
| 6 | Forms without code | 4 |
| 7 | Multiple programmes, one account | 3 |
| 8 | Mentee in one, mentor in another | 1 (data) / 3 (UI) |
| 9 | Coordinate one, participate in another | 1 / 3 |
| 10 | 80 participants, 4 presenters | 5 |
| 11 | One presenter, many sessions | 5 |
| 12 | Many presenters, one session | 5 |
| 13 | All approved participants access sessions | 5 |
| 14 | Zoom meetings for sessions | 7 |
| 15 | Gemini-assisted matching | 6 |
| 16 | Matching respects capacity | 6 |
| 17 | Hybrid programmes | 5 |
| 18 | Branded emails, verified senders | 8 |
| 19 | Automatic meeting reminders | 8 |
| 20 | Custom milestones from templates | 9 |
| 21 | Participant progress | 9 |
| 22 | Institution Admin isolation | 1 |
| 23 | Coordinator isolation | 1 |
| 24 | Accounts and history survive | 1 |
| 25 | Volunteer network still works | 1 / 3 |

## New environment variables (introduced in the phase that needs them)

| Variable | Phase | Notes |
| --- | --- | --- |
| `INTEGRATION_ENCRYPTION_KEY` | 2 | 32-byte key for programme-level secrets |
| `BLOB_READ_WRITE_TOKEN` (if Vercel Blob) | 2 | Uploads |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 6 | Server-only |
| `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET` | 7 | Meeting SDK signing (separate from the existing S2S OAuth vars) |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | 7 | Webhook verification |
| `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME` | 8 | Verified Menty sender |
| `CRON_SECRET` | 8 | Already expected by Vercel cron auth |
