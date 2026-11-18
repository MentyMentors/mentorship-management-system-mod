import { errorResponse, PERMISSIONS, requireActor } from "@/lib/authz";
import { can } from "@/lib/rbac/authorize";
import { globalSearch } from "@/services/search";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/search?q= — cross-entity search scoped to the user's role. */
export async function GET(req: Request): Promise<Response> {
  try {
    const { session, actor } = await requireActor();

    const limit = rateLimit(`search:${session.user.id}`, {
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (!limit.success) {
      return Response.json({ error: "Too many searches" }, { status: 429 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";

    // Searching every person on Menty is a platform-level capability.
    const role = can(actor, PERMISSIONS.USER_READ, {})
      ? "ADMIN"
      : session.user.role === "ADMIN"
        ? "MENTEE" // legacy admin without platform rights: own records only
        : session.user.role;
    const results = await globalSearch(q, session.user.id, role);
    return Response.json(results);
  } catch (error) {
    return errorResponse(error);
  }
}
