import { errorResponse } from "@/lib/authz";
import { serviceUser } from "@/lib/api";
import { withdrawMembership } from "@/services/join";

/** DELETE /api/memberships/:id — leave a programme or cancel a registration (own only). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    await withdrawMembership(user.id, id);
    return Response.json({ message: "Done" });
  } catch (error) {
    return errorResponse(error);
  }
}
