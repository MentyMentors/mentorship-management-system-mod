-- ============================================================================
-- Menty multi-tenant foundation (Phase 1)
--
-- Replaces the October 2026 draft of this migration, which used psql-only
-- variables and could not run under `prisma migrate deploy`. On a database
-- where that draft is recorded as failed, first run:
--
--   npx prisma migrate resolve --rolled-back 20261023000000_multitenant_core
--
-- then deploy as normal. See docs/phase-1/DEPLOY.md.
--
-- Expand-only: adds enums, tables and nullable columns, then backfills.
-- No existing row is updated except to set a new programId column, and no
-- row is deleted. PostgreSQL applies it atomically (one multi-statement
-- migration); there is deliberately no explicit BEGIN/COMMIT, so if a
-- statement fails the real error is reported.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Clean up anything a partial run of the October draft may have left.
--    Refuses to continue if any of those objects already holds data.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['ProgramApplication','FormQuestion','RegistrationForm',
    'ProgramMembership','ProgramCoordinator','MentorshipProgram',
    'InstitutionalAffiliation','InstitutionDomain','Institution']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'Table % already contains % rows; refusing to continue', t, n;
      END IF;
      EXECUTE format('DROP TABLE %I CASCADE', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "Semester"     DROP COLUMN IF EXISTS "programId";
ALTER TABLE "Announcement" DROP COLUMN IF EXISTS "programId";
ALTER TABLE "AuditLog"     DROP COLUMN IF EXISTS "institutionId";
ALTER TABLE "AuditLog"     DROP COLUMN IF EXISTS "programId";

DROP TYPE IF EXISTS "InstitutionStatus";
DROP TYPE IF EXISTS "ProgramStatus";
DROP TYPE IF EXISTS "ProgramRole";
DROP TYPE IF EXISTS "MembershipStatus";
DROP TYPE IF EXISTS "ApplicationStatus";
DROP TYPE IF EXISTS "FormStatus";
DROP TYPE IF EXISTS "FormFieldType";

-- The draft dropped these; restore them if they are missing.
CREATE UNIQUE INDEX IF NOT EXISTS "MentorProfile_userId_key" ON "MentorProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MenteeProfile_userId_key" ON "MenteeProfile"("userId");

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
CREATE TYPE "ScopeType" AS ENUM ('PLATFORM', 'INSTITUTION', 'PROGRAM');
CREATE TYPE "InstitutionStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "ProgramOwnerType" AS ENUM ('PLATFORM', 'INSTITUTION', 'INDEPENDENT');
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'SUSPENDED');
CREATE TYPE "ProgramVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "DeliveryModel" AS ENUM ('PRESENTER_LED', 'ONE_TO_ONE', 'HYBRID');
CREATE TYPE "DeliveryMode" AS ENUM ('ONLINE', 'IN_PERSON', 'BLENDED');
CREATE TYPE "MatchingMode" AS ENUM ('MANUAL', 'AUTOMATIC', 'HYBRID');
CREATE TYPE "ProgramRole" AS ENUM ('MENTOR', 'MENTEE', 'PRESENTER', 'FACILITATOR', 'PARTICIPANT');
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'REMOVED');

-- ----------------------------------------------------------------------------
-- 2. New columns on existing tables (all nullable or defaulted)
-- ----------------------------------------------------------------------------
ALTER TABLE "User"         ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Semester"     ADD COLUMN "programId" TEXT;
ALTER TABLE "Pairing"      ADD COLUMN "programId" TEXT;
ALTER TABLE "Meeting"      ADD COLUMN "programId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "programId" TEXT;
ALTER TABLE "AuditLog"     ADD COLUMN "institutionId" TEXT;
ALTER TABLE "AuditLog"     ADD COLUMN "programId" TEXT;

-- ----------------------------------------------------------------------------
-- 3. New tables
-- ----------------------------------------------------------------------------
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Malawi',
    "status" "InstitutionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

CREATE TABLE "InstitutionDomain" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "allowSubdomains" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstitutionDomain_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionDomain_domain_key" ON "InstitutionDomain"("domain");
CREATE INDEX "InstitutionDomain_institutionId_idx" ON "InstitutionDomain"("institutionId");

