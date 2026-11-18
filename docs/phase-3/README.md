# Phase 3 — Homepage, marketplace and onboarding

## What it adds

| Area | Where |
| --- | --- |
| Homepage with three entry points: find your mentor, find a programme, run a programme | `/` |
| Menty Volunteer Mentor Network — Menty's own first-party programme | created by migration, `/p/menty-volunteer-mentors` |
| "Find your mentor" / "Become a mentor" (resolves the network from the `platform.volunteer_program_id` setting) | `/find-a-mentor?role=MENTEE\|MENTOR` |
| Programme marketplace: search; filters for organiser, category, format, online/in person, career interest, audience, open now | `/programs` |
| "Run a programme" page for institutions and individuals | `/run` |
| General Menty account (one account for every programme) | `/signup` → email confirmation → log in |
| Join a programme | `/p/[slug]/join` |
| Unified dashboard: programmes and roles, pending registrations, mentorship relationships, upcoming meetings, announcements, notifications | `/dashboard` |
| Programme home for participants, in the programme's branding, with a programme switcher | `/dashboard/programs/[id]` |
| Registrations tab for coordinators: approve, decline, wait-list, remove | Programme settings → Registrations |

## Joining rules (`src/lib/join-rules.ts`)

- **Roles by format:** presenter-led → participant; one-to-one → mentee or mentor; hybrid →
  participant or mentor. Presenters and facilitators are appointed, never self-registered.
- **Eligibility:** open by default and never limited to one university. "Specific institutions"
  is checked against the person's affiliations and verified email domain. Departments, years
  of study and custom criteria are checked by the coordinator (the registration is always
  reviewed). Invite-only programmes refuse self-registration.
- **Status:** over capacity → waiting list (participants and mentees only); approval required or
  criteria to check → awaiting approval; otherwise in straight away. Everyone gets an email.
- The MUBAS engineering programme keeps its original registration form (`/register`), and its
  registrations are still approved under Admin → Users.

## Database

`20261118100000_membership_statuses` (REJECTED, WAITLISTED, WITHDRAWN — enum values in their
own migration) and `20261118100100_join_and_volunteer_network` (registration columns, the
volunteer network programme and its setting). Both expand-only, idempotent, and applied
automatically on deploy.

## Notes

- New accounts are usable once the email is confirmed; each programme approves its own
  participants. Legacy MUBAS accounts still need Admin → Users approval.
- The volunteer network is run by Menty: Super Admins manage it under Programmes and can appoint
  coordinators for it from its Team tab.
- Custom registration questions (instead of the free-text note) arrive in Phase 4.
