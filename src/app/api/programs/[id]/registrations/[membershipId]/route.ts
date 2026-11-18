import { z } from "zod";
import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { decideRegistration } from "@/services/join";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "waitlist", "remove"]),
  note: z.string().trim().max(1000).optional(),
});

/** POST /api/programs/:id/registrations/:membershipId — { action, note }. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id, membershipId } = await params;
    const { action, note } = await parseBody(req, decisionSchema);
    await decideRegistration(user.actor, user.id, id, membershipId, action, note);
    return Response.json({ message: "Updated" });
  } catch (error) {
    return errorResponse(error);
  }
}
