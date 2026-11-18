# Phase 0 — Data Model Diagrams

Derived from `03-proposed-schema.prisma`. Split into four views so each stays readable; GitHub
renders these Mermaid blocks directly.

## 1. Tenancy and access

```mermaid
erDiagram
    User ||--o{ RoleAssignment : "holds"
    AdminRole ||--o{ RoleAssignment : "grants permissions via"
    Institution ||--o{ RoleAssignment : "scopes (INSTITUTION)"
    MentorshipProgram ||--o{ RoleAssignment : "scopes (PROGRAM)"

    User ||--o{ InstitutionMembership : "affiliated with"
    Institution ||--o{ InstitutionMembership : "has members"
    Institution ||--o{ InstitutionDomain : "verifies emails by"
    Institution ||--o{ InstitutionTheme : "brands with"

    Institution |o--o{ MentorshipProgram : "owns (ownerType=INSTITUTION)"
    User |o--o{ MentorshipProgram : "owns (ownerType=INDEPENDENT)"
    MentorshipProgram ||--o{ ProgramTheme : "DRAFT + PUBLISHED"
    MentorshipProgram ||--o{ ProgramTransfer : "ownership history"

    User ||--o{ ProgramMembership : "participates as"
    MentorshipProgram ||--o{ ProgramMembership : "has participants"
    MentorshipProgram ||--o{ Semester : "cohorts"
    Semester |o--o{ ProgramMembership : "intake of"

    RoleAssignment {
        string userId
        string roleId
        enum scopeType "PLATFORM | INSTITUTION | PROGRAM"
        string institutionId "nullable"
        string programId "nullable"
    }
    ProgramMembership {
        string programId
        string userId
        enum role "MENTOR | MENTEE | PRESENTER | FACILITATOR | PARTICIPANT"
        enum status "PENDING | ACTIVE | ..."
    }
    MentorshipProgram {
        enum ownerType "PLATFORM | INSTITUTION | INDEPENDENT"
        enum deliveryModel "PRESENTER_LED | ONE_TO_ONE | HYBRID"
        enum visibility "PUBLIC | UNLISTED | PRIVATE"
        json eligibility
    }
```

One user, many programmes, different roles: `ProgramMembership` is unique per
`(programId, userId, role)`, so the same `User` can appear as MENTEE in A, MENTOR in B and
PRESENTER + MENTOR in C, while a `RoleAssignment` makes them coordinator of D.

## 2. Registration

```mermaid
erDiagram
    MentorshipProgram ||--o{ RegistrationForm : "per role, versioned"
    RegistrationForm ||--o{ FormField : "ordered fields"
    RegistrationForm ||--o{ ProgramApplication : "answered by"
    User ||--o{ ProgramApplication : "submits"
    ProgramApplication ||--o| ProgramMembership : "approval creates/activates"
    ProgramApplication ||--o{ FileUpload : "attachments"

    ProgramApplication {
        json answers "fieldKey -> value"
        int formVersion "snapshot"
        enum status "SUBMITTED ... APPROVED"
    }
```

## 3. Delivery: presenter-led, one-to-one, hybrid

```mermaid
erDiagram
    MentorshipProgram ||--o{ MentorshipSession : "schedules"
    MentorshipSession ||--o{ SessionPresenter : "1..n presenters"
    User ||--o{ SessionPresenter : "presents many sessions"
    MentorshipSession ||--o{ SessionAttendance : "who joined"
    MentorshipSession ||--o| Meeting : "Zoom / link / in person"
    MentorshipSession ||--o{ SessionQuestion : "Q&A"
    MentorshipSession ||--o{ SessionFeedback : "ratings"
    MentorshipSession ||--o{ Resource : "materials"

    MentorshipProgram ||--o{ Pairing : "one-to-one only"
    ProgramMembership ||--o{ Pairing : "mentor side / mentee side"
    Pairing ||--o{ Meeting : "meeting log"

    MentorshipProgram ||--o{ MatchingRun : "AI or rules"
    MatchingRun ||--o{ MatchRecommendation : "scored pairs"
    MatchRecommendation ||--o| Pairing : "accepted into"
```

Presenter-led audience is **implicit**: every ACTIVE membership in the programme may attend
every session. There is no group table and no pre-assignment, which is what keeps it from
turning into small-group mentorship. `SessionAttendance` rows record what actually happened.

Hybrid = both halves at once: sessions for every member, plus `Pairing` rows for the members a
coordinator selects.

## 4. Progress and communications

```mermaid
erDiagram
    MilestoneTemplate ||..o{ Milestone : "copied into (no FK)"
    MentorshipProgram ||--o{ Milestone : "checklist"
    Milestone ||--o{ MilestoneProgress : "per participant"
    User ||--o{ MilestoneProgress : "tracks"
    Milestone |o--o{ Resource : "attached"
    MentorshipSession |o--o{ Milestone : "auto-complete on attendance"

    MentorshipProgram ||--o{ Announcement : "audience by programme role"
    MentorshipProgram ||--o{ EmailTemplate : "overrides platform defaults"
    MentorshipProgram ||--o{ SenderIdentity : "verified From / Reply-To"
    MentorshipProgram ||--o{ Reminder : "scheduled"
    Reminder ||--o{ EmailDelivery : "dedupKey prevents repeats"
    User ||--o{ EmailDelivery : "receives"
    User ||--o| NotificationPreference : "opts out"
    MentorshipProgram ||--o{ Integration : "programme Zoom etc."
```

## Legacy data after migration

```mermaid
flowchart LR
    U[Existing User rows] -->|unchanged ids, emails, passwords| U2[User]
    S[Semester rows] -->|programId = first-party programme| C[Cohort]
    MP[MentorProfile] -->|membership MENTOR| M1[ProgramMembership]
    ME[MenteeProfile] -->|membership MENTEE| M2[ProgramMembership]
    P[Pairing] -->|programId + membership ids| P2[Pairing]
    MT[Meeting] -->|programId| MT2[Meeting]
    A[Announcement] -->|programId| A2[Announcement]
    AD[User.role = ADMIN] -->|RoleAssignment super_admin PLATFORM| RA[RoleAssignment]
```
