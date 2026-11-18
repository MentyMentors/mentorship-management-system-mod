-- ============================================================================
-- Phase 3: joining programmes online, and Menty's own volunteer network.
-- Expand-only and safe to re-run. No explicit transaction control.
-- ============================================================================

ALTER TABLE "ProgramMembership" ADD COLUMN IF NOT EXISTS "applicationNote" TEXT;
ALTER TABLE "ProgramMembership" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "ProgramMembership" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "ProgramMembership" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

-- Menty's first-party volunteer mentor network ("Find your mentor").
-- Run by Menty (Super Admins administer it platform-wide). Its wording is
-- ordinary data, editable from Programmes → settings.
INSERT INTO "MentorshipProgram" (
  "id", "slug", "name", "tagline", "description", "ownerType", "status", "visibility",
  "verificationStatus", "deliveryModel", "deliveryMode", "matchingMode", "enabledModules",
  "requiresApproval", "eligibility", "careerTags", "publishedAt", "updatedAt")
VALUES (
  'prog_menty_volunteers', 'menty-volunteer-mentors', 'Menty Volunteer Mentor Network',
  'Find your guide — or become one.',
  'Menty''s own mentorship network. Students and young professionals are matched with volunteer mentors who have walked the road before them. Open to everyone, from any institution.',
  'PLATFORM', 'PUBLISHED', 'PUBLIC', 'VERIFIED', 'ONE_TO_ONE', 'ONLINE', 'MANUAL',
  ARRAY['pairings','matching','meetings','announcements','messages','resources','milestones','analytics','cohorts'],
  true, '{"mode":"OPEN","institutionIds":[],"departments":[],"yearsOfStudy":[]}'::jsonb,
  ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "ProgramTheme" ("id", "programId", "variant", "updatedAt")
SELECT 'pt_' || lower(v.variant) || '_' || p."id", p."id", v.variant::"ThemeVariant", CURRENT_TIMESTAMP
FROM "MentorshipProgram" p CROSS JOIN (VALUES ('PUBLISHED'), ('DRAFT')) AS v(variant)
WHERE p."slug" = 'menty-volunteer-mentors'
ON CONFLICT DO NOTHING;

INSERT INTO "PlatformSetting" ("key", "value", "description", "updatedAt")
SELECT 'platform.volunteer_program_id', p."id",
       'Programme behind the homepage "Find your mentor" and "Become a mentor" buttons.',
       CURRENT_TIMESTAMP
FROM "MentorshipProgram" p WHERE p."slug" = 'menty-volunteer-mentors'
ON CONFLICT ("key") DO NOTHING;
