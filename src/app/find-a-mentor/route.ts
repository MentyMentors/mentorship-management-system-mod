import { db } from "@/lib/db";

/**
 * GET /find-a-mentor?role=MENTEE|MENTOR — the homepage "Find your mentor" and
 * "Become a mentor" buttons. Sends people to Menty's own volunteer network,
 * whichever programme the platform setting names (no slug in the homepage).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const role = url.searchParams.get("role") === "MENTOR" ? "MENTOR" : "MENTEE";
  const setting = await db.platformSetting.findUnique({ where: { key: "platform.volunteer_program_id" } });
  const program = setting
    ? await db.mentorshipProgram.findUnique({ where: { id: setting.value }, select: { slug: true } })
    : null;
  const target = program ? `/p/${program.slug}/join?role=${role}` : "/programs";
  return Response.redirect(new URL(target, url.origin), 302);
}
