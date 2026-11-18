# Phase 0 — Role and Permission Matrix

Model (adopted from UniSpace):

1. **Permission keys** are declared once in code (`src/lib/rbac/permissions.ts`).
2. **Roles** are database rows listing permission keys. Built-in roles are `isSystem` and cannot
   be deleted; a Super Admin can create new roles without code changes.
3. **Assignments** bind a user to a role at a **scope**: `PLATFORM`, `INSTITUTION` (institutionId)
   or `PROGRAM` (programId).
4. **Participant roles** (MENTOR, MENTEE, PRESENTER, FACILITATOR, PARTICIPANT) come from
   `ProgramMembership` and map to a fixed set of participant permissions in code.

Server code checks `can(actor, PERMISSION, { institutionId, programId })` — never a role name.

## Scope rules

| Assignment scope | Covers |
| --- | --- |
| PLATFORM | Everything. |
| INSTITUTION | The institution's own record, and every programme whose `institutionId` matches. Not independent or platform-owned programmes, not other institutions. |
| PROGRAM | That one programme only. Not its institution, not sibling programmes. |
| Membership | That one programme, and only the participant permissions of the role(s) held. |

The scope is always resolved from the database (`resolveProgramScope`) from the resource being
touched. A programmeId or institutionId in the request body is only ever a lookup key.

Escalation guard (`canGrantRole`): you may only grant a role whose permissions you already hold,
within a scope you already cover, and only if you hold `role.assign` there.

## Permission keys

| Group | Keys |
| --- | --- |
| Platform | `platform.settings.manage`, `platform.audit.read`, `platform.integrations.manage`, `platform.analytics.read`, `platform.branding.manage` |
| Users | `user.read`, `user.suspend`, `user.impersonate` *(not granted by default)* |
| Roles | `role.manage`, `role.assign` |
| Institutions | `institution.create`, `institution.update`, `institution.branding.edit`, `institution.suspend`, `institution.verify`, `institution.analytics.read` |
| Programmes | `program.create`, `program.read`, `program.update`, `program.publish`, `program.archive`, `program.suspend`, `program.verify`, `program.transfer`, `program.branding.edit`, `program.settings.manage` |
| Coordinators | `program.coordinator.assign` |
| Registration | `form.manage`, `registration.read`, `registration.review` |
| Participants | `participant.read`, `participant.manage` |
| Sessions | `session.manage`, `session.read`, `attendance.read`, `attendance.export` |
| Pairing | `pairing.read`, `pairing.manage`, `matching.run`, `matching.approve` |
| Meetings | `meeting.manage` |
| Communications | `announcement.send`, `email.send`, `email.template.manage`, `sender.identity.manage`, `reminder.manage` |
| Milestones | `milestone.manage`, `milestone.review` |
| Resources | `resource.manage` |
| Analytics | `program.analytics.read` |
| Audit | `program.audit.read` |

## Built-in administrative roles

✓ = granted, — = not granted. Each column applies **only within that role's scope**.

