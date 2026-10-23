-- ============================================================================
-- Menty Multitenant Transformation — Stage 1 migration
--
-- Strategy (staged, non-destructive):
--   1. Introduce new tables and relationships        (this file, section 1)
--   2. Backfill existing records                     (this file, section 2)
--   3. Application code switches reads/writes        (separate commits)
--   4. Obsolete global-role fields removed later     (stage 6, separate
--      migration — only after code no longer reads them)
--
-- Safe to review and run against a DEVELOPMENT database first:
--   createdb menty_dev && psql menty_dev < this file
-- ============================================================================

-- Section 0: extensions used for idempotent backfill keys --------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Section 1: new enums -------------------------------------------------------
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ProgramRole" AS ENUM ('MENTOR', 'MENTEE');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'WAITLISTED');
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "FormFieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'NUMBER', 'DROPDOWN', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'CHECKBOX', 'DATE');

-- Pairing lifecycle gains proposed/cancelled/reassignment states.
-- ADD VALUE is transactional-safe when placed before any use of the value.
ALTER TYPE "PairingStatus" ADD VALUE IF NOT EXISTS 'PROPOSED';
ALTER TYPE "PairingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PairingStatus" ADD VALUE IF NOT EXISTS 'REASSIGNMENT_REQUIRED';

-- Section 1b: scope existing tables ------------------------------------------

-- Semester becomes the cohort table; nullable now, backfilled below,
-- made NOT NULL in stage 6 after all rows are scoped to a programme.
ALTER TABLE "Semester" ADD COLUMN "programId" TEXT;
CREATE INDEX "Semester_programId_idx" ON "Semester"("programId");

ALTER TABLE "Announcement" ADD COLUMN "programId" TEXT;
CREATE INDEX "Announcement_programId_createdAt_idx" ON "Announcement"("programId", "createdAt");

ALTER TABLE "AuditLog" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "programId" TEXT;
CREATE INDEX "AuditLog_institutionId_createdAt_idx" ON "AuditLog"("institutionId", "createdAt");
CREATE INDEX "AuditLog_programId_createdAt_idx" ON "AuditLog"("programId", "createdAt");

-- THE key constraint change: drop the global one-role-per-user constraints.
-- A user may now hold a MentorProfile in programme A and a MenteeProfile in
-- programme B (or multiple cohorts of the same programme).
ALTER TABLE "MentorProfile" DROP CONSTRAINT IF EXISTS "MentorProfile_userId_key";
ALTER TABLE "MenteeProfile" DROP CONSTRAINT IF EXISTS "MenteeProfile_userId_key";
CREATE INDEX "MentorProfile_userId_idx" ON "MentorProfile"("userId");
CREATE INDEX "MenteeProfile_userId_idx" ON "MenteeProfile"("userId");

-- Section 1c: new tables ------------------------------------------------------

CREATE TABLE "Institution" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "status"     "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

