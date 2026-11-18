import { errorResponse } from "@/lib/authz";
import { serviceUser } from "@/lib/api";
import { listRegistrations } from "@/services/join";

/** GET /api/programs/:id/registrations?status= */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    return Response.json(await listRegistrations(user.actor, id, status));
  } catch (error) {
    return errorResponse(error);
  }
}
