import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { programUpdateSchema } from "@/lib/program-validators";
import { getProgramForManagement, updateProgram } from "@/services/programs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { program } = await getProgramForManagement(user, id);
    return Response.json({ program });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/programs/:id — { section, data } for one settings section. */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const update = await parseBody(req, programUpdateSchema);
    await updateProgram(user, id, update);
    return Response.json({ message: "Saved" });
  } catch (error) {
    return errorResponse(error);
  }
}