CREATE TABLE "InstitutionDomain" (
  "id"              TEXT NOT NULL,
  "institutionId"   TEXT NOT NULL,
  "domain"          TEXT NOT NULL,
  "allowSubdomains" BOOLEAN NOT NULL DEFAULT false,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionDomain_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionDomain_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstitutionDomain_domain_key" ON "InstitutionDomain"("domain");
CREATE INDEX "InstitutionDomain_institutionId_idx" ON "InstitutionDomain"("institutionId");

CREATE TABLE "InstitutionalAffiliation" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "isPrimary"     BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionalAffiliation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstitutionalAffiliation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstitutionalAffiliation_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstitutionalAffiliation_userId_institutionId_key"
  ON "InstitutionalAffiliation"("userId", "institutionId");
CREATE INDEX "InstitutionalAffiliation_institutionId_idx" ON "InstitutionalAffiliation"("institutionId");

CREATE TABLE "MentorshipProgram" (
  "id"                  TEXT NOT NULL,
  "institutionId"       TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "status"              "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "eligibility"         JSONB,
  "matchingPreferences" JSONB,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MentorshipProgram_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MentorshipProgram_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MentorshipProgram_institutionId_name_key"
  ON "MentorshipProgram"("institutionId", "name");
CREATE INDEX "MentorshipProgram_institutionId_status_idx" ON "MentorshipProgram"("institutionId", "status");

CREATE TABLE "ProgramCoordinator" (
  "id"           TEXT NOT NULL,
  "programId"    TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramCoordinator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramCoordinator_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramCoordinator_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProgramCoordinator_programId_userId_key"
  ON "ProgramCoordinator"("programId", "userId");
CREATE INDEX "ProgramCoordinator_userId_idx" ON "ProgramCoordinator"("userId");

-- The core multitenant table. Uniqueness is (program, user, ROLE) — the
-- same user CAN hold MENTOR in one programme and MENTEE in another, and
-- both are recorded here.
CREATE TABLE "ProgramMembership" (
  "id"        TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      "ProgramRole" NOT NULL,
  "status"    "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramMembership_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProgramMembership_programId_userId_role_key"
  ON "ProgramMembership"("programId", "userId", "role");
CREATE INDEX "ProgramMembership_userId_status_idx" ON "ProgramMembership"("userId", "status");
CREATE INDEX "ProgramMembership_programId_status_idx" ON "ProgramMembership"("programId", "status");

CREATE TABLE "RegistrationForm" (
  "id"        TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "role"      "ProgramRole" NOT NULL,
  "name"      TEXT NOT NULL,
  "status"    "FormStatus" NOT NULL DEFAULT 'DRAFT',
  "version"   INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegistrationForm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegistrationForm_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegistrationForm_programId_role_version_key"
  ON "RegistrationForm"("programId", "role", "version");

CREATE TABLE "FormQuestion" (
  "id"            TEXT NOT NULL,
  "formId"        TEXT NOT NULL,
  "key"           TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "description"   TEXT,
  "type"          "FormFieldType" NOT NULL,
  "required"      BOOLEAN NOT NULL DEFAULT false,
  "options"       JSONB,
  "validation"    JSONB,
  "conditionalOn" JSONB,
  "order"         INTEGER NOT NULL,
  CONSTRAINT "FormQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FormQuestion_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FormQuestion_formId_key_key" ON "FormQuestion"("formId", "key");
CREATE INDEX "FormQuestion_formId_order_idx" ON "FormQuestion"("formId", "order");

CREATE TABLE "ProgramApplication" (
  "id"          TEXT NOT NULL,
  "programId"   TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "role"        "ProgramRole" NOT NULL,
  "formId"      TEXT NOT NULL,
  "formVersion" INTEGER NOT NULL,
  "answers"     JSONB NOT NULL,
  "status"      "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewerId"  TEXT,
  "reviewedAt"  TIMESTAMP(3),
  "adminNotes"  TEXT,
  "semesterId"  TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramApplication_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgramApplication_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "RegistrationForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgramApplication_semesterId_fkey"
    FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Partial unique index: at most ONE live application per (program, user,
-- role). Terminal states (REJECTED/WITHDRAWN) free the slot so a user may
-- re-apply. This is a business rule, not a blanket ban on multiple
-- applications across programmes or roles.
CREATE UNIQUE INDEX "ProgramApplication_one_live_per_scope"
  ON "ProgramApplication"("programId", "userId", "role")
  WHERE "status" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'WAITLISTED');
CREATE INDEX "ProgramApplication_programId_status_submittedAt_idx"
  ON "ProgramApplication"("programId", "status", "submittedAt");
CREATE INDEX "ProgramApplication_userId_status_idx" ON "ProgramApplication"("userId", "status");

-- FK from Semester to MentorshipProgram (added after both tables exist).
ALTER TABLE "Semester"
  ADD CONSTRAINT "Semester_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Section 2: BACKFILL of existing Menty data
--
-- The existing single-tenant deployment becomes the first institution and
-- programme. Institution name is configurable via psql variable so no
-- institution is permanently hardcoded:
--   psql -v legacy_institution="'MUBAS'" -v legacy_program="'MEI-MUBAS Engineering Mentorship'" ...
-- ============================================================================

INSERT INTO "Institution" ("id", "name", "code", "status", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text,
        :'legacy_institution',
        upper(regexp_replace(:'legacy_institution', '[^A-Za-z0-9]', '', 'g')),
        'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "MentorshipProgram" ("id", "institutionId", "name", "description", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i.id, :'legacy_program',
       'Migrated from the original single-tenant Menty deployment.',
       'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Institution" i
WHERE i."name" = :'legacy_institution'
ON CONFLICT ("institutionId", "name") DO NOTHING;

-- Every existing cohort/semester now belongs to the legacy programme.
UPDATE "Semester" s
SET "programId" = p.id
FROM "MentorshipProgram" p
WHERE p."name" = :'legacy_program' AND s."programId" IS NULL;

UPDATE "Announcement" a
SET "programId" = p.id
FROM "MentorshipProgram" p
WHERE p."name" = :'legacy_program' AND a."programId" IS NULL;

-- Existing ADMIN users become coordinators of the migrated programme so the
-- current operating team keeps working during the transition. Platform
-- admin (Super Admin) remains governed by User.role = 'ADMIN' until stage 6.
INSERT INTO "ProgramCoordinator" ("id", "programId", "userId", "createdAt")
SELECT gen_random_uuid()::text, p.id, u.id, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "MentorshipProgram" p
WHERE u."role" = 'ADMIN' AND p."name" = :'legacy_program'
ON CONFLICT ("programId", "userId") DO NOTHING;

-- Existing users become programme members with their historical role.
-- Approved users get ACTIVE membership; pending/rejected get INACTIVE so a
-- later approval workflow can activate them per-programme.
INSERT INTO "ProgramMembership" ("id", "programId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p.id, u.id,
       u."role"::"ProgramRole",
       CASE WHEN u."status" = 'APPROVED' THEN 'ACTIVE'::"MembershipStatus"
            ELSE 'INACTIVE'::"MembershipStatus" END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "MentorshipProgram" p
WHERE u."role" IN ('MENTOR', 'MENTEE') AND p."name" = :'legacy_program'
ON CONFLICT ("programId", "userId", "role") DO NOTHING;

-- Validate the backfill before considering section 3 work complete:
--   * every Semester has a programId
--   * every non-admin user has a membership
-- (both queries must return 0)
-- SELECT count(*) FROM "Semester" WHERE "programId" IS NULL;
-- SELECT count(*) FROM "User" u WHERE u."role" IN ('MENTOR','MENTEE')
--   AND NOT EXISTS (SELECT 1 FROM "ProgramMembership" m WHERE m."userId" = u.id);

-- ============================================================================
-- Idempotency note: every backfill statement uses ON CONFLICT DO NOTHING or
-- set-based WHERE ... IS NULL filters, so re-running this migration against
-- a database it has already been applied to creates no duplicate records.
-- ============================================================================
