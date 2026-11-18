import { z } from "zod";
import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { joinProgram } from "@/services/join";

const joinSchema = z.object({
  slug: z.string().min(1).max(80),
  role: z.enum(["MENTEE", "MENTOR", "PARTICIPANT"]),
  note: z.string().trim().max(2000).optional(),
});

/** POST /api/join — register the signed-in user for a programme. */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await serviceUser();
    const { slug, role, note } = await parseBody(req, joinSchema);
    const { membership, programId } = await joinProgram(user, slug, role, note);
    return Response.json({ status: membership.status, programId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
