import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { transferDecisionSchema } from "@/lib/program-validators";
import { decideTransfer } from "@/services/programs";

/** POST /api/transfers/:id — { action: accept | decline | cancel }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { action } = await parseBody(req, transferDecisionSchema);
    await decideTransfer(user, id, action);
    return Response.json({ message: action === "accept" ? "Programme transferred" : "Done" });
  } catch (error) {
    return errorResponse(error);
  }
}
