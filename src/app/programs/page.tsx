import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchPrograms, marketplaceFacets } from "@/services/marketplace";
import { PublicFooter, PublicHeader } from "@/components/site/public-header";
import { ProgramCard } from "@/components/program/program-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DELIVERY_MODE_LABEL, DELIVERY_MODEL_LABEL } from "@/components/program/labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find a mentorship programme",
  description: "Browse mentorship programmes run by universities, organisations and mentors on Menty.",
};

type Search = Record<string, string | undefined>;

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim().slice(0, 100) || undefined,
    institution: sp.institution || undefined,
    category: sp.category || undefined,
    model: sp.model || undefined,
    mode: sp.mode || undefined,
    open: sp.open === "1",
    audience: sp.audience?.trim().slice(0, 100) || undefined,
    tag: sp.tag || undefined,
  };
  const [programs, facets] = await Promise.all([searchPrograms(filters), marketplaceFacets()]);
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="container flex-1 space-y-8 py-10">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-navy dark:text-foreground sm:text-4xl">
            Find a mentorship programme
          </h1>
          <p className="text-muted-foreground">
            Programmes run by universities, organisations, lecturers and mentors — open to students from any institution unless a programme says otherwise.
          </p>
        </div>

        <form className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-4" action="/programs">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input name="q" defaultValue={filters.q} placeholder="Search programmes, topics, institutions" className="pl-9" />
          </div>
          <select name="institution" defaultValue={filters.institution ?? ""} className={selectClass} aria-label="Institution">
            <option value="">All organisers</option>
            <option value="menty">Menty</option>
            <option value="independent">Independent programmes</option>
            {facets.institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <select name="category" defaultValue={filters.category ?? ""} className={selectClass} aria-label="Category">
            <option value="">All categories</option>
            {facets.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="model" defaultValue={filters.model ?? ""} className={selectClass} aria-label="Mentorship model">
            <option value="">Any format</option>
            {Object.entries(DELIVERY_MODEL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="mode" defaultValue={filters.mode ?? ""} className={selectClass} aria-label="Online or in person">
            <option value="">Online or in person</option>
            {Object.entries(DELIVERY_MODE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="tag" defaultValue={filters.tag ?? ""} className={selectClass} aria-label="Career interest">
            <option value="">Any career interest</option>
            {facets.tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Input name="audience" defaultValue={filters.audience} placeholder="Audience, e.g. first-year" />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="open" value="1" defaultChecked={filters.open} className="h-4 w-4" />
            Only programmes open for registration
          </label>
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            {active && <Button variant="ghost" asChild><Link href="/programs">Clear</Link></Button>}
            <Button type="submit">Search</Button>
          </div>
        </form>

        <p className="text-sm text-muted-foreground">
          {programs.length} programme{programs.length === 1 ? "" : "s"}
        </p>
        {programs.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <p className="font-medium">No programmes match.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try fewer filters — or <Link href="/run" className="underline">start one yourself</Link>.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
