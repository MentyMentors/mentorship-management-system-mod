import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { transferRequestSchema } from "@/lib/program-validators";
import { requestTransfer } from "@/services/programs";

/** POST /api/programs/:id/transfer — ask an institution to take ownership. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const { institutionId, note } = await parseBody(req, transferRequestSchema);
    await requestTransfer(user, id, institutionId, note);
    return Response.json({ message: "Transfer requested — the institution will be asked to accept" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
