# Phase 0 — Architecture Report

Status: **awaiting approval**. No application code, schema or production data has been changed in
Phase 0. Everything in `docs/phase-0/` is a proposal.

Audited:

- Menty — `MentyMentors/mentorship-management-system-mod` @ `eea7b9d`
- UniSpace — `muwemindovie23-creator/unispace` @ `e0c9b42`

Companion documents:

| File | Contents |
| --- | --- |
| `02-permission-matrix.md` | Roles, scopes, permission keys, who can do what |
| `03-proposed-schema.prisma` | Proposed Prisma schema (target state, reference only) |
| `04-data-model-diagram.md` | Entity relationship diagrams (Mermaid) |
| `05-implementation-plan.md` | Phased plan, migration strategy, acceptance-criteria mapping |

---

## 1. Findings that need a decision before Phase 1

### 1.1 BLOCKER — the existing multi-tenant migration cannot run under Prisma

`prisma/migrations/20261023000000_multitenant_core/migration.sql` backfills legacy data using
**psql variables** (`:'legacy_institution'`, `:'legacy_program'`). Those are a feature of the
`psql` command-line client, not of PostgreSQL. `vercel.json` runs
`prisma migrate deploy` during every build, and Prisma sends the file straight to the database,
where `:'legacy_institution'` is a syntax error.

Likely consequences, depending on whether a deploy has run since this file was added:

- The migration is recorded as **failed** in `_prisma_migrations`, and every later
  `prisma migrate deploy` refuses to run (Prisma error P3009), so **Vercel builds fail**.
- The DDL in the same file was probably rolled back with it, so the new tables do not exist in
  production.

**Action needed from you:** check the latest Vercel deployment for this repo. If it failed at
`prisma migrate deploy`, production is still running the previous successful build and no data
has been touched. Phase 1 replaces this file (see §6) with a migration that Prisma can run and
that names nothing via variables.

### 1.2 The multi-tenant tables exist only on paper

The October work added `Institution`, `MentorshipProgram`, `ProgramCoordinator`,
`ProgramMembership`, `RegistrationForm`, `FormQuestion` and `ProgramApplication` to the schema,
plus guards in `src/lib/authz.ts`. **No route, page or component uses any of them.** Every API
route still calls `requireSession(["ADMIN"])` against the global `User.role`, and middleware still
routes `/mentor` and `/mentee` by global role. That is good news: we can still reshape these
tables freely, because nothing depends on them and (per 1.1) they are probably not in production.

### 1.3 Who owns the existing data?

The README describes the current deployment as *the Faculty of Engineering mentorship programme*,
while the homepage and the brief describe *Menty's own volunteer mentor network*. The backfill
must put existing semesters, profiles, pairings, meetings and announcements under exactly one
programme. Options:

1. **(Recommended)** A first-party programme, owned by the platform — "Menty Volunteer Mentor
   Network" — with no institution. This keeps "Find your mentor" working unchanged.
2. Under an institution (for example MUBAS), as the October migration assumed.

Either can later move to the other without data loss (see §4.4 ownership transfer).

### 1.4 Baseline health of the current code

- Tests: **54 pass, 3 fail** (`validators.test.ts` expects a hard-coded department list that has
  since moved to the database; two `register-api` integration tests are stale for the same
  reason). Two more test files cannot load without a generated Prisma client.
- `prisma generate` could not run in the audit sandbox (engine download blocked), so typecheck
  could not be confirmed here. It needs to be run on a developer machine or in CI before Phase 1.

---

## 2. What Menty has today

