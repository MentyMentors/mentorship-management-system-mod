# Phase 2 — Programme creation and customisation

## What it adds

| Area | Where |
| --- | --- |
| Programme hub (my programmes, institutions, incoming transfers, review queue) | `/manage` |
| Programme creation wizard: basics → branding → mentorship model → registration → communications → preview | `/manage/programs/new` |
| Programme settings: overview & lifecycle, details, branding, model, registration, communications, team, ownership | `/manage/programs/[id]` |
| Register an institution (reviewed by Menty) / add one directly (Super Admin) | `/manage/institutions/new` |
| Institution profile, branding, administrators, programmes | `/manage/institutions/[id]` |
| Verification queue (Super Admin) | `/manage/verification` |
| Public programme page (themed, "Powered by Menty") and staff preview | `/p/[slug]`, `/p/[slug]?preview=1` |
| Accept an invitation (creates an account if needed) | `/invite/[token]` |

APIs: `/api/programs`, `/api/programs/[id]` (+ `actions`, `theme`, `team`, `transfer`),
`/api/transfers/[id]`, `/api/institutions` (+ `[id]`, `[id]/admins`), `/api/invites/[token]`,
`/api/uploads`.

## Rules worth knowing

- **Who can create what.** Any signed-in user can start an *independent* programme and becomes
  its owner and coordinator. Institution administrators create programmes for their institution
  and may choose not to coordinate them. Only a Super Admin creates Menty's own programmes.
- **Lifecycle.** Draft → Published → Running ⇄ Paused → Completed; Archive/Restore at any point.
  Publishing needs a description. Super Admins can suspend (locks coordinators out) and verify.
  The platform setting `programs.independent_requires_verification` (default `false`) makes
  verification mandatory before an independent programme is listed publicly.
- **Visibility.** Public and unlisted programmes are reachable by link once published; private
  ones only by members and staff. Drafts are visible only through the staff preview.
- **Branding.** Each programme has a draft and a published theme, rendered as `--program-*` CSS
  custom properties (`src/lib/theme/tokens.ts`, `ProgramThemeScope`). Colours are validated as
  `#rrggbb` in the API, the database (CHECK constraint) and again when rendered. Text colours on
  coloured surfaces are derived automatically, and publishing is blocked while any pairing fails
  WCAG AA contrast. Menty's own colours remain the default everywhere else.
- **Team.** Coordinators and assistants are appointed by email. Existing accounts get the role
  immediately; anyone else receives a 7-day single-use invitation (stored hashed). A programme
  always keeps at least one coordinator, an institution at least one administrator.
- **Transfers.** An independent programme can ask an institution to take it over. The
  institution's administrators accept or decline. Participants, team and history are untouched.
- **Delivery model** switches dashboard modules on and off (`modulesFor` in
  `src/lib/program-rules.ts`): presenter-led programmes never get pairing or matching.

## Set-up needed

- **Uploads (Vercel Blob):** Vercel → Storage → create a Blob store and connect it to this
  project. That adds `BLOB_READ_WRITE_TOKEN`. Until then, uploads return a clear message and
  coordinators can paste an `https://` image address instead.
- The database migration `20261118000000_programme_customisation` applies automatically on
  deploy. It only adds tables/columns and gives every existing programme Menty's default theme.

## Deliberately left for later phases

- Joining a programme online (registration forms, approvals) — Phases 3–4. The public page shows
  "Online registration coming soon"; the MUBAS programme still links to the original form.
- Email templates, sender identities, Zoom, reminders — the Communications step stores the
  programme contact email now; the rest arrives in Phases 7–8.
