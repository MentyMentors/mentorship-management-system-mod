import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
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
    console.error(
      `[mailer] Failed to send "${subject}" to ${Array.isArray(to) ? to.join(", ") : to}`,
      error
    );
    return { ok: false, error: message };
  }
}

/**
 * Send an email via Gmail SMTP. Failures are logged but never thrown —
 * email delivery must not break registration, approval or pairing flows.
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

// Gmail's SMTP relay throttles/drops connections under high concurrency
// — small batches with a short pause between them stay well under that,
// at some cost to total send time for large recipient lists.
const BULK_BATCH_SIZE = 5;
const BULK_BATCH_DELAY_MS = 250;
const BULK_RETRY_DELAY_MS = 3000;

async function sendBatched(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ ok: string[]; failures: { email: string; error: string }[] }> {
  const ok: string[] = [];
  const failures: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += BULK_BATCH_SIZE) {
    const batch = recipients.slice(i, i + BULK_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (to) => ({ to, ...(await sendMailInternal({ to, subject, html })) }))
    );
    for (const r of results) {
      if (r.ok) ok.push(r.to);
      else failures.push({ email: r.to, error: r.error ?? "Unknown error" });
    }
    if (i + BULK_BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, BULK_BATCH_DELAY_MS));
    }
  }

  return { ok, failures };
}

/**
 * Send the same email to many recipients individually (BCC-free).
 * Reports exactly which addresses failed and why, and retries failures
 * once after a cool-down — most bulk failures are transient rate
 * limiting rather than a genuinely bad address.
 */
export async function sendBulkMail(
  recipients: string[],
  subject: string,
  html: string
): Promise<BulkMailResult> {
  const first = await sendBatched(recipients, subject, html);
  let sent = first.ok.length;
  let failures = first.failures;

  if (failures.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, BULK_RETRY_DELAY_MS));
    const retry = await sendBatched(
      failures.map((f) => f.email),
      subject,
      html
    );
    sent += retry.ok.length;
    failures = retry.failures;
  }

  return { sent, failed: failures.length, failures };
}
