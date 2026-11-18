-- Registration outcomes for programme memberships. Enum values are added in
-- a migration of their own (nothing else here uses them).
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
