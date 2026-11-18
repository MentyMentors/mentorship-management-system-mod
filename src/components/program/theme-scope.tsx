import type { CSSProperties, ReactNode } from "react";
import { themeToCssVariables, type ThemeTokens } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

/**
 * Applies a programme's theme to everything inside it. Rendered on the
 * server as inline CSS custom properties, so the right colours are in the
 * first byte of HTML — no flash of Menty colours, no client theme script.
 *
 * A LIGHT or DARK appearance pins the shadcn/ui palette for the programme
 * area; SYSTEM follows the visitor's own preference.
 */
export function ProgramThemeScope({
  theme,
  className,
  children,
}: {
  theme: Partial<ThemeTokens> | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  const style = themeToCssVariables(theme) as CSSProperties;
  const appearance = theme?.appearance ?? "SYSTEM";
  return (
    <div
      style={style}
      data-program-theme=""
      className={cn(
        appearance === "DARK" && "dark",
        appearance === "LIGHT" && "light",
        "bg-program-background text-program-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