| Area | Implementation | Verdict |
| --- | --- | --- |
| Auth | Auth.js v5 credentials, JWT (8h), bcrypt, email verification, password reset | **Retain.** Extend the session with a `sessionVersion` check so role changes take effect immediately. |
| Users | `User.role` ∈ {ADMIN, MENTOR, MENTEE}, `User.status` approval gate | **Refactor.** `role` becomes "is platform staff" only; participation moves to memberships. Global approval is replaced by per-programme registration approval. |
| Registration | One hard-coded mentor form and one mentee form (`/api/register`, Zod discriminated union) bound to "the active semester" | **Refactor** into the dynamic form builder; the current fields become the default form of the first-party programme. |
| Profiles | `MentorProfile` / `MenteeProfile` per semester (department, interests, capacity, hours) | **Retain** as the one-to-one matching inputs, scoped through the cohort to a programme. |
| Pairing | `src/lib/pairing.ts`: pure ranking + transactional capacity re-check + waitlist | **Retain.** Becomes the deterministic "assignment engine" in Phase 6; Gemini only proposes scores. |
| Cohorts | `Semester` (dates, active, registration open, archived) | **Retain** as `Cohort`, scoped to a programme. Keep the table name; rename in Prisma only (`@@map`). |
| Meetings | `Meeting` per pairing, optional Zoom link via Server-to-Server OAuth (`src/lib/zoom.ts`) | **Retain and extend**: meetings attach to either a pairing or a session. |
| Messaging | 1:1 `Message` | **Retain**; add optional `programId` so contact lists are programme-aware. |
| Announcements / bulk email | Global audience by global role, chunked SMTP sending | **Refactor** to programme scope with programme roles as audience. |
| Email | Nodemailer pool to Hostinger SMTP, HTML templates in code | **Extend** behind a provider interface with sender identities and DB templates. |
| Cron | Vercel crons: weekly reminders, daily meeting reminders | **Retain**; replace with a reminder table + idempotent dispatcher. |
| Audit | `AuditLog` with actor/action/target/metadata (+ institution/programme columns) | **Retain**; add UniSpace's secret scrubbing. |
| Catalogs | Department, `Programme` (*academic* programme), Interest, StrongModule | **Retain.** Note the naming clash: `Programme` here means *degree programme*. The new entity stays `MentorshipProgram` in code. |
| UI | shadcn/ui, sidebar dashboards per global role, light/dark via next-themes | **Retain components**; dashboards become programme-aware. |
| Domain allowlist | `src/lib/domains.ts` exact-match institutional email domains | **Repurpose**: proves *affiliation* (a profile attribute and an eligibility input), never gates platform access. |

## 3. What to borrow from UniSpace

UniSpace is a different product (campus life, Next 16, first-party auth), so we take its
**patterns**, not its code wholesale.

| UniSpace pattern | Where it lives there | How Menty adopts it |
| --- | --- | --- |
| Permission keys in code, role→permission grants in the database, scoped assignments | `lib/rbac/permissions.ts`, `AdminRole`, `AdminAssignment` | Same three pieces. Scopes become **PLATFORM / INSTITUTION / PROGRAM**. Code checks `can(actor, PERMISSIONS.X, scope)`, never a role name. |
| Scope rules + escalation tests | `lib/rbac/authorize.ts`, `tests/rbac.test.ts` | Port `can`, `assertCan`, `canGrantRole` almost verbatim; write equivalent horizontal/vertical escalation tests for programmes and institutions. |
| Never trust client-supplied scope ids | `resolveCampusScope` | `resolveProgramScope(resourceId)` loads the resource and returns its real `programId` + `institutionId` before checking. |
| Theme as a row, rendered as CSS custom properties server-side | `UniversityTheme`, `lib/theme/tokens.ts`, `ThemeScope` | `ProgramTheme` (DRAFT + PUBLISHED rows) → `--program-*` variables → Tailwind utilities. Same for `InstitutionTheme`. |
| Contrast gate on publish | `auditThemeContrast` | Block publishing a programme theme that fails WCAG AA. |
| Draft / published content | `ContentStatus` | Programme and form publishing use the same idea; preview reads the DRAFT. |
| Editable platform settings | `PlatformSetting` | `PlatformSetting` for defaults (Menty branding, default reminder offsets, feature switches). |
| Instant revocation | `AdminUser.sessionEpoch` | `User.sessionVersion`, checked in the Auth.js `jwt` callback (Node runtime). |
| Audit secret scrubbing | `lib/audit.ts` | Port. |
| Admin invites, no public admin sign-up | `AdminInvite` | Institutional admins and coordinators are invited; programme *creators* self-serve. |

Deliberately **not** adopted: UniSpace's separate `AdminUser` table. In Menty one person can be a
mentee in one programme and a coordinator in another, so administrators and participants must be
the same `User`.

---

## 4. Target architecture

### 4.1 Tenancy model

