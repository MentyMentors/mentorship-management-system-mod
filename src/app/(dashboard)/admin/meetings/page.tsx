import { Video } from "lucide-react";
import { db } from "@/lib/db";
import { programPage } from "@/lib/admin-pages";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Meeting logs" };
export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage() {
  const { scope } = await programPage(PERMISSIONS.MEETING_READ);
  const meetings = await db.meeting.findMany({
    where: { programId: scope.programId },
    include: {
      pairing: {
        include: {
          mentorProfile: { include: { user: { select: { name: true } } } },
          menteeProfile: { include: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Meeting logs"
        description="Every meeting logged by mentors across the programme."
      />
      <Card>
        <CardContent className="pt-6">
          {meetings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No meetings have been logged yet.
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="space-y-3 md:hidden">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatDate(meeting.date)}</span>
                      <span className="text-muted-foreground">
                        {meeting.durationMinutes} min
                      </span>
                    </div>
                    <p className="mt-1">
                      {meeting.pairing.mentorProfile.user.name} →{" "}
                      {meeting.pairing.menteeProfile.user.name}
                    </p>
                    <p className="mt-1 text-muted-foreground">{meeting.topics}</p>
                    {meeting.notes && (
                      <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
                        {meeting.notes}
                      </p>
                    )}
                    {meeting.zoomJoinUrl && (
                      <a
                        href={meeting.zoomJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <Video className="h-3.5 w-3.5" /> Join Zoom meeting
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Mentee</TableHead>
                    <TableHead className="hidden md:table-cell">Duration</TableHead>
                    <TableHead className="hidden lg:table-cell">Topics</TableHead>
                    <TableHead className="hidden xl:table-cell">Notes</TableHead>
                    <TableHead>Zoom</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell>{formatDate(meeting.date)}</TableCell>
                      <TableCell>
                        {meeting.pairing.mentorProfile.user.name}
                      </TableCell>
                      <TableCell>
                        {meeting.pairing.menteeProfile.user.name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {meeting.durationMinutes} min
                      </TableCell>
                      <TableCell className="hidden max-w-64 truncate lg:table-cell">
                        {meeting.topics}
                      </TableCell>
                      <TableCell className="hidden max-w-64 truncate xl:table-cell">
                        {meeting.notes ?? "—"}
                      </TableCell>
                      <TableCell>
                        {meeting.zoomJoinUrl ? (
                          <a
                            href={meeting.zoomJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Video className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
