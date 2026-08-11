# Menty

A production-ready web application for managing the Faculty of Engineering
mentorship programme: mentor/mentee registration with admin approval,
automated pairing, internal messaging (with email & WhatsApp quick actions),
meeting logs, semester cohorts, announcements, bulk email, CSV import/export
and analytics — presented as a modern SaaS dashboard with light/dark mode.

## Tech stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + React 19 + TypeScript   |
| Styling    | Tailwind CSS + shadcn/ui + Lucide icons           |
| Database   | Neon PostgreSQL via Prisma ORM                    |
| Auth       | Auth.js (NextAuth v5) — credentials, JWT sessions |
| Forms      | React Hook Form + Zod (client & server validation)|
| Email      | Hostinger SMTP via Nodemailer                     |
| Testing    | Vitest (unit + integration)                       |
| Deployment | Vercel (incl. cron jobs)                          |

## Features

### Roles & approval workflow
- Three roles: **Admin**, **Mentor**, **Mentee**.
- Self-service registration; every new account is **Pending Approval**.
- Only admins approve/reject; only approved accounts can log in.
- Email notifications on registration, approval and rejection.

### Automatic pairing
Runs immediately when a mentee is approved and retries whenever a new
mentor becomes available. Priority order:
1. Same department (hard filter if the mentee requested it)
2. Shared interests
3. Mentor availability (free slots + weekly hours)
4. Random tie-break

Mentor capacity is never exceeded (checked again inside a transaction).
Unmatched mentees are waitlisted and admins are notified by email and
in-app notification.

### Admin dashboard
Overview stats (mentors, mentees, active semester, waitlist, pending
approvals, pairing & meeting statistics), user management with search and
filters, manual pairing/reassignment, semester management (create /
activate / archive / open / close registration), announcements, bulk
email, CSV import/export, analytics, messaging and global search.

### Mentor & mentee dashboards
Assigned mentees/mentor with contact info, meeting history and logging,
upcoming meetings, messages, announcements and profile editing.

### Messaging
Internal 1:1 messaging with unread counts, read/unread toggling,
conversation search and quick actions to **Send Email** (mailto) and
**Open WhatsApp** (wa.me link generated from the recipient's phone).

### Communication (Hostinger SMTP)
Automated emails for registration, approval, pairing, weekly reminders
(Vercel cron, Mondays), meeting reminders (daily cron) and announcements.

### Security
Role-based authorization (edge middleware + server-side guards), CSRF
protection via Auth.js, bcrypt password hashing, secure JWT sessions,
route protection, rate limiting on sensitive endpoints, input
sanitization and HTML-escaped email templates, security headers.

## Project structure

```
├── prisma/                  # Schema, migrations, seed
├── sample-data/             # CSV import templates
├── src/
│   ├── app/                 # App Router pages, layouts & API routes
│   │   ├── (auth)/          # Login, register, pending
│   │   ├── (dashboard)/     # Admin / mentor / mentee / shared pages
│   │   └── api/             # REST endpoints (auth, admin, cron, …)
│   ├── components/          # UI (shadcn), forms, layout, feature comps
│   ├── hooks/               # useDebounce, useApiAction
│   ├── lib/                 # auth, db, pairing, email, validators, …
│   ├── services/            # stats, search, messages
│   └── types/               # Shared types & next-auth augmentation
├── tests/                   # Vitest unit + integration tests
├── docs/                    # Installation, deployment, testing guides
└── vercel.json              # Build command + cron schedules
```

## Quick start

```bash
cp .env.example .env        # fill in Neon + Hostinger + secrets
npm install
npm run db:migrate:dev      # create schema on your Neon database
npm run db:seed             # admin account + sample data
npm run dev                 # http://localhost:3000
```

Default seed credentials (change immediately):

- Admin: `admin@engineering.edu` / `ChangeMe123!` (overridable via
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- Sample mentors/mentees: password `Password123!`

## Documentation

- [Installation guide](docs/INSTALLATION.md)
- [Deployment guide (Vercel + Neon + Hostinger)](docs/DEPLOYMENT.md)
- [Testing guide](docs/TESTING.md)

## Scripts

| Script                | Purpose                              |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start the dev server                 |
| `npm run build`       | Prisma generate + production build   |
| `npm run start`       | Serve the production build           |
| `npm run lint`        | ESLint                               |
| `npm test`            | Run the Vitest suite                 |
| `npm run db:migrate`  | Apply migrations (production)        |
| `npm run db:migrate:dev` | Create/apply migrations (dev)     |
| `npm run db:seed`     | Seed admin, semester & sample users  |
| `npm run db:studio`   | Prisma Studio                        |

## License

MIT — built for Menty, mentorship programme platform.
