import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { assertCan, RequestError } from "@/lib/rbac/authorize";
import { institutionAdminAddSchema } from "@/lib/program-validators";
import { addStaff, listStaff, removeStaff, revokeInvite, type StaffScope } from "@/services/staff";

type Params = { params: Promise<{ id: string }> };

async function staffScope(institutionId: string): Promise<StaffScope> {
  const institution = await db.institution.findUnique({ where: { id: institutionId }, select: { name: true, status: true } });
  if (!institution) throw new RequestError(404, "Institution not found");
  if (institution.status !== "ACTIVE") throw new RequestError(409, "The institution is not active.");
  return { scopeType: "INSTITUTION", institutionId, name: institution.name };
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    assertCan(user.actor, PERMISSIONS.INSTITUTION_UPDATE, { institutionId: id });
    return Response.json(await listStaff(await staffScope(id)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/institutions/:id/admins — { email }: appoint or invite an administrator. */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { email } = await parseBody(req, institutionAdminAddSchema);
    const result = await addStaff(user.actor, user, await staffScope(id), email, "institution_admin");
    const message =
      result.kind === "assigned" ? "Administrator added" : result.kind === "invited" ? "Invitation sent" : "Already an administrator or invited";
    return Response.json({ ...result, message });
  } catch (error) {
    return errorResponse(error);
  }
}

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
