import Link from "next/link";
import { Hourglass, Mail, MessagesSquare, Phone } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildWhatsAppLink, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Mentee dashboard" };
export const dynamic = "force-dynamic";

export default async function MenteeDashboardPage() {
  const session = await auth();

  const profile = await db.menteeProfile.findUnique({
    where: { userId: session!.user.id },
    include: {
      semester: true,
      pairings: {
        where: { status: "ACTIVE" },
        include: {
          mentorProfile: {
            include: {
              user: { select: { name: true, email: true, phone: true } },
              interests: { include: { interest: true } },
            },
          },
          meetings: { orderBy: { date: "desc" }, take: 5 },
        },
      },
    },
  });

  if (!profile) {
    return (
      <PageHeader
        title="No mentee profile"
        description="Your account has no mentee profile for the active semester. Contact an administrator."
      />
    );
  }

  const pairing = profile.pairings[0];
  const announcements = await db.announcement.findMany({
    // This programme's announcements, plus platform-wide ones.
    where: {
      audience: { in: ["ALL", "MENTEES"] },
      OR: [{ programId: profile.semester.programId }, { programId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <>
      <PageHeader
        title={`Hi, ${session!.user.name?.split(" ")[0]}`}
        description={`${profile.semester.name} · ${profile.department}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My mentor</CardTitle>
            <CardDescription>
              Your assigned mentor for this semester.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pairing ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Hourglass className="h-10 w-10 text-warning" />
                <p className="font-medium">
                  {profile.waitlisted
                    ? "You are on the waitlist"
                    : "No mentor assigned yet"}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  We will automatically pair you as soon as a suitable mentor
                  becomes available, and email you right away.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold">
                    {pairing.mentorProfile.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pairing.mentorProfile.programme} ·{" "}
                    {pairing.mentorProfile.department} · Year{" "}
                    {pairing.mentorProfile.yearOfStudy}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pairing.mentorProfile.strongModules.map((module) => (
                    <Badge key={module} variant="outline">
                      {module}
                    </Badge>
                  ))}
                  {pairing.mentorProfile.interests.map((i) => (
                    <Badge key={i.interestId} variant="secondary">
                      {i.interest.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${pairing.mentorProfile.user.email}`}>
                      <Mail className="h-4 w-4" />{" "}
                      {pairing.mentorProfile.user.email}
                    </a>
                  </Button>
                  {buildWhatsAppLink(pairing.mentorProfile.user.phone) && (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={buildWhatsAppLink(pairing.mentorProfile.user.phone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="h-4 w-4" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button size="sm" asChild>
                    <Link href="/messages">
                      <MessagesSquare className="h-4 w-4" /> Message
                    </Link>
                  </Button>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Recent meetings</p>
                  <div className="space-y-2">
                    {pairing.meetings.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No meetings yet — say hello and plan your first one!
                      </p>
                    )}
                    {pairing.meetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="rounded-md border p-3 text-sm"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {formatDate(meeting.date)}
                          </span>
                          <span className="text-muted-foreground">
                            {meeting.durationMinutes} min
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {meeting.topics}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing new.</p>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {a.body}
                </p>
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href="/announcements">View all</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
