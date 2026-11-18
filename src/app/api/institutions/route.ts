import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { institutionRequestSchema } from "@/lib/program-validators";
import { createInstitution, listManagedInstitutions, requestInstitution } from "@/services/institutions";

export async function GET(): Promise<Response> {
  try {
    const user = await serviceUser();
    return Response.json({ institutions: await listManagedInstitutions(user.actor) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/institutions — a Super Admin creates an approved institution;
 * anyone else submits a registration request for review.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await serviceUser();
    const input = await parseBody(req, institutionRequestSchema);
    if (can(user.actor, PERMISSIONS.INSTITUTION_CREATE, {})) {
      const institution = await createInstitution(user, input);
      return Response.json({ institution: { id: institution.id }, message: "Institution created" }, { status: 201 });
    }
    const limit = rateLimit(`institution-request:${user.id}`, { limit: 5, windowMs: 24 * 60 * 60 * 1000 });
    if (!limit.success) return Response.json({ error: "Too many requests. Try again tomorrow." }, { status: 429 });
    const institution = await requestInstitution(user, input);
    return Response.json(
      { institution: { id: institution.id }, message: "Request sent — Menty will review it shortly" },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
