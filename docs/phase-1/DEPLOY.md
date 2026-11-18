# Phase 1 — Deploying the multi-tenant foundation

Production will not pick up Phase 1 by itself. The October draft of
`20261023000000_multitenant_core` is recorded as **failed** in production's
`_prisma_migrations` table, so every `prisma migrate deploy` (which runs in the Vercel build)
stops with error P3009 until that record is cleared. Until you do the steps below, new Vercel
deployments fail at the migrate step and the live site keeps running the last successful build.
No data is touched.

Time needed: about 15 minutes. You need the production `DIRECT_URL` (Vercel → Settings →
Environment Variables, or `vercel env pull .env.production.local`).

## 1. Back up: create a Neon branch

Neon console → your project → **Branches** → **Create branch** from `main` (production), named
e.g. `pre-phase-1`. This is an instant copy-on-write snapshot you can restore from.

## 2. Look at the migration record

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name = '20261023000000_multitenant_core';
```

| Result | Meaning | What to do |
| --- | --- | --- |
| one row, `finished_at` and `rolled_back_at` empty | failed (expected) | step 3 |
| no row | never attempted | skip step 3 |
| `finished_at` set | it somehow succeeded | **stop** and tell Claude/the developer; do not continue |

## 3. Rehearse on the backup branch (recommended)

Use the `pre-phase-1` branch's connection string:

```bash
export DATABASE_URL="<branch connection string>"
export DIRECT_URL="<branch direct connection string>"
npx prisma migrate resolve --rolled-back 20261023000000_multitenant_core
npx prisma migrate deploy
```

`migrate deploy` must end with "All migrations have been successfully applied". The migration
verifies its own backfill and rolls back completely if anything is missing. Then check:

```sql
SELECT count(*) FROM "ProgramMembership";                       -- = number of mentor + mentee profiles
SELECT count(*) FROM "RoleAssignment" WHERE "roleId" = 'role_super_admin';  -- = number of ADMIN users
SELECT count(*) FROM "Semester" WHERE "programId" IS NULL;      -- 0
```

## 4. Production

Same two commands with the **production** `DATABASE_URL` / `DIRECT_URL`:

```bash
npx prisma migrate resolve --rolled-back 20261023000000_multitenant_core
```

Then Vercel → **Deployments** → latest deployment → **Redeploy**. The build runs
`prisma migrate deploy`, which applies the migration, then builds the app.

## 5. Check

- Sign in as an existing admin: Overview, Users, Pairings, Semesters, Announcements, Analytics,
  Audit log and Catalog all load and show the same data as before.
- Sign in as an existing mentor and mentee: dashboards, meetings and announcements unchanged.
- Register a test mentee: they appear under Users as pending; approving them pairs them as before.

## Rolling back

The migration only adds tables and columns, so the previous application build still works
against the migrated database. In Vercel use **Instant Rollback** to the last good deployment.
Restoring the Neon `pre-phase-1` branch is only needed if data itself is wrong.

## What changed for people using Menty

Nothing visible. Existing admins became Super Admins and coordinators of the MUBAS programme, so
they keep every screen they had. Behind the scenes every admin action is now checked against
programme permissions instead of the old global "ADMIN" flag.