CREATE TABLE "InstitutionMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "verifiedEmail" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstitutionMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionMembership_userId_institutionId_key" ON "InstitutionMembership"("userId", "institutionId");
CREATE INDEX "InstitutionMembership_institutionId_idx" ON "InstitutionMembership"("institutionId");

CREATE TABLE "MentorshipProgram" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "objectives" TEXT,
    "category" TEXT,
    "targetAudience" TEXT,
    "welcomeMessage" TEXT,
    "ownerType" "ProgramOwnerType" NOT NULL,
    "institutionId" TEXT,
    "ownerUserId" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ProgramVisibility" NOT NULL DEFAULT 'PUBLIC',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "deliveryModel" "DeliveryModel" NOT NULL DEFAULT 'PRESENTER_LED',
    "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'ONLINE',
    "matchingMode" "MatchingMode",
    "enabledModules" TEXT[],
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "durationLabel" TEXT,
    "capacity" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "eligibility" JSONB,
    "matchingConfig" JSONB,
    "careerTags" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MentorshipProgram_pkey" PRIMARY KEY ("id"),
    -- An institution-owned programme must name its institution.
    CONSTRAINT "MentorshipProgram_owner_check" CHECK (
      "ownerType" <> 'INSTITUTION' OR "institutionId" IS NOT NULL
    )
);
CREATE UNIQUE INDEX "MentorshipProgram_slug_key" ON "MentorshipProgram"("slug");
CREATE INDEX "MentorshipProgram_status_visibility_idx" ON "MentorshipProgram"("status", "visibility");
CREATE INDEX "MentorshipProgram_institutionId_status_idx" ON "MentorshipProgram"("institutionId", "status");
CREATE INDEX "MentorshipProgram_ownerType_idx" ON "MentorshipProgram"("ownerType");

CREATE TABLE "ProgramMembership" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProgramRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "cohortId" TEXT,
    "expertise" TEXT[],
    "capacity" INTEGER,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgramMembership_programId_userId_role_key" ON "ProgramMembership"("programId", "userId", "role");
CREATE INDEX "ProgramMembership_userId_status_idx" ON "ProgramMembership"("userId", "status");
CREATE INDEX "ProgramMembership_programId_role_status_idx" ON "ProgramMembership"("programId", "role", "status");

CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowedScopes" "ScopeType"[],
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminRole_key_key" ON "AdminRole"("key");

CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "institutionId" TEXT,
    "programId" TEXT,
    "grantedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id"),
    -- The scope columns must match the scope type exactly.
    CONSTRAINT "RoleAssignment_scope_check" CHECK (
      ("scopeType" = 'PLATFORM'    AND "institutionId" IS NULL     AND "programId" IS NULL) OR
      ("scopeType" = 'INSTITUTION' AND "institutionId" IS NOT NULL AND "programId" IS NULL) OR
      ("scopeType" = 'PROGRAM'     AND "institutionId" IS NULL     AND "programId" IS NOT NULL)
    )
);
CREATE INDEX "RoleAssignment_userId_revokedAt_idx" ON "RoleAssignment"("userId", "revokedAt");
CREATE INDEX "RoleAssignment_institutionId_idx" ON "RoleAssignment"("institutionId");
CREATE INDEX "RoleAssignment_programId_idx" ON "RoleAssignment"("programId");
-- One live assignment per (user, role, scope). Prisma cannot express these.
CREATE UNIQUE INDEX "RoleAssignment_live_platform_key"
  ON "RoleAssignment"("userId", "roleId") WHERE "scopeType" = 'PLATFORM' AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "RoleAssignment_live_institution_key"
  ON "RoleAssignment"("userId", "roleId", "institutionId") WHERE "scopeType" = 'INSTITUTION' AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "RoleAssignment_live_program_key"
  ON "RoleAssignment"("userId", "roleId", "programId") WHERE "scopeType" = 'PROGRAM' AND "revokedAt" IS NULL;

CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- ----------------------------------------------------------------------------
-- 4. Indexes and foreign keys
-- ----------------------------------------------------------------------------
CREATE INDEX "Semester_programId_idx" ON "Semester"("programId");
CREATE INDEX "Pairing_programId_status_idx" ON "Pairing"("programId", "status");
CREATE INDEX "Meeting_programId_date_idx" ON "Meeting"("programId", "date");
CREATE INDEX "Announcement_programId_createdAt_idx" ON "Announcement"("programId", "createdAt");
CREATE INDEX "AuditLog_institutionId_createdAt_idx" ON "AuditLog"("institutionId", "createdAt");
CREATE INDEX "AuditLog_programId_createdAt_idx" ON "AuditLog"("programId", "createdAt");

ALTER TABLE "InstitutionDomain" ADD CONSTRAINT "InstitutionDomain_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionMembership" ADD CONSTRAINT "InstitutionMembership_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramMembership" ADD CONSTRAINT "ProgramMembership_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramMembership" ADD CONSTRAINT "ProgramMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramMembership" ADD CONSTRAINT "ProgramMembership_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. Reference data: built-in administrative roles.
--    Their permission lists are defined in src/lib/rbac/permissions.ts and
--    read from code at runtime; the column is left empty for system roles.
-- ----------------------------------------------------------------------------
INSERT INTO "AdminRole" ("id", "key", "name", "description", "allowedScopes", "permissions", "isSystem", "updatedAt") VALUES
  ('role_super_admin', 'super_admin', 'Super Admin',
   'Full access to the whole Menty platform.',
   ARRAY['PLATFORM']::"ScopeType"[], ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP),
  ('role_institution_admin', 'institution_admin', 'Institution Administrator',
   'Manages one institution, its programmes and their coordinators.',
   ARRAY['INSTITUTION']::"ScopeType"[], ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP),
  ('role_program_coordinator', 'program_coordinator', 'Programme Coordinator',
   'Runs one mentorship programme.',
   ARRAY['PROGRAM']::"ScopeType"[], ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP),
  ('role_program_assistant', 'program_assistant', 'Programme Assistant',
   'Helps run one programme: registrations, sessions and communications, without settings.',
   ARRAY['PROGRAM']::"ScopeType"[], ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Backfill: the existing deployment becomes MUBAS's engineering programme.
--    Names are ordinary data and can be edited from the dashboard later.
-- ----------------------------------------------------------------------------
INSERT INTO "Institution" ("id", "slug", "name", "shortName", "status", "verificationStatus", "verifiedAt", "updatedAt")
VALUES ('inst_mubas', 'mubas', 'Malawi University of Business and Applied Sciences', 'MUBAS',
        'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "MentorshipProgram" (
  "id", "slug", "name", "description", "ownerType", "institutionId", "status", "visibility",
  "verificationStatus", "deliveryModel", "deliveryMode", "matchingMode", "enabledModules",
  "requiresApproval", "careerTags", "publishedAt", "updatedAt")
SELECT 'prog_mubas_engineering', 'mubas-engineering-mentorship',
       'Faculty of Engineering Mentorship Programme',
       'Peer mentorship for engineering students at MUBAS. Migrated from the original Menty deployment.',
       'INSTITUTION', i."id", 'ACTIVE', 'PUBLIC', 'VERIFIED', 'ONE_TO_ONE', 'BLENDED', 'AUTOMATIC',
       ARRAY['pairings','meetings','announcements','messages','cohorts','analytics'],
       true, ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Institution" i WHERE i."slug" = 'mubas'
ON CONFLICT ("slug") DO NOTHING;

-- The programme the original admin screens operate on until Phase 2/3
-- replace them with per-programme dashboards.
INSERT INTO "PlatformSetting" ("key", "value", "description", "updatedAt") VALUES
  ('legacy.default_program_id', 'prog_mubas_engineering',
   'Programme managed by the original admin dashboard and joined by the original registration form.',
   CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Every existing cohort, pairing, meeting and announcement belongs to it.
UPDATE "Semester"     SET "programId" = 'prog_mubas_engineering' WHERE "programId" IS NULL;
UPDATE "Pairing"      SET "programId" = 'prog_mubas_engineering' WHERE "programId" IS NULL;
UPDATE "Meeting"      SET "programId" = 'prog_mubas_engineering' WHERE "programId" IS NULL;
UPDATE "Announcement" SET "programId" = 'prog_mubas_engineering' WHERE "programId" IS NULL;

-- Programme memberships from existing profiles. Account status maps to
-- membership status; nothing about the account itself changes.
INSERT INTO "ProgramMembership" ("id", "programId", "userId", "role", "status", "cohortId", "expertise", "capacity", "joinedAt", "createdAt", "updatedAt")
SELECT 'pm_' || mp."id", 'prog_mubas_engineering', mp."userId", 'MENTOR',
       CASE u."status" WHEN 'APPROVED' THEN 'ACTIVE'::"MembershipStatus"
                       WHEN 'PENDING'  THEN 'PENDING'::"MembershipStatus"
                       ELSE 'INACTIVE'::"MembershipStatus" END,
       mp."semesterId", ARRAY[]::TEXT[], mp."maxMentees",
       CASE WHEN u."status" = 'APPROVED' THEN mp."createdAt" END,
       mp."createdAt", CURRENT_TIMESTAMP
FROM "MentorProfile" mp JOIN "User" u ON u."id" = mp."userId"
ON CONFLICT ("programId", "userId", "role") DO NOTHING;

INSERT INTO "ProgramMembership" ("id", "programId", "userId", "role", "status", "cohortId", "expertise", "joinedAt", "createdAt", "updatedAt")
SELECT 'pm_' || ep."id", 'prog_mubas_engineering', ep."userId", 'MENTEE',
       CASE u."status" WHEN 'APPROVED' THEN 'ACTIVE'::"MembershipStatus"
                       WHEN 'PENDING'  THEN 'PENDING'::"MembershipStatus"
                       ELSE 'INACTIVE'::"MembershipStatus" END,
       ep."semesterId", ARRAY[]::TEXT[],
       CASE WHEN u."status" = 'APPROVED' THEN ep."createdAt" END,
       ep."createdAt", CURRENT_TIMESTAMP
FROM "MenteeProfile" ep JOIN "User" u ON u."id" = ep."userId"
ON CONFLICT ("programId", "userId", "role") DO NOTHING;

-- Existing administrators keep everything they can do today: Super Admin on
-- the platform, and coordinator of the migrated programme.
INSERT INTO "RoleAssignment" ("id", "userId", "roleId", "scopeType", "updatedAt")
SELECT 'ra_sa_' || u."id", u."id", 'role_super_admin', 'PLATFORM', CURRENT_TIMESTAMP
FROM "User" u WHERE u."role" = 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO "RoleAssignment" ("id", "userId", "roleId", "scopeType", "programId", "updatedAt")
SELECT 'ra_pc_' || u."id", u."id", 'role_program_coordinator', 'PROGRAM', 'prog_mubas_engineering', CURRENT_TIMESTAMP
FROM "User" u WHERE u."role" = 'ADMIN'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Verification: abort (and roll back everything) if the backfill missed
--    anything.
-- ----------------------------------------------------------------------------
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM "Semester" WHERE "programId" IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Backfill check failed: % semesters without a programme', n; END IF;

  SELECT count(*) INTO n FROM "Pairing" WHERE "programId" IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Backfill check failed: % pairings without a programme', n; END IF;

  SELECT count(*) INTO n FROM "MentorProfile" mp
   WHERE NOT EXISTS (SELECT 1 FROM "ProgramMembership" m WHERE m."userId" = mp."userId" AND m."role" = 'MENTOR');
  IF n > 0 THEN RAISE EXCEPTION 'Backfill check failed: % mentor profiles without a membership', n; END IF;

  SELECT count(*) INTO n FROM "MenteeProfile" ep
   WHERE NOT EXISTS (SELECT 1 FROM "ProgramMembership" m WHERE m."userId" = ep."userId" AND m."role" = 'MENTEE');
  IF n > 0 THEN RAISE EXCEPTION 'Backfill check failed: % mentee profiles without a membership', n; END IF;

  SELECT count(*) INTO n FROM "User" u WHERE u."role" = 'ADMIN'
   AND NOT EXISTS (SELECT 1 FROM "RoleAssignment" r WHERE r."userId" = u."id" AND r."roleId" = 'role_super_admin');
  IF n > 0 THEN RAISE EXCEPTION 'Backfill check failed: % admins without Super Admin', n; END IF;
END $$;

