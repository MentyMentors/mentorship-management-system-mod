import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { upsertMembership } from "@/lib/memberships";
import { parseCsvRecords } from "@/lib/csv";
import { resolveInterestIds } from "@/lib/interests";
import { normalizeEmail, sanitizeText } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import {
  mentorRegistrationSchema,
  menteeRegistrationSchema,
} from "@/lib/validators";

/**
 * POST /api/admin/import — multipart form with `file` (CSV) and `type`
 * (mentors | mentees). Imported users are created pre-APPROVED with a
 * random password; they use "forgot password"/admin reset to log in.
 *
 * Expected columns (see sample-data/*.csv):
 *   mentors: name,email,phone,registrationNumber,yearOfStudy,programme,
 *            department,strongModules,interests,hoursPerWeek,maxMentees,
 *            crossDepartment
 *   mentees: name,email,phone,registrationNumber,programme,department,
 *            sameDepartmentPreferred,interests
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const { session, scope } = await requireDefaultProgramPermission(PERMISSIONS.PARTICIPANT_IMPORT);

    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") ?? "");

    if (!(file instanceof File)) {
      return Response.json({ error: "CSV file is required" }, { status: 400 });
    }
    if (type !== "mentors" && type !== "mentees") {
      return Response.json({ error: "type must be mentors or mentees" }, { status: 400 });
    }

    const semester = await db.semester.findFirst({
      where: { isActive: true, isArchived: false, programId: scope.programId },
    });
    if (!semester) {
      return Response.json({ error: "No active semester" }, { status: 409 });
    }

    const records = parseCsvRecords(await file.text());
    if (records.length === 0) {
      return Response.json({ error: "CSV contains no data rows" }, { status: 400 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const [index, record] of records.entries()) {
      const rowLabel = `Row ${index + 2}`;
      const email = normalizeEmail(record.email ?? "");

      const shared = {
        name: record.name ?? "",
        email,
        // Import path never uses this password; satisfies validation.
        password: "Imported1!",
        phone: record.phone || undefined,
        registrationNumber: record.registrationNumber ?? "",
        department: record.department ?? "",
        programme: record.programme ?? "",
        interests: (record.interests ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const parsed =
        type === "mentors"
          ? mentorRegistrationSchema.safeParse({
              ...shared,
              role: "MENTOR",
              yearOfStudy: record.yearOfStudy,
              strongModules: (record.strongModules ?? "")
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean),
              hoursPerWeek: record.hoursPerWeek,
              maxMentees: record.maxMentees,
              crossDepartment: /^(yes|true|1)$/i.test(record.crossDepartment ?? ""),
            })
          : menteeRegistrationSchema.safeParse({
              ...shared,
              role: "MENTEE",
              sameDepartmentPreferred: /^(yes|true|1)$/i.test(
                record.sameDepartmentPreferred ?? ""
              ),
            });

      if (!parsed.success) {
        results.errors.push(
          `${rowLabel}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`
        );
        continue;
      }

      const exists = await db.user.findUnique({ where: { email } });
      if (exists) {
        results.skipped += 1;
        continue;
      }

      const randomPassword = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      const interestIds = await resolveInterestIds(parsed.data.interests);
      const data = parsed.data;

      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: sanitizeText(data.name),
            email,
            phone: data.phone,
            passwordHash,
            role: data.role,
            status: "APPROVED",
          },
        });

        await upsertMembership(tx, {
          programId: scope.programId,
          userId: user.id,
          role: data.role,
          status: "ACTIVE",
          cohortId: semester.id,
          capacity: data.role === "MENTOR" ? data.maxMentees : null,
        });

        if (data.role === "MENTOR") {
          const profile = await tx.mentorProfile.create({
            data: {
              userId: user.id,
              semesterId: semester.id,
              registrationNumber: data.registrationNumber,
              yearOfStudy: data.yearOfStudy,
              programme: data.programme,
              department: data.department,
              strongModules: data.strongModules,
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
              userId: user.id,
              semesterId: semester.id,
              registrationNumber: data.registrationNumber,
              programme: data.programme,
              department: data.department,
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
      });

      results.created += 1;
    }

    await logAudit({
      actorId: session.user.id,
      action: "data.import",
      programId: scope.programId,
      institutionId: scope.institutionId,
      metadata: {
        type,
        created: results.created,
        skipped: results.skipped,
        errorCount: results.errors.length,
      },
    });

    return Response.json(results);
  } catch (error) {
    return errorResponse(error);
  }
}
