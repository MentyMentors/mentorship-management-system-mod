import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getJoinContext } from "@/services/join";
import { ProgramThemeScope } from "@/components/program/theme-scope";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/join/signup-form";
import { JoinForm } from "@/components/join/join-form";
import type { JoinRole } from "@/lib/join-rules";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ role?: string }> };

export default async function JoinPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { role } = await searchParams;
  const session = await auth();
  const user = session?.user?.id && session.user.email ? { id: session.user.id, email: session.user.email } : null;
  const ctx = await getJoinContext(slug, user);
  if (!ctx) notFound();
  const { program } = ctx;
  // The original MUBAS programme still uses its dedicated form.
  if (ctx.legacy) redirect(`/register${role === "MENTOR" ? "?role=mentor" : role === "MENTEE" ? "?role=mentee" : ""}`);

  const theme = await db.programTheme.findUnique({
    where: { programId_variant: { programId: program.id, variant: "PUBLISHED" } },
  });
  const here = `/p/${slug}/join${role ? `?role=${encodeURIComponent(role)}` : ""}`;
  const live = ctx.memberships.filter((m) => ["PENDING", "ACTIVE", "WAITLISTED"].includes(m.status));
  const availableRoles = ctx.roles.filter((r) => !live.some((m) => m.role === r));

  let body: React.ReactNode;
  if (!ctx.window.open) {
    body = <p className="text-center">{ctx.window.message}</p>;
  } else if (!user) {
    body = (
      <div className="space-y-4">
        <p className="text-sm opacity-80">Create a free Menty account to register. One account works for every programme on Menty.</p>
        <SignupForm next={here} />
      </div>
    );
  } else if (ctx.eligibility && !ctx.eligibility.eligible) {
    body = <p className="text-center">{ctx.eligibility.message}</p>;
  } else if (availableRoles.length === 0) {
    body = (
      <div className="space-y-3 text-center">
        <p>You have already registered for this programme.</p>
        <Link href={`/dashboard/programs/${program.id}`} className="inline-flex h-10 items-center rounded-program bg-program-primary px-5 text-sm font-semibold text-program-primary-foreground">
          Open my programme
        </Link>
      </div>
    );
  } else {
    body = (
      <JoinForm
        slug={slug}
        roles={availableRoles}
        initialRole={role as JoinRole | undefined}
        reviewMessage={
          ctx.full
            ? "The programme is full — you will join the waiting list."
            : ctx.eligibility?.eligible && ctx.eligibility.message
              ? ctx.eligibility.message
              : program.requiresApproval
                ? "The programme team reviews every registration."
                : undefined
        }
      />
    );
  }

  return (
    <ProgramThemeScope theme={theme} className="min-h-screen">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-6">
        <Link href={`/p/${slug}`} className="text-sm underline opacity-80">← {program.name}</Link>
        <Link href="/" aria-label="Menty home"><Logo size={22} /></Link>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <div className="rounded-program border border-black/10 bg-program-background p-6 shadow-sm">
          <p className="text-sm opacity-70">{program.institution?.name ?? (program.ownerType === "PLATFORM" ? "Menty" : "Independent programme")}</p>
          <h1 className="mb-6 text-2xl font-bold">Join {program.name}</h1>
          {body}
        </div>
        <p className="mt-6 text-center text-xs opacity-60">Powered by <Link href="/" className="underline">Menty</Link></p>
      </main>
    </ProgramThemeScope>
  );
}