```
Platform (Menty)
├── Institution (optional owner, has admins, branding, verified domains)
│     └── MentorshipProgram  (ownerType = INSTITUTION)
└── MentorshipProgram        (ownerType = PLATFORM  → Menty's own volunteer network)
                              (ownerType = INDEPENDENT → lecturer / organisation / group)
      ├── Cohort (was Semester)          optional time-boxed intake
      ├── ProgramMembership (user × role) MENTOR | MENTEE | PRESENTER | FACILITATOR | PARTICIPANT
      ├── RoleAssignment (scope=PROGRAM)  coordinators and other programme staff
      ├── RegistrationForm → FormField → FormSubmission
      ├── MentorshipSession → SessionPresenter / SessionAttendance / Meeting
      ├── Pairing (one-to-one / hybrid only) → MatchingRun → MatchRecommendation
      ├── Milestone → MilestoneProgress
      ├── Resource, Announcement, EmailTemplate, Reminder
      └── ProgramTheme (DRAFT/PUBLISHED)
```

The **programme is the tenant boundary**. Every programme-owned row carries `programId`
directly (not only via a cohort), so a single indexed predicate enforces isolation.

### 4.2 Identity and roles

- One `User` per person. `User.role` is narrowed in meaning to "platform account type" and stops
  driving navigation. Its MENTOR/MENTEE values are retired at the end (Phase 10 clean-up).
- **Administrative power** = `RoleAssignment(userId, roleId, scopeType, institutionId?, programId?)`.
  Built-in roles: Super Admin (PLATFORM), Institution Admin (INSTITUTION), Programme Coordinator
  (PROGRAM), plus optional Programme Assistant (PROGRAM, read + communications). Roles are rows;
  their permission lists are editable by the Super Admin.
- **Participation** = `ProgramMembership(programId, userId, role, status)`, unique per
  `(programId, userId, role)` so one person can be MENTOR and PRESENTER in the same programme.
- Institutional affiliation = `InstitutionAffiliation` (profile attribute, verified by email
  domain or by an institution admin). It is an *input* to eligibility rules, never a platform
  gate. An Institution Admin is **not** implicitly a coordinator of their programmes; they hold
  institution-scope permissions to *manage* programmes and appoint coordinators, and the
  matrix spells out what they can see inside a programme.

### 4.3 Authorisation flow (every sensitive operation)

```
request → middleware (signed in? that's all)
        → route/page guard:
            actor = loadActor(session.userId)                 // assignments + memberships, cached per request
            scope = resolveScope(resourceId)                  // from the DB, never from the body
            assertCan(actor, PERMISSIONS.X, scope)            // permission + scope
            assertOwnership(resource, scope)                  // resource.programId === scope.programId
        → query always filtered by programId
```

Programme-participant capabilities ("a mentee can see their sessions") are derived from
`ProgramMembership` through a fixed membership→permission map in code, checked the same way.

### 4.4 Ownership transfer (independent → institution)

`MentorshipProgram.ownerType` + `institutionId` change in one audited transaction initiated by
the programme owner and accepted by an Institution Admin. Memberships, sessions, pairings and
history keep their `programId`, so nothing moves. Previous coordinators keep their assignments
unless the institution removes them.

### 4.5 Programme-specific modules

`MentorshipProgram.deliveryModel` ∈ {PRESENTER_LED, ONE_TO_ONE, HYBRID} plus
`enabledModules` (feature switches) decide which dashboard sections and API routes are live for
that programme. A presenter-led programme simply has no Pairings / Matching module; the API
returns 404 for those routes rather than relying on hidden links.

### 4.6 Theming

- Menty's current tokens stay the default `:root` theme.
- Inside `/p/[slug]/…` (public) and `/dashboard/programs/[programId]/…` a server-rendered
  `ProgramThemeScope` sets `--program-primary`, `--program-secondary`, `--program-accent`,
  `--program-background`, `--program-foreground` (+ contrast tokens and radius).
- `tailwind.config.ts` maps `brand`, `brand-secondary`, `brand-accent` utilities to those
  variables with Menty fallbacks, so components never name a programme.
- Light/dark preference per programme sets the default for `next-themes` inside that scope.
- "Powered by Menty" lives in the programme layout footer.

### 4.7 Integrations (server-side only, behind interfaces)

