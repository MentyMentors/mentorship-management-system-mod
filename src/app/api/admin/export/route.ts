import { db } from "@/lib/db";
import { errorResponse, PERMISSIONS, requireDefaultProgramPermission } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/admin/export?type=mentors|mentees|pairings|meetings
 * Streams a CSV download for the active (or specified) semester.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { session, scope } = await requireDefaultProgramPermission(PERMISSIONS.PARTICIPANT_EXPORT);

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "mentors";
    const semesterId = url.searchParams.get("semesterId") ?? undefined;
    // Always confined to this programme's cohorts, whatever semesterId says.
    const semesterFilter = {
      semester: { programId: scope.programId },
      ...(semesterId ? { semesterId } : {}),
    };

    let csv: string;
    let filename: string;

    switch (type) {
      case "mentors": {
        const mentors = await db.mentorProfile.findMany({
          where: semesterFilter,
          include: {
            user: true,
            interests: { include: { interest: true } },
            semester: true,
            pairings: { where: { status: "ACTIVE" } },
          },
        });
        csv = toCsv(
          [
            "Name", "Email", "Phone", "Registration Number", "Year of Study",
            "Programme", "Department", "Strong Modules", "Interests",
            "Hours/Week", "Max Mentees", "Active Mentees",
            "Cross Department", "Status", "Semester",
          ],
          mentors.map((m) => [
            m.user.name, m.user.email, m.user.phone ?? "",
            m.registrationNumber, m.yearOfStudy, m.programme, m.department,
            m.strongModules.join("; "),
            m.interests.map((i) => i.interest.name).join("; "),
            m.hoursPerWeek, m.maxMentees, m.pairings.length,
            m.crossDepartment ? "Yes" : "No", m.user.status, m.semester.name,
          ])
        );
        filename = "mentors.csv";
        break;
      }
      case "mentees": {
        const mentees = await db.menteeProfile.findMany({
          where: semesterFilter,
          include: {
            user: true,
            interests: { include: { interest: true } },
            semester: true,
            pairings: {
              where: { status: "ACTIVE" },
              include: { mentorProfile: { include: { user: true } } },
            },
          },
        });
        csv = toCsv(
          [
            "Name", "Email", "Phone", "Registration Number", "Programme",
            "Department", "Same Department Preferred", "Interests",
            "Waitlisted", "Assigned Mentor", "Status", "Semester",
          ],
          mentees.map((m) => [
            m.user.name, m.user.email, m.user.phone ?? "",
            m.registrationNumber, m.programme, m.department,
            m.sameDepartmentPreferred ? "Yes" : "No",
            m.interests.map((i) => i.interest.name).join("; "),
            m.waitlisted ? "Yes" : "No",
            m.pairings[0]?.mentorProfile.user.name ?? "",
            m.user.status, m.semester.name,
          ])
        );
        filename = "mentees.csv";
        break;
      }
      case "pairings": {
        const pairings = await db.pairing.findMany({
          where: semesterFilter,
          include: {
            mentorProfile: { include: { user: true } },
            menteeProfile: { include: { user: true } },
            semester: true,
            _count: { select: { meetings: true } },
          },
        });
        csv = toCsv(
          ["Mentor", "Mentor Email", "Mentee", "Mentee Email", "Status", "Match Score", "Meetings", "Created", "Semester"],
          pairings.map((p) => [
            p.mentorProfile.user.name, p.mentorProfile.user.email,
            p.menteeProfile.user.name, p.menteeProfile.user.email,
            p.status, p.matchScore, p._count.meetings,
            p.createdAt.toISOString().slice(0, 10), p.semester.name,
          ])
        );
        filename = "pairings.csv";
        break;
      }
      case "meetings": {
        const meetings = await db.meeting.findMany({
          where: {
            programId: scope.programId,
            ...(semesterId ? { pairing: { semesterId } } : {}),
          },
          include: {
            pairing: {
              include: {
                mentorProfile: { include: { user: true } },
                menteeProfile: { include: { user: true } },
              },
            },
          },
          orderBy: { date: "desc" },
        });
        csv = toCsv(
          ["Date", "Mentor", "Mentee", "Duration (min)", "Topics", "Notes"],
          meetings.map((m) => [
            m.date.toISOString().slice(0, 10),
            m.pairing.mentorProfile.user.name,
            m.pairing.menteeProfile.user.name,
            m.durationMinutes, m.topics, m.notes ?? "",
          ])
        );
        filename = "meetings.csv";
        break;
      }
      default:
        return Response.json({ error: "Unknown export type" }, { status: 400 });
    }

    await logAudit({
      actorId: session.user.id,
      action: "data.export",
      programId: scope.programId,
      institutionId: scope.institutionId,
      metadata: { type, semesterId },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
