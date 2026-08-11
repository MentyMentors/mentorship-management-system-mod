import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      // Hosting SMTP relays (Hostinger included) typically cap
      // simultaneous connections much tighter than Gmail's frontend —
      // pool a handful of connections and reuse them across sends
      // instead of opening a fresh TLS handshake per message.
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendResult {
  ok: boolean;
  error?: string;
  // SMTP 5xx = the server permanently rejected the message (bad address,
  // policy/quota block) — retrying won't help. 4xx and connection-level
  // errors are usually transient and worth a retry.
  permanent?: boolean;
}

async function sendMailInternal({
  to,
  subject,
  html,
  text,
}: MailOptions): Promise<SendResult> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn(`[mailer] SMTP not configured — skipping "${subject}"`);
    return { ok: false, error: "SMTP not configured" };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      // Recognised by most spam filters as a signal of legitimate,
      // well-behaved automated mail — improves inbox placement even
      // though this app doesn't have a literal unsubscribe flow.
      headers: {
        "List-Unsubscribe": `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`,
      },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const responseCode =
      error && typeof error === "object" && "responseCode" in error
        ? Number((error as { responseCode?: unknown }).responseCode)
        : undefined;
    console.error(
      `[mailer] Failed to send "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`,
      error
    );
    return {
      ok: false,
      error: message,
      permanent: typeof responseCode === "number" && responseCode >= 500,
    };
  }
}

/**
 * Send an email via the configured SMTP relay. Failures are logged but
 * never thrown — email delivery must not break registration, approval
 * or pairing flows.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  const result = await sendMailInternal(options);
  return result.ok;
}

export interface BulkMailResult {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
}

// SMTP relays throttle/drop connections under high concurrency — small
// batches sized to the connection pool above, with a short pause between
// them, stay well under that, at some cost to total send time for large
// recipient lists.
const BULK_BATCH_SIZE = 3;
const BULK_BATCH_DELAY_MS = 250;
const BULK_RETRY_DELAY_MS = 3000;

type BulkFailure = { email: string; error: string; permanent: boolean };

async function sendBatched(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ ok: string[]; failures: BulkFailure[] }> {
  const ok: string[] = [];
  const failures: BulkFailure[] = [];

  for (let i = 0; i < recipients.length; i += BULK_BATCH_SIZE) {
    const batch = recipients.slice(i, i + BULK_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (to) => ({ to, ...(await sendMailInternal({ to, subject, html })) }))
    );
    for (const r of results) {
      if (r.ok) ok.push(r.to);
      else failures.push({ email: r.to, error: r.error ?? "Unknown error", permanent: r.permanent ?? false });
    }
    if (i + BULK_BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, BULK_BATCH_DELAY_MS));
    }
  }

  return { ok, failures };
}

/**
 * Send the same email to many recipients individually (BCC-free).
 * Reports exactly which addresses failed and why, and retries transient
 * failures once after a cool-down — permanent rejections (bad address,
 * policy/quota block) are not retried since they'll fail identically.
 */
export async function sendBulkMail(
  recipients: string[],
  subject: string,
  html: string
): Promise<BulkMailResult> {
  const first = await sendBatched(recipients, subject, html);
  let sent = first.ok.length;
  let failures = first.failures;

  const retryable = failures.filter((f) => !f.permanent);
  if (retryable.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, BULK_RETRY_DELAY_MS));
    const retry = await sendBatched(
      retryable.map((f) => f.email),
      subject,
      html
    );
    sent += retry.ok.length;
    failures = [...failures.filter((f) => f.permanent), ...retry.failures];
  }

  return {
    sent,
    failed: failures.length,
    failures: failures.map(({ email, error }) => ({ email, error })),
  };
}
