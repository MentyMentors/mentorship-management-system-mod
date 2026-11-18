import { BadgeCheck, CalendarDays, MapPin, Users } from "lucide-react";
import { DELIVERY_MODE_LABEL, DELIVERY_MODEL_LABEL } from "@/components/program/labels";

export interface ProgramHeroData {
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  hostName?: string | null;
  deliveryModel: string;
  deliveryMode: string;
  durationLabel?: string | null;
  verified?: boolean;
}

/**
 * The top of a programme's public page. Uses only `program-*` colours, so it
 * renders in whichever theme surrounds it (the live branding preview uses the
 * same component). Images are plain <img>: they come from coordinator-chosen
 * https URLs on arbitrary hosts.
 */
export function ProgramHero({ data, cta }: { data: ProgramHeroData; cta?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-program border border-black/5 bg-program-secondary text-program-secondary-foreground">
      <div className="relative h-40 w-full sm:h-56">
        {data.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-program-primary to-program-secondary" />
        )}
      </div>
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt={`${data.name} logo`}
              className="-mt-14 h-20 w-20 shrink-0 rounded-program border-4 border-program-secondary bg-white object-contain"
            />
          )}
          <div className="space-y-1">
            {data.hostName && <p className="text-sm opacity-80">{data.hostName}</p>}
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              {data.name}
              {data.verified && <BadgeCheck className="h-6 w-6 text-program-accent" aria-label="Verified by Menty" />}
            </h1>
            {data.tagline && <p className="max-w-2xl opacity-90">{data.tagline}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm opacity-80">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {DELIVERY_MODEL_LABEL[data.deliveryModel] ?? data.deliveryModel}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {DELIVERY_MODE_LABEL[data.deliveryMode] ?? data.deliveryMode}
              </span>
              {data.durationLabel && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  {data.durationLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        {cta}
      </div>
    </section>
  );
}

/** A button in the programme's primary colour. */
export function ProgramButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center rounded-program bg-program-primary px-5 text-sm font-semibold text-program-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
