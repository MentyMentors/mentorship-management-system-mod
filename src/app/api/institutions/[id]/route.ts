import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { institutionActionSchema, institutionUpdateSchema } from "@/lib/program-validators";
import { institutionAction, updateInstitution } from "@/services/institutions";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/institutions/:id — profile and branding. */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    await updateInstitution(user, id, await parseBody(req, institutionUpdateSchema));
    return Response.json({ message: "Saved" });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/institutions/:id — { action: approve | reject | suspend | reactivate } (Super Admin). */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { action } = await parseBody(req, institutionActionSchema);
    await institutionAction(user, id, action);
    return Response.json({ message: "Updated" });
  } catch (error) {
    return errorResponse(error);
  }
}
