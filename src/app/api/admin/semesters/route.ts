import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { semesterSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export async function GET(): Promise<Response> {
  try {
    const { scope } = await requireDefaultProgramPermission(PERMISSIONS.PROGRAM_READ);
    const semesters = await db.semester.findMany({
      where: { programId: scope.programId },
      orderBy: { startDate: "desc" },
      include: {
        _count: { select: { mentorProfiles: true, menteeProfiles: true, pairings: true } },
      },
    });
    return Response.json({ semesters });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { session, scope } = await requireDefaultProgramPermission(PERMISSIONS.COHORT_MANAGE);

    const parsed = semesterSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const existing = await db.semester.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) {
      return Response.json(
        { error: "A semester with this name already exists" },
        { status: 409 }
      );
    }

    const semester = await db.semester.create({
      data: { ...parsed.data, programId: scope.programId },
    });

    await logAudit({
      actorId: session.user.id,
      programId: scope.programId,
      institutionId: scope.institutionId,
      action: "semester.create",
      targetType: "Semester",
      targetId: semester.id,
      metadata: { name: semester.name },
    });

    return Response.json({ semester }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