| Permission | Super Admin (PLATFORM) | Institution Admin (INSTITUTION) | Programme Coordinator (PROGRAM) | Programme Assistant (PROGRAM) |
| --- | :-: | :-: | :-: | :-: |
| platform.* | ✓ | — | — | — |
| user.read (all users) | ✓ | — ¹ | — ¹ | — ¹ |
| user.suspend | ✓ | — | — | — |
| role.manage | ✓ | — | — | — |
| role.assign | ✓ | ✓ (institution & its programmes) | ✓ (own programme, up to Coordinator) | — |
| institution.create | ✓ | — | — | — |
| institution.update / branding.edit | ✓ | ✓ | — | — |
| institution.verify / suspend | ✓ | — | — | — |
| institution.analytics.read | ✓ | ✓ | — | — |
| program.create | ✓ | ✓ (under institution) | — ² | — |
| program.read | ✓ | ✓ | ✓ | ✓ |
| program.update / settings.manage / branding.edit | ✓ | ✓ | ✓ | — |
| program.publish | ✓ | ✓ | ✓ ³ | — |
| program.archive | ✓ | ✓ | — | — |
| program.verify / suspend | ✓ | — | — | — |
| program.transfer | ✓ | ✓ (accept into institution) | ✓ (owner only, initiate) | — |
| program.coordinator.assign | ✓ | ✓ | ✓ (owner only) | — |
| form.manage | ✓ | — ⁴ | ✓ | — |
| registration.read | ✓ | ✓ | ✓ | ✓ |
| registration.review | ✓ | — ⁴ | ✓ | ✓ |
| participant.read | ✓ | ✓ | ✓ | ✓ |
| participant.manage | ✓ | — ⁴ | ✓ | — |
| session.manage / meeting.manage | ✓ | — ⁴ | ✓ | ✓ |
| attendance.read / export | ✓ | ✓ | ✓ | ✓ |
| pairing.read | ✓ | ✓ | ✓ | ✓ |
| pairing.manage / matching.run / matching.approve | ✓ | — ⁴ | ✓ | — |
| announcement.send / email.send | ✓ | — ⁴ | ✓ | ✓ |
| email.template.manage / sender.identity.manage / reminder.manage | ✓ | — ⁴ | ✓ | — |
| milestone.manage | ✓ | — ⁴ | ✓ | — |
| milestone.review | ✓ | — ⁴ | ✓ | ✓ |
| resource.manage | ✓ | — ⁴ | ✓ | ✓ |
| program.analytics.read | ✓ | ✓ | ✓ | ✓ |
| program.audit.read | ✓ | ✓ | ✓ | — |

¹ Admins see users only through the programmes or institution they manage (participants,
registrants, coordinators), never a platform-wide user directory.
² Any signed-in user can create an **independent** programme; that is a self-service action
(`program.create.independent` granted to every authenticated user), and it makes them the
programme's owner-coordinator.
³ Publishing an **independent** programme to the public marketplace may require Super Admin
verification first, controlled by a platform setting.
⁴ "Not automatically the coordinator": an Institution Admin oversees, reports and appoints, but
does not run day-to-day operations unless they also assign themselves as coordinator (which is
audited). This matches the brief; flip these to ✓ if you prefer institution admins to have full
operational control.

## Participant permissions (from ProgramMembership, ACTIVE only)

| Capability | Mentor | Mentee | Presenter | Facilitator | Participant |
| --- | :-: | :-: | :-: | :-: | :-: |
| View programme dashboard, announcements, resources | ✓ | ✓ | ✓ | ✓ | ✓ |
| View and join programme sessions | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own milestones / submit milestone evidence | ✓ ⁵ | ✓ | — | — | ✓ |
| See assigned mentees and their relevant milestones | ✓ | — | — | — | — |
| See own mentor | — | ✓ | — | — | — |
| Log meetings for own pairing | ✓ | ✓ | — | — | — |
| Upload resources to sessions they present | — | — | ✓ | ✓ | — |
| See registrant list of sessions they present | — | — | ✓ | ✓ | — |
| Message programme contacts | own pairing + coordinators | own pairing + coordinators | coordinators | coordinators | coordinators |

⁵ Mentors see milestones only for their assigned mentees (one-to-one) or for the sessions they
present (presenter-led).

## Escalation tests to write (Phase 1)

- Coordinator of programme A cannot read, update or email programme B (same institution and
  different institution).
- Institution Admin of X cannot touch programmes of Y, or independent programmes.
- Institution Admin cannot reach `platform.*`, `institution.verify`, `role.manage`.
- Coordinator cannot grant Institution Admin or Super Admin.
- Mentee in A who is coordinator in B gains nothing in A from the B role.
- A request with a forged `programId` in the body for a resource in another programme is refused.
- Suspended membership / suspended programme / suspended institution yields no access.
- Role change takes effect on the next request (sessionVersion).
