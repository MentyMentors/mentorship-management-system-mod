import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/authz";
import { parseBody } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sanitizeText } from "@/lib/sanitize";
import { generateVerificationToken } from "@/lib/tokens";
import { sendMail } from "@/lib/email/mailer";
import { APP_URL, signupVerifyEmail } from "@/lib/email/templates";
import { safeNextPath } from "@/lib/safe-path";
import { passwordSchema } from "@/lib/validators";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  password: passwordSchema,
  next: z.string().max(300).optional(),
});

/**
 * POST /api/account/signup — a general Menty account (one account for every
 * programme). Programme membership is separate: joining a programme happens
 * afterwards and may need that programme's approval.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const limit = rateLimit(clientKey(req, "signup"), { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.success) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });

    const input = await parseBody(req, signupSchema);
    const email = normalizeEmail(input.email);
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      return Response.json({ error: "An account with this email already exists. Log in instead." }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        name: sanitizeText(input.name),
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: "USER",
        // The account is usable once the email is confirmed; each programme
        // approves its own participants.
        status: "APPROVED",
      },
    });
    const { token, tokenHash, expiresAt } = generateVerificationToken();
    await db.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const next = safeNextPath(input.next);
    const verifyUrl = `${APP_URL}/verify-email?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    await sendMail({ to: email, ...signupVerifyEmail(user.name, verifyUrl) });

    return Response.json({ message: "Check your email to confirm your address, then log in." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
