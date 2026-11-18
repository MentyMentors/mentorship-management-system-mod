import { errorResponse } from "@/lib/authz";
import { parseBody, serviceUser } from "@/lib/api";
import { themeInputSchema } from "@/lib/program-validators";
import { publishTheme, saveDraftTheme } from "@/services/programs";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/programs/:id/theme — save the draft theme; returns contrast issues. */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    const input = await parseBody(req, themeInputSchema);
    const { issues } = await saveDraftTheme(user, id, input);
    return Response.json({ issues, message: issues.length ? "Draft saved — fix contrast before publishing" : "Draft saved" });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/programs/:id/theme — publish the draft theme. */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  try {
    const user = await serviceUser();
    const { id } = await params;
    await publishTheme(user, id);
    return Response.json({ message: "Branding published" });
  } catch (error) {
    return errorResponse(error);
  }
}
