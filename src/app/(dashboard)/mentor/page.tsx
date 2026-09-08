import Link from "next/link";
import { ArrowRight, CalendarDays, Mail, MoreVertical, Phone, Plus, Users } from "lucide-react";
import { differenceInCalendarWeeks } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildWhatsAppLink, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WeekStepper } from "@/components/dashboard/week-stepper";
import { AnnouncementsCarousel } from "@/components/dashboard/announcements-carousel";

export const metadata = { title: "Mentor dashboard" };
export const dynamic = "force-dynamic";

function programmeWeek(startDate: Date, endDate: Date) {
  const totalWeeks = Math.max(1, differenceInCalendarWeeks(endDate, startDate) + 1);
  const rawWeek = differenceInCalendarWeeks(new Date(), startDate) + 1;
  const currentWeek = Math.min(Math.max(rawWeek, 1), totalWeeks);
  return { currentWeek, totalWeeks };
}

export default async function MentorDashboardPage() {
  const session = await auth();

  const profile = await db.mentorProfile.findUnique({
    where: { userId: session!.user.id },
    include: {
      semester: true,
      pairings: {
        where: { status: "ACTIVE" },
        include: {
          menteeProfile: {
            include: { user: { select: { name: true, phone: true, email: true } } },
          },
          meetings: { orderBy: { date: "desc" } },
        },
      },
    },
  });

  if (!profile) {
    return (
      <p className="text-muted-foreground">
        Your account has no mentor profile for the active semester. Contact an administrator.
      </p>
    );
  }

  const now = new Date();

  const monthMeetingsCount = await db.meeting.count({
    where: {
      pairing: { mentorProfileId: profile.id },
      date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
    },
  });

  const announcements = await db.announcement.findMany({
    where: { audience: { in: ["ALL", "MENTORS"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const { currentWeek, totalWeeks } = programmeWeek(
    profile.semester.startDate,
    profile.semester.endDate
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Good morning, {session!.user.name?.split(" ")[0]} 👋
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Mentor</span>
            <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-medium text-green-deep">
              Week {currentWeek} of {totalWeeks}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <Link
          href="/mentor/meetings"
          className="group flex items-center justify-between rounded-2xl bg-navy p-6 text-white transition-shadow hover:shadow-glass-lg"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Log a meeting</p>
              <p className="text-sm text-white/60">Record your check-in with a mentee</p>
            </div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green text-navy transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">My mentees</p>
            <p className="text-3xl font-bold">{profile.pairings.length}</p>
            <p className="text-xs text-muted-foreground">Active mentees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Meetings this month</p>
            <p className="text-3xl font-bold">{monthMeetingsCount}</p>
            <p className="text-xs text-muted-foreground">Across all mentees</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Programme progress</CardTitle>
            <span className="text-sm font-medium text-primary">
              Week {currentWeek} of {totalWeeks}
            </span>
          </CardHeader>
          <CardContent>
            <WeekStepper currentWeek={currentWeek} totalWeeks={totalWeeks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Announcements</CardTitle>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" asChild>
              <Link href="/announcements">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <AnnouncementsCarousel announcements={announcements} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>My mentees</CardTitle>
          <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" asChild>
            <Link href="/mentor/mentees">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {profile.pairings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No mentees assigned yet — you&apos;ll be notified by email as soon as one is paired with you.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Mentee</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Last meeting</th>
                    <th className="px-4 py-3 font-medium">Next meeting</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.pairings.map((pairing) => {
                    const mentee = pairing.menteeProfile;
                    const meetings = pairing.meetings;
                    const last = meetings.find((m) => m.date <= now);
                    const next = [...meetings].reverse().find((m) => m.date > now);
                    const progress = Math.min(100, Math.round((meetings.length / totalWeeks) * 100));
                    const whatsapp = buildWhatsAppLink(mentee.user.phone);

                    return (
                      <tr key={pairing.id} className="border-b last:border-0">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>{getInitials(mentee.user.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{mentee.user.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Reg. No. {mentee.registrationNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{mentee.department}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full bg-green"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {last ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(last.date)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {next ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(next.date)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" asChild>
                              <Link href="/mentor/meetings" aria-label="Log a meeting">
                                <CalendarDays className="h-4 w-4" />
                              </Link>
                            </Button>
                            {whatsapp && (
                              <Button size="icon" variant="ghost" asChild>
                                <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" asChild>
                              <a href={`mailto:${mentee.user.email}`} aria-label="Email">
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" aria-label="More">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href="/messages">Message</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href="/mentor/mentees">View profile</Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 py-4 text-sm text-muted-foreground">
        <span className="text-green">♥</span> Building confident students. Stronger communities. Better futures.
      </p>
    </div>
  );
}