| Concern | Interface | First implementation | Fallback |
| --- | --- | --- | --- |
| Email | `EmailProvider.send()` | Existing Nodemailer SMTP | — |
| Sender identity | `SenderIdentity` rows (verified address or domain) | Verified Menty sender + `Reply-To` coordinator | Always available |
| AI matching | `MatchRecommender.recommend()` | Google Gemini (structured JSON output) | Existing rule-based `rankMentors` |
| Meetings | `MeetingProvider.create/update/cancel()` | Zoom Server-to-Server OAuth (extends `src/lib/zoom.ts`) | External link entered by coordinator |
| In-app join | Zoom Meeting SDK signature endpoint | Server-signed JWT, Component View | "Open in Zoom" link, labelled as external |
| File storage | `StorageProvider.put()` | **Decision needed** — Vercel Blob is the lowest-friction fit | Links only |
| Background jobs | `Reminder` table + Vercel cron dispatcher | Existing cron routes | — |

Credentials live in environment variables (platform-wide) or in `Integration.secretRef` pointing
at an encrypted value (programme-specific Zoom accounts). Nothing secret is sent to the browser.

---

## 5. Retained / refactored / extended — summary

- **Retained as-is:** Auth.js setup, password/verification/reset tokens, rate limiting, sanitizer,
  CSV helpers, shadcn/ui components, catalog tables, messaging, issue reports.
- **Refactored:** `User.role` semantics, middleware routing, `authz.ts` (permission-key based),
  registration (form builder), announcements and bulk email (programme scope), dashboards
  (unified + per-programme), Zoom helper (provider interface), mailer (provider + identities).
- **Extended:** `Semester` → programme cohort; `Meeting` → pairing *or* session; `AuditLog`
  scope columns; pairing engine → assignment engine for AI recommendations.
- **New:** institutions, roles/assignments, programme theme, delivery models, sessions and
  presenters, attendance, resources, milestones, matching runs, email templates, sender
  identities, reminders, integrations, public marketplace.
- **Replaced:** the October `20261023000000_multitenant_core` migration (see §1.1).

## 6. Migration strategy (summary — detail in `05-implementation-plan.md`)

1. **Expand, never contract, until the end.** Every new column is nullable or defaulted; old
   columns are read until the code stops reading them.
2. **Replace the broken October migration** before it is ever applied successfully:
   - if `_prisma_migrations` shows it **failed**: `prisma migrate resolve --rolled-back
     20261023000000_multitenant_core`, then delete that folder in the same commit that adds the
     new Phase 1 migration;
   - if it never ran (no row): delete and replace;
   - if it somehow **succeeded**: keep it and write Phase 1 as a forward migration.
3. **Backfill as data migrations Prisma can run**: plain SQL with literal values for the
   first-party programme, idempotent (`ON CONFLICT DO NOTHING`, `WHERE … IS NULL`).
4. **Rehearse on a Neon branch** of production first (Neon branches are copy-on-write and free
   to discard), run the verification queries, then deploy.
5. **Contract last** (Phase 10): make `programId` NOT NULL, drop MENTOR/MENTEE from `User.role`,
   only after every read has moved.
6. No row is ever deleted by a migration. Existing users keep their IDs, emails and passwords.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Cross-tenant leaks through a forgotten `where` | Central `scopedDb(programId)` helpers + an integration test per route that calls it as a user from another programme. |
| JWT carries stale role after a change | `sessionVersion` check in the Node `jwt` callback; permissions never stored in the token. |
| Coordinator email spoofing | Only verified sender identities; otherwise Menty sender + Reply-To. SPF/DKIM/DMARC on Menty's domain. |
| Zoom free/Basic account limits (40-minute meetings, one concurrent meeting per host) | Per-programme Zoom integration; surface limits in the UI; external-link fallback. |
| Gemini output not trustworthy | Structured output with schema validation; deterministic engine enforces capacity and rules; coordinator approval required before anything is written as ACTIVE. |
| Data protection (Malawi Data Protection Act 2024) when sending profiles to Gemini | Send only fields a coordinator marks as matching inputs; no names/emails; document in privacy policy; per-programme opt-in. |
| Scope creep — this brief is large | Ten phases, each shippable and reviewed; acceptance criteria mapped to phases. |

## 8. Questions for you

1. Did the latest Vercel deployment fail at `prisma migrate deploy`? (§1.1)
2. Existing data: first-party "Menty Volunteer Mentor Network" (recommended) or under an
   institution? (§1.3)
3. File storage for logos, covers and resources: Vercel Blob OK?
4. Zoom: one Menty-owned Zoom account to start, with programme-specific accounts later?
5. Email: which domain will Menty send from (needed for SPF/DKIM), and is Hostinger SMTP staying?
6. Programme URLs: `menty…/p/<slug>` path-based (recommended) or subdomains per programme?
