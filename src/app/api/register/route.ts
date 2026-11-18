import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registrationSchema } from "@/lib/validators";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { resolveInterestIds } from "@/lib/interests";
import { resolveStrongModules } from "@/lib/strong-modules";
import { sendMail } from "@/lib/email/mailer";
import { verifyEmailEmail, APP_URL } from "@/lib/email/templates";
import { generateVerificationToken } from "@/lib/tokens";
import { upsertMembership } from "@/lib/memberships";
import { getDefaultProgramScope } from "@/lib/rbac/scope";

export async function POST(req: Request): Promise<Response> {
  const limit = rateLimit(clientKey(req, "register"), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.success) {
    return Response.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // The original registration form joins the default programme (the
  // migrated MUBAS programme). Per-programme forms arrive in Phase 4.
  const { programId } = await getDefaultProgramScope();
  const semester = await db.semester.findFirst({
    where: { isActive: true, isArchived: false, programId },
  });
  if (!semester) {
    return Response.json(
      { error: "There is no active semester. Contact the administrator." },
      { status: 409 }
    );
  }
  if (!semester.registrationOpen) {
    return Response.json(
      { error: "Registration is currently closed for this semester." },
      { status: 409 }
    );
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return Response.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const [department, programme] = await Promise.all([
    db.department.findFirst({
      where: { name: { equals: data.department, mode: "insensitive" }, isActive: true },
    }),
    db.programme.findFirst({
      where: { name: { equals: data.programme, mode: "insensitive" }, isActive: true },
    }),
  ]);
  if (!department) {
    return Response.json({ error: "Select a valid department." }, { status: 422 });
  }
  if (!programme) {
    return Response.json({ error: "Select a valid programme." }, { status: 422 });
  }

  const regNumberTaken =
    data.role === "MENTOR"
      ? await db.mentorProfile.findFirst({
          where: {
            registrationNumber: data.registrationNumber,
            semesterId: semester.id,
          },
        })
      : await db.menteeProfile.findFirst({
          where: {
            registrationNumber: data.registrationNumber,
            semesterId: semester.id,
          },
        });
  if (regNumberTaken) {
    return Response.json(
      { error: "This registration number is already registered this semester." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const interestIds = await resolveInterestIds(data.interests);
  const resolvedStrongModules =
    data.role === "MENTOR" ? await resolveStrongModules(data.strongModules) : [];

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: sanitizeText(data.name),
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role,
        status: "PENDING",
      },
    });

    await upsertMembership(tx, {
      programId,
      userId: created.id,
      role: data.role,
      status: "PENDING",
      cohortId: semester.id,
      capacity: data.role === "MENTOR" ? data.maxMentees : null,
    });

    if (data.role === "MENTOR") {
      const profile = await tx.mentorProfile.create({
        data: {
          userId: created.id,
          semesterId: semester.id,
          registrationNumber: sanitizeText(data.registrationNumber),
          yearOfStudy: data.yearOfStudy,
          programme: programme.name,
          department: department.name,
          strongModules: resolvedStrongModules,
          hoursPerWeek: data.hoursPerWeek,
          maxMentees: data.maxMentees,
          crossDepartment: data.crossDepartment,
        },
      });
      await tx.mentorInterest.createMany({
        data: interestIds.map((interestId) => ({
          mentorProfileId: profile.id,
          interestId,
        })),
      });
    } else {
      const profile = await tx.menteeProfile.create({
        data: {
          userId: created.id,
          semesterId: semester.id,
          registrationNumber: sanitizeText(data.registrationNumber),
          programme: programme.name,
          department: department.name,
          sameDepartmentPreferred: data.sameDepartmentPreferred,
        },
      });
      await tx.menteeInterest.createMany({
        data: interestIds.map((interestId) => ({
          menteeProfileId: profile.id,
          interestId,
        })),
      });
    }

    return created;
  });

  const { token, tokenHash, expiresAt } = generateVerificationToken();
  await db.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const mail = verifyEmailEmail(user.name, verifyUrl);
  await sendMail({ to: user.email, ...mail });

  return Response.json(
    {
      message:
        "Registration received. Check your email to verify your address — your account will then be reviewed by an administrator.",
    },
    { status: 201 }
  );
}
