-- New account type for people who are not legacy mentors/mentees
-- (coordinators, institution staff, invited people). Kept in its own
-- migration: adding an enum value is best done on its own.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER';
