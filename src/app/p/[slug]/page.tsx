import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, Target, Users } from "lucide-react";
import { loadPublicProgram } from "@/services/public-programs";
import { ProgramThemeScope } from "@/components/program/theme-scope";
import { ProgramHero } from "@/components/program/program-hero";
import { ELIGIBILITY_LABEL } from "@/components/program/labels";
import { Logo } from "@/components/logo";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const data = await loadPublicProgram(slug, preview === "1");
  if (!data) return { title: "Programme not found" };
  const { program } = data;
  return {
    title: program.name,
    description: program.tagline ?? program.description?.slice(0, 160) ?? undefined,
    robots: program.visibility === "PUBLIC" && !data.preview ? undefined : { index: false, follow: false },
    openGraph: program.coverImageUrl ? { images: [program.coverImageUrl] } : undefined,
  };
}

function registrationState(p: { status: string; registrationOpensAt: Date | null; registrationClosesAt: Date | null }) {
  const now = new Date();
  if (p.status === "COMPLETED") return { open: false, label: "This programme has finished" };
  if (p.status === "PAUSED") return { open: false, label: "Registration is paused" };
  if (p.registrationOpensAt && p.registrationOpensAt > now) return { open: false, label: `Registration opens ${formatDate(p.registrationOpensAt)}` };
  if (p.registrationClosesAt && p.registrationClosesAt < now) return { open: false, label: "Registration has closed" };
  return { open: true, label: p.registrationClosesAt ? `Registration open until ${formatDate(p.registrationClosesAt)}` : "Registration open" };
}

export default async function PublicProgramPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const data = await loadPublicProgram(slug, preview === "1");
  if (!data) notFound();
  const { program, theme } = data;

  const hostName = program.institution?.name ?? (program.ownerType === "PLATFORM" ? "Menty" : program.owner?.name);
  const reg = registrationState(program);
  const eligibility = (program.eligibility ?? {}) as { mode?: string; departments?: string[]; yearsOfStudy?: number[]; note?: string };

  const btn = "inline-flex h-10 items-center rounded-program bg-program-primary px-5 text-sm font-semibold text-program-primary-foreground";
  const cta = data.isMember ? (
    <Link href={`/dashboard/programs/${program.id}`} className={btn}>Open my programme</Link>
  ) : reg.open && program.visibility !== "PRIVATE" ? (
    <Link href={data.usesLegacyRegistration ? "/register" : `/p/${program.slug}/join`} className={btn}>Join programme</Link>
  ) : (
    <span className="inline-flex h-10 items-center rounded-program bg-program-accent px-5 text-sm font-semibold text-program-accent-foreground">
      {reg.label}
    </span>
  );

  return (
    <ProgramThemeScope theme={theme} className="min-h-screen">
      {data.preview && (
        <div className="bg-yellow-300 px-4 py-2 text-center text-sm font-medium text-black">
          Preview — {program.status === "DRAFT" ? "this programme is not published yet" : `status: ${program.status.toLowerCase()}`}. Draft branding shown.
        </div>
      )}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="Menty home"><Logo size={24} /></Link>
        {data.isStaff && (
          <Link href={`/manage/programs/${program.id}`} className="text-sm underline opacity-80">Manage programme</Link>
        )}
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-16">
        <ProgramHero
          data={{
            name: program.name,
            tagline: program.tagline,
            logoUrl: program.logoUrl,
            coverImageUrl: program.coverImageUrl,
            hostName,
            deliveryModel: program.deliveryModel,
            deliveryMode: program.deliveryMode,
            durationLabel: program.durationLabel,
            verified: program.verificationStatus === "VERIFIED",
          }}
          cta={cta}
        />

        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {data.isMember && program.welcomeMessage && (
              <section className="rounded-program border border-black/5 bg-program-accent/15 p-5">
                <h2 className="font-semibold">Welcome</h2>
                <p className="mt-1 whitespace-pre-line text-sm">{program.welcomeMessage}</p>
              </section>
            )}
            {program.description && (
              <section>
                <h2 className="text-lg font-semibold">About the programme</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed opacity-90">{program.description}</p>
              </section>
            )}
            {program.objectives && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Target className="h-5 w-5 text-program-primary" /> Objectives</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed opacity-90">{program.objectives}</p>
              </section>
            )}
          </div>
          <aside className="space-y-4 text-sm">
            <div className="space-y-3 rounded-program border border-black/10 p-4">
              <p className="font-semibold">{reg.label}</p>
              {(program.startsAt || program.endsAt) && (
                <p className="flex items-center gap-2 opacity-80">
                  <CalendarDays className="h-4 w-4" />
                  {program.startsAt ? formatDate(program.startsAt) : "TBC"} – {program.endsAt ? formatDate(program.endsAt) : "TBC"}
                </p>
              )}
              {program.targetAudience && (
                <p className="flex items-center gap-2 opacity-80"><Users className="h-4 w-4" /> {program.targetAudience}</p>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide opacity-60">Who can join</p>
                <p>{ELIGIBILITY_LABEL[eligibility.mode ?? "OPEN"]}</p>
                {eligibility.departments?.length ? <p className="opacity-80">{eligibility.departments.join(", ")}</p> : null}
                {eligibility.yearsOfStudy?.length ? <p className="opacity-80">Years {eligibility.yearsOfStudy.join(", ")}</p> : null}
                {eligibility.note && <p className="whitespace-pre-line opacity-80">{eligibility.note}</p>}
              </div>
              {program.capacity && <p className="opacity-80">Up to {program.capacity} participants</p>}
              {program.contactEmail && (
                <a href={`mailto:${program.contactEmail}`} className="flex items-center gap-2 text-program-primary underline">
                  <Mail className="h-4 w-4" /> {program.contactEmail}
                </a>
              )}
            </div>
            {program.careerTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {program.careerTags.map((t) => (
                  <span key={t} className="rounded-full border border-black/10 px-2.5 py-0.5 text-xs">{t}</span>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
      <footer className="pb-8 text-center text-xs opacity-60">
        Powered by <Link href="/" className="underline">Menty</Link>
      </footer>
    </ProgramThemeScope>
  );
}
