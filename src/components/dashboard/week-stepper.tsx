import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function WeekStepper({
  currentWeek,
  totalWeeks,
}: {
  currentWeek: number;
  totalWeeks: number;
}) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <div className="flex min-w-max items-start gap-2 overflow-x-auto pb-2">
      {weeks.map((week, i) => {
        const done = week < currentWeek;
        const active = week === currentWeek;
        return (
          <div key={week} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
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
                  "mx-1 h-0.5 w-8 rounded-full",
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
