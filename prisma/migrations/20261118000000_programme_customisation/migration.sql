-- ============================================================================
-- Phase 2: programme creation and customisation.
-- Expand-only: new enums, tables and nullable columns. No data is changed
-- except seeding a DRAFT and PUBLISHED theme row for every existing programme
-- (Menty's default colours), and one platform setting.
-- ============================================================================

BEGIN;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER';

CREATE TYPE "ThemeVariant" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "Appearance" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
CREATE TYPE "TransferStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- Institution registration requests
ALTER TABLE "Institution" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Institution" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "Institution" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Institution" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Institution" ADD COLUMN "requestNote" TEXT;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InstitutionTheme" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "variant" "ThemeVariant" NOT NULL DEFAULT 'PUBLISHED',
    "primaryColor" TEXT NOT NULL DEFAULT '#00727a',
    "secondaryColor" TEXT NOT NULL DEFAULT '#272754',
    "accentColor" TEXT NOT NULL DEFAULT '#8fdd36',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstitutionTheme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionTheme_institutionId_variant_key" ON "InstitutionTheme"("institutionId", "variant");
ALTER TABLE "InstitutionTheme" ADD CONSTRAINT "InstitutionTheme_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgramTheme" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "variant" "ThemeVariant" NOT NULL DEFAULT 'PUBLISHED',
    "primaryColor" TEXT NOT NULL DEFAULT '#00727a',
    "primaryContrast" TEXT NOT NULL DEFAULT '#ffffff',
    "secondaryColor" TEXT NOT NULL DEFAULT '#272754',
    "secondaryContrast" TEXT NOT NULL DEFAULT '#ffffff',
    "accentColor" TEXT NOT NULL DEFAULT '#8fdd36',
    "accentContrast" TEXT NOT NULL DEFAULT '#272754',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f7f9fa',
    "foregroundColor" TEXT NOT NULL DEFAULT '#1a1b28',
    "radius" TEXT NOT NULL DEFAULT '0.75rem',
    "appearance" "Appearance" NOT NULL DEFAULT 'SYSTEM',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramTheme_pkey" PRIMARY KEY ("id"),
    -- Colours are stored as #rrggbb only; anything else could inject CSS.
    CONSTRAINT "ProgramTheme_colours_check" CHECK (
      "primaryColor" ~ '^#[0-9a-f]{6}$' AND "primaryContrast" ~ '^#[0-9a-f]{6}$' AND
      "secondaryColor" ~ '^#[0-9a-f]{6}$' AND "secondaryContrast" ~ '^#[0-9a-f]{6}$' AND
      "accentColor" ~ '^#[0-9a-f]{6}$' AND "accentContrast" ~ '^#[0-9a-f]{6}$' AND
      "backgroundColor" ~ '^#[0-9a-f]{6}$' AND "foregroundColor" ~ '^#[0-9a-f]{6}$'
    )
);
CREATE UNIQUE INDEX "ProgramTheme_programId_variant_key" ON "ProgramTheme"("programId", "variant");
ALTER TABLE "ProgramTheme" ADD CONSTRAINT "ProgramTheme_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdminInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "institutionId" TEXT,
    "programId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminInvite_scope_check" CHECK (
      ("scopeType" = 'PLATFORM'    AND "institutionId" IS NULL     AND "programId" IS NULL) OR
      ("scopeType" = 'INSTITUTION' AND "institutionId" IS NOT NULL AND "programId" IS NULL) OR
      ("scopeType" = 'PROGRAM'     AND "institutionId" IS NULL     AND "programId" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");
CREATE INDEX "AdminInvite_email_idx" ON "AdminInvite"("email");
CREATE INDEX "AdminInvite_programId_idx" ON "AdminInvite"("programId");
CREATE INDEX "AdminInvite_institutionId_idx" ON "AdminInvite"("institutionId");
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProgramTransfer" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "toInstitutionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "ProgramTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgramTransfer_programId_status_idx" ON "ProgramTransfer"("programId", "status");
CREATE INDEX "ProgramTransfer_toInstitutionId_status_idx" ON "ProgramTransfer"("toInstitutionId", "status");
-- At most one open transfer request per programme.
CREATE UNIQUE INDEX "ProgramTransfer_one_open_per_program"
  ON "ProgramTransfer"("programId") WHERE "status" = 'REQUESTED';
ALTER TABLE "ProgramTransfer" ADD CONSTRAINT "ProgramTransfer_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramTransfer" ADD CONSTRAINT "ProgramTransfer_toInstitutionId_fkey"
  FOREIGN KEY ("toInstitutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorshipProgram" ADD COLUMN "contactEmail" TEXT;

-- Every existing programme starts with Menty's default theme.
INSERT INTO "ProgramTheme" ("id", "programId", "variant", "updatedAt")
SELECT 'pt_' || lower(v.variant) || '_' || p."id", p."id", v.variant::"ThemeVariant", CURRENT_TIMESTAMP
FROM "MentorshipProgram" p CROSS JOIN (VALUES ('PUBLISHED'), ('DRAFT')) AS v(variant)
ON CONFLICT DO NOTHING;

INSERT INTO "PlatformSetting" ("key", "value", "description", "updatedAt") VALUES
  ('programs.independent_requires_verification', 'false',
   'When "true", independent programmes must be verified by Menty before they can be published publicly.',
   CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

COMMIT;
