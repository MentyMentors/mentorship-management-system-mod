import { errorResponse, PERMISSIONS } from "@/lib/authz";
import { serviceUser } from "@/lib/api";
import { assertCan, RequestError } from "@/lib/rbac/authorize";
import { resolveProgramScope } from "@/lib/rbac/scope";
import { rateLimit } from "@/lib/rate-limit";
import { IMAGE_LIMITS, storageConfigured, storeImage } from "@/lib/storage";

const TARGETS = ["program-logo", "program-cover", "institution-logo", "institution-cover"] as const;
type Target = (typeof TARGETS)[number];

/**
 * POST /api/uploads — multipart { file, target, id }. Stores an image for a
 * programme or institution the caller may brand, and returns its URL. The
 * caller then saves the URL with the normal settings update.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await serviceUser();
    if (!storageConfigured()) {
      throw new RequestError(503, "Image uploads are not set up yet. Paste an image address instead.");
    }
    const limit = rateLimit(`upload:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
    if (!limit.success) throw new RequestError(429, "Too many uploads. Try again later.");

    const form = await req.formData();
    const file = form.get("file");
    const target = String(form.get("target") ?? "") as Target;
    const id = String(form.get("id") ?? "");
    if (!(file instanceof File)) throw new RequestError(400, "Choose an image");
    if (!TARGETS.includes(target) || !id) throw new RequestError(400, "Unknown upload target");

    if (target.startsWith("program-")) {
      const scope = await resolveProgramScope(id);
      assertCan(user.actor, PERMISSIONS.PROGRAM_BRANDING_EDIT, scope);
    } else {
      assertCan(user.actor, PERMISSIONS.INSTITUTION_BRANDING_EDIT, { institutionId: id });
    }

    const kind = target.endsWith("logo") ? "logo" : "cover";
    const folder = target.startsWith("program-") ? "programs" : "institutions";
    try {
      const url = await storeImage(`${folder}/${id}/${kind}`, file, IMAGE_LIMITS[kind]);
      return Response.json({ url });
    } catch (e) {
      throw new RequestError(422, e instanceof Error ? e.message : "Upload failed");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
