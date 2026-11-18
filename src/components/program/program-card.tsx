import Link from "next/link";
import { BadgeCheck, CalendarDays, MapPin, Users } from "lucide-react";
import { DELIVERY_MODE_LABEL, DELIVERY_MODEL_LABEL } from "@/components/program/labels";
import { normaliseHex } from "@/lib/theme/tokens";
import { formatDate } from "@/lib/utils";

export interface ProgramCardData {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  ownerType: string;
  deliveryModel: string;
  deliveryMode: string;
  targetAudience: string | null;
  durationLabel: string | null;
  status: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  verificationStatus: string;
  institution: { name: string; shortName: string | null } | null;
  owner: { name: string } | null;
  themes: { primaryColor: string }[];
}

function registration(p: ProgramCardData) {
  const now = new Date();
  if (p.status === "COMPLETED") return { open: false, label: "Finished" };
  if (p.status === "PAUSED") return { open: false, label: "Paused" };
  if (p.registrationOpensAt && p.registrationOpensAt > now) return { open: false, label: `Opens ${formatDate(p.registrationOpensAt)}` };
  if (p.registrationClosesAt && p.registrationClosesAt < now) return { open: false, label: "Registration closed" };
  return { open: true, label: p.registrationClosesAt ? `Open until ${formatDate(p.registrationClosesAt)}` : "Registration open" };
}

/** Marketplace card. The accent strip uses the programme's own primary colour. */
export function ProgramCard({ program: p }: { program: ProgramCardData }) {
  const reg = registration(p);
  const host = p.institution?.name ?? (p.ownerType === "PLATFORM" ? "Menty" : p.owner?.name ?? "Independent");
  const accent = normaliseHex(p.themes[0]?.primaryColor ?? "") ?? "#00727a";
  return (
    <Link
      href={`/p/${p.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-glass-lg"
    >
      <div className="relative h-28 w-full" style={{ background: accent }}>
        {p.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
        )}
        {p.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt="" className="absolute -bottom-6 left-4 h-12 w-12 rounded-xl border-2 border-card bg-white object-contain" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-8">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {host}
          {p.verificationStatus === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Verified" />}
        </p>
        <h3 className="font-semibold leading-snug group-hover:underline">{p.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline || p.description}</p>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{DELIVERY_MODEL_LABEL[p.deliveryModel]}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{DELIVERY_MODE_LABEL[p.deliveryMode]}</span>
          {p.durationLabel && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{p.durationLabel}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${reg.open ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {reg.label}
          </span>
          {p.category && <span className="rounded-full border px-2 py-0.5 text-xs">{p.category}</span>}
        </div>
      </div>
    </Link>
  );
}
