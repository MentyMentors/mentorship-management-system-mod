# Installation Guide

## Prerequisites

- **Node.js 20+** and npm 10+
- A **Neon** PostgreSQL project (free tier works) — <https://neon.tech>
- A **Hostinger** email mailbox to send from (created under hPanel → Emails)

## 1. Clone and install

```bash
git clone <your-repo-url> mentorship-management-system
cd mentorship-management-system
npm install
```

`postinstall` runs `prisma generate` automatically.

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in every value:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Neon dashboard → Connection details → **Pooled** connection. Keep `?sslmode=require&pgbouncer=true`. |
| `DIRECT_URL` | Same page → **Direct** connection (used by migrations). |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` locally |
| `SMTP_USER` / `SMTP_PASSWORD` | Hostinger mailbox address + its login password (hPanel → Emails) |
| `EMAIL_FROM` | e.g. `Faculty Mentorship <you@yourdomain.com>` |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Initial admin credentials |
| `GOOGLE_SITE_VERIFICATION` | Optional — the `content` value from Google Search Console's HTML-tag verification method (see `docs/DEPLOYMENT.md`) |
| `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Optional — from a Server-to-Server OAuth app on the [Zoom Marketplace](https://marketplace.zoom.us/) (see `docs/DEPLOYMENT.md`). Without these, meetings still work, just without an auto-created Zoom link. |

## 3. Create the database schema

```bash
npm run db:migrate:dev
```

This applies `prisma/migrations` to your Neon database (uses `DIRECT_URL`).

## 4. Seed initial data

```bash
npm run db:seed
```

Creates the admin account, an active semester with open registration,
the predefined interest list, and a few sample mentors/mentees.

## 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>, log in as the admin, and explore:

1. **Admin → Users**: approve the pending sample mentee (`felix.mentee@…`)
   and watch automatic pairing run.
2. **Register** a new mentee from the landing page, approve it, and
   confirm the pairing + emails.

## Troubleshooting

- **`P1001: Can't reach database server`** — check both Neon URLs and that
  your IP is allowed (Neon allows all by default).
- **Emails not sending** — the app logs `[mailer]` warnings and continues;
  verify the mailbox password and that `SMTP_PORT=465`, `SMTP_SECURE=true`.
- **`AUTH_SECRET` missing** — Auth.js refuses to start without it in
  production mode.
