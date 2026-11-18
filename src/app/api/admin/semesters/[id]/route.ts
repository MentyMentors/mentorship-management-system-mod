import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { assertInProgram } from "@/lib/rbac/scope";
import { semesterActionSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/semesters/:id
 * Actions: activate | archive | unarchive | openRegistration | closeRegistration
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { session, scope } = await requireDefaultProgramPermission(PERMISSIONS.COHORT_MANAGE);
    const { id } = await params;

    const parsed = semesterActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid action" }, { status: 422 });
    }

    const semester = await db.semester.findUnique({ where: { id } });
    assertInProgram(semester, scope, "Semester");

    switch (parsed.data.action) {
      case "activate":
        if (semester.isArchived) {
          return Response.json(
            { error: "Unarchive the semester before activating it" },
            { status: 409 }
          );
        }
        // Exactly one active semester at a time.
        await db.$transaction([
          // ...within this programme; other programmes' cohorts are untouched.
          db.semester.updateMany({
            where: { isActive: true, programId: scope.programId },
            data: { isActive: false },
          }),
          db.semester.update({
            where: { id },
            data: { isActive: true },
          }),
        ]);
        break;
      case "archive":
        await db.semester.update({
          where: { id },
          data: { isArchived: true, isActive: false, registrationOpen: false },
        });
        break;
      case "unarchive":
        await db.semester.update({
          where: { id },
          data: { isArchived: false },
        });
        break;
      case "openRegistration":
        if (semester.isArchived) {
          return Response.json(
            { error: "Cannot open registration on an archived semester" },
            { status: 409 }
          );
        }
        await db.semester.update({
          where: { id },
          data: { registrationOpen: true },
        });
        break;
      case "closeRegistration":
        await db.semester.update({
          where: { id },
          data: { registrationOpen: false },
        });
        break;
    }

    await logAudit({
      actorId: session.user.id,
      action: `semester.${parsed.data.action}`,
      programId: scope.programId,
      institutionId: scope.institutionId,
      targetType: "Semester",
      targetId: id,
      metadata: { name: semester.name },
    });

    const updated = await db.semester.findUnique({ where: { id } });
    return Response.json({ semester: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
