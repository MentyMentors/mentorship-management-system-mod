import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, Settings } from "lucide-react";
import type { Audience } from "@prisma/client";
import { db } from "@/lib/db";
import { signedInPage } from "@/lib/admin-pages";
import { can } from "@/lib/rbac/authorize";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ProgramThemeScope } from "@/components/program/theme-scope";
import { ProgramHero } from "@/components/program/program-hero";
import { ProgramSwitcher } from "@/components/dashboard/program-switcher";
import { WithdrawButton } from "@/components/dashboard/withdraw-button";
import { MEMBERSHIP_STATUS_LABEL, ROLE_LABEL } from "@/components/dashboard/membership-labels";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** A participant's home for one programme, in the programme's own branding. */
export default async function ProgramHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, actor } = await signedInPage();
  const userId = session.user.id;

  const program = await db.mentorshipProgram.findUnique({
    where: { id },
    include: {
      institution: { select: { name: true } },
      owner: { select: { name: true } },
      themes: { where: { variant: "PUBLISHED" } },
    },
  });
  if (!program) notFound();
  const scope = { programId: program.id, institutionId: program.institutionId };
  const isStaff = can(actor, PERMISSIONS.PROGRAM_READ, scope);
  const [mine, allMine] = await Promise.all([
    db.programMembership.findMany({ where: { programId: id, userId, status: { not: "REMOVED" } } }),
    db.programMembership.findMany({
      where: { userId, status: { notIn: ["REMOVED", "WITHDRAWN", "REJECTED"] } },
      select: { program: { select: { id: true, name: true } } },
      distinct: ["programId"],
    }),
  ]);
  if (mine.length === 0 && !isStaff) notFound();

  const activeRoles = mine.filter((m) => m.status === "ACTIVE").map((m) => m.role);
  const audiences: Audience[] = isStaff
    ? ["ALL", "MENTORS", "MENTEES"]
    : ["ALL", ...(activeRoles.includes("MENTOR") ? (["MENTORS"] as const) : []), ...(activeRoles.includes("MENTEE") ? (["MENTEES"] as const) : [])];
  const [announcements, pairings] = await Promise.all([
    activeRoles.length || isStaff
      ? db.announcement.findMany({ where: { programId: id, audience: { in: audiences } }, orderBy: { createdAt: "desc" }, take: 10 })
      : Promise.resolve([]),
    db.pairing.findMany({
      where: { programId: id, status: "ACTIVE", OR: [{ mentorProfile: { userId } }, { menteeProfile: { userId } }] },
      include: {
        mentorProfile: { select: { userId: true, user: { select: { name: true, email: true } } } },
        menteeProfile: { select: { userId: true, user: { select: { name: true, email: true } } } },
      },
    }),
  ]);

  const host = program.institution?.name ?? (program.ownerType === "PLATFORM" ? "Menty" : program.owner?.name);
  const panel = "rounded-program border border-black/10 bg-program-background p-5";

  return (
    <ProgramThemeScope theme={program.themes[0]} className="-m-4 space-y-6 rounded-program p-4 md:-m-8 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="text-sm underline opacity-80">← My dashboard</Link>
        <div className="flex items-center gap-2">
          <ProgramSwitcher programs={allMine.map((m) => m.program)} currentId={id} />
          {isStaff && (
            <Link href={`/manage/programs/${id}`} className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm">
              <Settings className="h-4 w-4" /> Manage
            </Link>
          )}
        </div>
      </div>

      <ProgramHero
        data={{
          name: program.name,
          tagline: program.tagline,
          logoUrl: program.logoUrl,
          coverImageUrl: program.coverImageUrl,
          hostName: host,
          deliveryModel: program.deliveryModel,
          deliveryMode: program.deliveryMode,
          durationLabel: program.durationLabel,
          verified: program.verificationStatus === "VERIFIED",
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {activeRoles.length > 0 && program.welcomeMessage && (
            <section className={panel}>
              <h2 className="font-semibold">Welcome</h2>
              <p className="mt-1 whitespace-pre-line text-sm">{program.welcomeMessage}</p>
            </section>
          )}
          {mine.some((m) => m.status === "PENDING" || m.status === "WAITLISTED") && (
            <section className={panel}>
              <h2 className="font-semibold">Your registration is being reviewed</h2>
              <p className="mt-1 text-sm opacity-80">You will get an email when the programme team decides. Programme content appears here once you are accepted.</p>
            </section>
          )}
          {pairings.length > 0 && (
            <section className={panel}>
              <h2 className="font-semibold">Your mentorship</h2>
              {pairings.map((p) => {
                const other = p.mentorProfile.userId === userId ? p.menteeProfile : p.mentorProfile;
                const label = p.mentorProfile.userId === userId ? "Your mentee" : "Your mentor";
                return (
                  <p key={p.id} className="mt-2 text-sm">
                    {label}: <strong>{other.user.name}</strong> · <a className="text-program-primary underline" href={`mailto:${other.user.email}`}>{other.user.email}</a>
                  </p>
                );
              })}
            </section>
          )}
          <section className={panel}>
            <h2 className="font-semibold">Announcements</h2>
            {announcements.length === 0 ? (
              <p className="mt-1 text-sm opacity-70">Nothing yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="border-l-4 border-program-primary pl-3">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">{formatDateTime(a.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-line text-sm">{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className={panel}>
            <h2 className="font-semibold">Your roles</h2>
            {mine.length === 0 && <p className="mt-1 text-sm opacity-70">You manage this programme.</p>}
            <ul className="mt-2 space-y-2">
              {mine.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {ROLE_LABEL[m.role]} · <span className="opacity-70">{MEMBERSHIP_STATUS_LABEL[m.status]}</span>
                  </span>
                  {["PENDING", "ACTIVE", "WAITLISTED"].includes(m.status) && m.role !== "PRESENTER" && m.role !== "FACILITATOR" && (
                    <WithdrawButton membershipId={m.id} pending={m.status !== "ACTIVE"} />
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className={`${panel} space-y-2 text-sm`}>
            {program.contactEmail && (
              <a href={`mailto:${program.contactEmail}`} className="flex items-center gap-2 text-program-primary underline">
                <Mail className="h-4 w-4" /> {program.contactEmail}
              </a>
            )}
            <Link href={`/p/${program.slug}`} className="flex items-center gap-2 underline">
              <ExternalLink className="h-4 w-4" /> Programme page
            </Link>
            <p className="text-xs opacity-60">Sessions, resources and milestones will appear here as the programme adds them.</p>
          </section>
        </aside>
      </div>
      <p className="text-center text-xs opacity-60">Powered by Menty</p>
    </ProgramThemeScope>
  );
}
