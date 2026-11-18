import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { assertCan, RequestError } from "@/lib/rbac/authorize";
import { resolveProgramScope } from "@/lib/rbac/scope";
import { teamAddSchema } from "@/lib/program-validators";
import { addStaff, listStaff, removeStaff, revokeInvite, type StaffScope } from "@/services/staff";

type Params = { params: Promise<{ id: string }> };

async function staffScope(programId: string): Promise<StaffScope> {
  const scope = await resolveProgramScope(programId);
  const program = await db.mentorshipProgram.findUniqueOrThrow({ where: { id: programId }, select: { name: true } });
  return { scopeType: "PROGRAM", programId, institutionId: scope.institutionId, name: program.name };
}

/** GET /api/programs/:id/team — coordinators, assistants and pending invitations. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const scope = await staffScope(id);
    assertCan(user.actor, PERMISSIONS.PROGRAM_READ, { programId: id, institutionId: scope.institutionId });
    return Response.json(await listStaff(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/programs/:id/team — { email, roleKey }: appoint or invite. */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { email, roleKey } = await parseBody(req, teamAddSchema);
    const result = await addStaff(user.actor, user, await staffScope(id), email, roleKey);
    const message =
      result.kind === "assigned" ? "Added to the team" : result.kind === "invited" ? "Invitation sent" : "Already on the team or invited";
    return Response.json({ ...result, message });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/programs/:id/team?assignmentId= | ?inviteId= */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");
    const inviteId = url.searchParams.get("inviteId");
    const scope = await staffScope(id);
    if (assignmentId) await removeStaff(user.actor, user.id, scope, assignmentId);
    else if (inviteId) await revokeInvite(user.actor, user.id, scope, inviteId);
    else throw new RequestError(400, "assignmentId or inviteId is required");
    return Response.json({ message: "Removed" });
  } catch (error) {
    return errorResponse(error);
  }
}
