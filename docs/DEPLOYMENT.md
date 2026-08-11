# Deployment Guide (Vercel + Neon + Hostinger)

## 1. Neon (database)

1. Create a project at <https://neon.tech> (e.g. `mentorship`).
2. Copy the **pooled** connection string → `DATABASE_URL`
   (must include `?sslmode=require&pgbouncer=true`).
3. Copy the **direct** connection string → `DIRECT_URL`.

## 2. Hostinger SMTP

1. Create (or use an existing) mailbox for the app under Hostinger's
   **Emails** section (e.g. `no-reply@yourdomain.com`).
2. Use the mailbox's login password as `SMTP_PASSWORD`, the full mailbox
   address as `SMTP_USER`, and `SMTP_HOST=smtp.hostinger.com`,
   `SMTP_PORT=465`, `SMTP_SECURE=true`.

> Hostinger's shared/business mail plans cap outgoing volume per hour
> (check your plan's limits in hPanel). The bulk mailer sends in batches
> of 5 with a short pause between batches; for larger cohorts consider a
> higher-tier mailbox or a transactional provider.

## 3. Vercel

1. Push the repository to GitHub and import it at <https://vercel.com/new>.
2. Framework preset: **Next.js** (auto-detected). `vercel.json` overrides
   the build command to run migrations:

   ```
   prisma generate && prisma migrate deploy && next build
   ```

3. Add Environment Variables (Production **and** Preview):

   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET` (new random value), `AUTH_TRUST_HOST=true`
   - `AUTH_URL` = `https://www.mentmw.org`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
   - `NEXT_PUBLIC_APP_URL` = `https://www.mentmw.org`
   - `NEXT_PUBLIC_APP_NAME`
   - `CRON_SECRET`
   - `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` (optional, see step 6 below)

4. Deploy. Migrations run during the build against `DIRECT_URL`.
5. Under Project → Settings → Domains, add `mentmw.org` and
   `www.mentmw.org`, then set `www.mentmw.org` as the primary domain
   (the app already 308-redirects the apex to `www` — see
   `next.config.ts` — so both resolve to one canonical URL for SEO).

## 4. Cron jobs

`vercel.json` registers two crons (Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically when the env var is set):

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/weekly-reminders` | `0 8 * * 1` | Weekly nudge to mentors & mentees |
| `/api/cron/meeting-reminders` | `0 7 * * *` | Reminders for meetings in the next 24h |

## 5. Seed production

Run once from your machine with production env vars:

```bash
DATABASE_URL="<pooled-url>" DIRECT_URL="<direct-url>" \
SEED_ADMIN_EMAIL="coordinator@engineering.edu" \
SEED_ADMIN_PASSWORD="<strong-password>" \
npx prisma db seed
```

Then log in and change anything you need under the admin dashboard.

## 6. Zoom integration (optional)

Meetings logged with a future date automatically get a Zoom link
(`src/lib/zoom.ts`) — if unconfigured, meeting logging still works, just
without the link.

1. Go to <https://marketplace.zoom.us/>, sign in with the Zoom account
   that should host meetings, and create an app of type
   **Server-to-Server OAuth**.
2. Grant it a meeting-write scope (`meeting:write:meeting` /
   `meeting:write:admin` depending on your Zoom account's scope
   version — the app UI lists what's available).
3. Copy the **Account ID**, **Client ID** and **Client Secret** it gives
   you into `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.
4. This works on a free/Basic Zoom plan — meetings are created under the
   one Zoom account you authorized, and 1-on-1 meetings (mentor + mentee)
   aren't subject to the Basic plan's 40-minute group-meeting cap.

## 7. Post-deploy checklist

- [ ] Log in as admin; create/activate the real semester; open registration.
- [ ] Register a test mentor + mentee; approve both; verify pairing emails.
- [ ] Trigger `/api/cron/weekly-reminders` manually with the bearer secret.
- [ ] Confirm dark mode, CSV export and messaging work on the deployed URL.
- [ ] Log a future-dated meeting and confirm a Zoom link appears (if configured).
- [ ] Use "Report an issue" from the account menu and confirm the admin gets the email.

## 8. Search engine indexing (Google Search Console)

The app already serves `/robots.txt` and `/sitemap.xml` (generated from
`src/app/robots.ts` and `src/app/sitemap.ts`) pointing at
`https://www.mentmw.org`. To get it indexed:

1. Go to <https://search.google.com/search-console> and add a property
   for `https://www.mentmw.org` (**URL prefix** type).
2. Verify ownership — easiest is the **HTML tag** method: Search Console
   gives you a `<meta name="google-site-verification" content="...">`
   tag. Copy just the `content` value and set it as the
   `GOOGLE_SITE_VERIFICATION` env var in Vercel, then redeploy —
   `src/app/layout.tsx` already renders it automatically. (Or use the
   **DNS TXT record** method instead if you manage `mentmw.org`'s DNS
   directly — no env var needed either way.)
3. Once verified, open **Sitemaps** in the left nav and submit
   `https://www.mentmw.org/sitemap.xml`.
4. Use **URL Inspection** on `https://www.mentmw.org/` and click
   **Request indexing** to speed up the first crawl.
5. Repeat verification for [Bing Webmaster Tools](https://www.bing.com/webmasters)
   if you also want Bing/Yahoo coverage — it accepts the same sitemap
   URL and can import verification directly from Search Console.

Indexing itself (Google crawling and ranking the site) is out of this
repo's control — steps 1–4 above have to be done once, by hand, by
whoever owns the Search Console account.

## Scaling notes

- The rate limiter is in-memory (per serverless instance). For strict
  global limits swap `src/lib/rate-limit.ts` for Upstash Redis.
- Neon autoscales; keep `pgbouncer=true` on the pooled URL so serverless
  functions don't exhaust connections.
