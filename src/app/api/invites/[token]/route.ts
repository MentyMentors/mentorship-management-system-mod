import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/authz";
import { parseBody } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { inviteAcceptSchema } from "@/lib/program-validators";
import { acceptInvite } from "@/services/staff";

/**
 * POST /api/invites/:token — accept an invitation. Signed-in users accept
 * for their own account (email must match); otherwise { name, password }
 * creates the account.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  try {
    const limit = rateLimit(clientKey(req, "invite-accept"), { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!limit.success) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const { token } = await params;
    const body = await parseBody(req, inviteAcceptSchema);
    const session = await auth();
    const sessionUser =
      session?.user?.id && session.user.email ? { id: session.user.id, email: session.user.email } : null;
    const result = await acceptInvite(token, { sessionUser, ...body });
    return Response.json({ ...result, message: "Invitation accepted" });
  } catch (error) {
    return errorResponse(error);
  }
}
