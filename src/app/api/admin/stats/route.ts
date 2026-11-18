import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { getDashboardStats, getAnalytics } from "@/services/stats";

export async function GET(req: Request): Promise<Response> {
  try {
    const { scope } = await requireDefaultProgramPermission(PERMISSIONS.PROGRAM_ANALYTICS_READ);
    const url = new URL(req.url);

    if (url.searchParams.get("view") === "analytics") {
      return Response.json(await getAnalytics(scope.programId));
    }
    return Response.json(await getDashboardStats(scope.programId));
  } catch (error) {
    return errorResponse(error);
  }
}
