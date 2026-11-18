import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, CalendarDays, ClipboardList, Palette, Users } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Run a mentorship programme on Menty",
  description: "Universities, organisations and individual mentors can create, brand and manage mentorship programmes on Menty without building software.",
};

const FEATURES = [
  { icon: Palette, title: "Your brand", body: "Your logo, colours and welcome message on every programme page — Menty stays in the background." },
  { icon: Users, title: "Any format", body: "Presenter-led sessions for large groups, one-to-one mentoring, or a mix of both." },
  { icon: ClipboardList, title: "Registration your way", body: "Decide who can join, approve registrations, set capacity and open it to students from any institution." },
  { icon: CalendarDays, title: "Run it day to day", body: "Coordinators and assistants manage participants, pairings and announcements from one dashboard." },
  { icon: Building2, title: "Built for institutions", body: "Register your institution, run several programmes under it and appoint a coordinator for each." },
  { icon: BadgeCheck, title: "Verified by Menty", body: "Independent programmes can ask Menty for a verified badge so participants know who is behind them." },
];

export default function RunPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <section className="container max-w-3xl space-y-5 py-16 text-center">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-5xl">
            Run a mentorship programme
          </h1>
          <p className="text-lg text-muted-foreground">
            Whether you are a university, an organisation, a lecturer or a group of mentors, Menty gives you a ready-made home for your programme.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild><Link href="/manage/programs/new">Start a programme</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/manage/institutions/new">Register an institution</Link></Button>
          </div>
          <p className="text-sm text-muted-foreground">
            You&apos;ll be asked to log in or <Link href="/signup?next=/manage/programs/new" className="underline">create a free account</Link> first.
          </p>
        </section>
        <section className="container grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <f.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
