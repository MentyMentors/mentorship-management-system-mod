import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { programCreateSchema } from "@/lib/program-validators";
import { createProgram, listManagedPrograms } from "@/services/programs";

/** GET /api/programs — programmes the caller can administer. */
export async function GET(): Promise<Response> {
  try {
    const user = await serviceUser();
    return Response.json({ programs: await listManagedPrograms(user.actor) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/programs — create a programme (DRAFT). */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await serviceUser();
    const input = await parseBody(req, programCreateSchema);
    const program = await createProgram(user, input);
    return Response.json({ program: { id: program.id, slug: program.slug } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
