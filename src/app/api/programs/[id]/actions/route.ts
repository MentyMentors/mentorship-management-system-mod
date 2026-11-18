import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { programActionSchema } from "@/lib/program-validators";
import { applyProgramAction } from "@/services/programs";

/** POST /api/programs/:id/actions — { action }: publish, pause, verify, suspend... */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { action } = await parseBody(req, programActionSchema);
    const program = await applyProgramAction(user, id, action);
    return Response.json({
      program: { status: program.status, verificationStatus: program.verificationStatus },
      message: "Updated",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
