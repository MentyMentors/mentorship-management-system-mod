import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const VISIBLE_WEEKS = 4;

export function WeekStepper({
  currentWeek,
  totalWeeks,
}: {
  currentWeek: number;
  totalWeeks: number;
}) {
  // Show at most VISIBLE_WEEKS beads, ending on the current week where
  // possible — e.g. on week 5 that's weeks 2, 3, 4, 5. Keeps the strip a
  // fixed, small width so it never forces the page to scroll or stretch.
  const windowEnd = Math.min(totalWeeks, Math.max(currentWeek, VISIBLE_WEEKS));
  const windowStart = Math.max(1, windowEnd - VISIBLE_WEEKS + 1);
  const weeks = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i
  );

  return (
    <div className="flex items-start justify-center gap-2 sm:gap-3">
      {weeks.map((week, i) => {
        const done = week < currentWeek;
        const active = week === currentWeek;
        return (
          <div key={week} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done && "border-green bg-green text-navy",
                  active && "border-navy bg-navy text-white dark:border-primary dark:bg-primary",
                  !done && !active && "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : week}
              </div>
              <span className="text-xs text-muted-foreground">Wk {week}</span>
            </div>
            {i < weeks.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-6 shrink-0 rounded-full sm:w-10",
                  week < currentWeek ? "bg-green" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
