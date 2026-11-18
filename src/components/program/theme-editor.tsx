"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgramThemeScope } from "@/components/program/theme-scope";
import { ProgramButton, ProgramHero, type ProgramHeroData } from "@/components/program/program-hero";
import {
  auditThemeContrast,
  buildTheme,
  MENTY_THEME,
  normaliseHex,
  RADIUS_OPTIONS,
  type Appearance,
} from "@/lib/theme/tokens";

export interface ThemeValue {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  radius: (typeof RADIUS_OPTIONS)[number];
  appearance: Appearance;
}

export const DEFAULT_THEME_VALUE: ThemeValue = {
  primaryColor: MENTY_THEME.primaryColor,
  secondaryColor: MENTY_THEME.secondaryColor,
  accentColor: MENTY_THEME.accentColor,
  backgroundColor: MENTY_THEME.backgroundColor,
  foregroundColor: MENTY_THEME.foregroundColor,
  radius: "0.75rem",
  appearance: "SYSTEM",
};

/** Generic starting palettes. Coordinators can change every colour. */
const PRESETS: { name: string; value: Partial<ThemeValue> }[] = [
  { name: "Menty", value: DEFAULT_THEME_VALUE },
  { name: "Ocean", value: { primaryColor: "#1d4ed8", secondaryColor: "#0f172a", accentColor: "#38bdf8", backgroundColor: "#f8fafc", foregroundColor: "#0f172a" } },
  { name: "Forest", value: { primaryColor: "#166534", secondaryColor: "#14532d", accentColor: "#facc15", backgroundColor: "#f7fbf7", foregroundColor: "#132018" } },
  { name: "Sunset", value: { primaryColor: "#c2410c", secondaryColor: "#431407", accentColor: "#fbbf24", backgroundColor: "#fffaf5", foregroundColor: "#27150b" } },
  { name: "Royal", value: { primaryColor: "#6d28d9", secondaryColor: "#2e1065", accentColor: "#f472b6", backgroundColor: "#faf8ff", foregroundColor: "#1e1035" } },
  { name: "Night", value: { primaryColor: "#14b8a6", secondaryColor: "#020617", accentColor: "#a3e635", backgroundColor: "#0b1220", foregroundColor: "#e2e8f0", appearance: "DARK" } },
];

const COLOUR_FIELDS: { key: keyof Pick<ThemeValue, "primaryColor" | "secondaryColor" | "accentColor" | "backgroundColor" | "foregroundColor">; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Primary", hint: "Buttons and links" },
  { key: "secondaryColor", label: "Secondary", hint: "Header band" },
  { key: "accentColor", label: "Accent", hint: "Highlights and badges" },
  { key: "backgroundColor", label: "Background", hint: "Page background" },
  { key: "foregroundColor", label: "Text", hint: "Body text" },
];

function ColourInput({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normaliseHex(value) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border bg-transparent p-0.5"
          aria-label={`${label} colour`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs" maxLength={7} />
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Colour/shape controls with a live preview of the programme page and a
 * WCAG contrast check. The same component powers the creation wizard and
 * the branding settings tab.
 */
export function ThemeEditor({
  value,
  onChange,
  preview,
}: {
  value: ThemeValue;
  onChange: (next: ThemeValue) => void;
  preview: ProgramHeroData & { welcomeMessage?: string | null };
}) {
  const valid = COLOUR_FIELDS.every((f) => normaliseHex(value[f.key]));
  const tokens = valid
    ? buildTheme(
        {
          primaryColor: normaliseHex(value.primaryColor)!,
          secondaryColor: normaliseHex(value.secondaryColor)!,
          accentColor: normaliseHex(value.accentColor)!,
          backgroundColor: normaliseHex(value.backgroundColor)!,
          foregroundColor: normaliseHex(value.foregroundColor)!,
        },
        { radius: value.radius, appearance: value.appearance }
      )
    : null;
  const issues = tokens ? auditThemeContrast(tokens) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">Start from a palette</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange({ ...value, ...p.value } as ThemeValue)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-accent"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: p.value.primaryColor }} />
                <span className="h-3 w-3 rounded-full" style={{ background: p.value.secondaryColor }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {COLOUR_FIELDS.map((f) => (
            <ColourInput
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={value[f.key]}
              onChange={(v) => onChange({ ...value, [f.key]: v })}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Corners</Label>
            <Select value={value.radius} onValueChange={(v) => onChange({ ...value, radius: v as ThemeValue["radius"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "0rem" ? "Square" : r === "1.5rem" ? "Very round" : r === "0.375rem" ? "Slightly round" : r === "1rem" ? "Round" : "Medium"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Appearance</Label>
            <Select value={value.appearance} onValueChange={(v) => onChange({ ...value, appearance: v as Appearance })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SYSTEM">Follow visitor&apos;s setting</SelectItem>
                <SelectItem value="LIGHT">Always light</SelectItem>
                <SelectItem value="DARK">Always dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!valid ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Use colours like #1d4ed8.
          </p>
        ) : issues.length > 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Some text would be hard to read
            </p>
            <ul className="mt-1 list-disc pl-6 text-xs text-muted-foreground">
              {issues.map((i) => (
                <li key={i.pair}>
                  {i.pair}: {i.ratio}:1 (needs {i.required}:1)
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> All text meets accessibility contrast (WCAG AA).
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-muted/30 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
        <ProgramThemeScope theme={tokens ?? MENTY_THEME} className="space-y-4 rounded-program p-4">
          <ProgramHero data={preview} cta={<ProgramButton>Join programme</ProgramButton>} />
          <div className="rounded-program border border-black/5 bg-program-background p-4">
            <p className="text-sm font-semibold">Welcome</p>
            <p className="mt-1 text-sm opacity-80">
              {preview.welcomeMessage || "Your welcome message appears here for participants."}
            </p>
            <span className="mt-3 inline-block rounded-full bg-program-accent px-2.5 py-0.5 text-xs font-medium text-program-accent-foreground">
              Registration open
            </span>
          </div>
          <p className="text-center text-[11px] opacity-60">Powered by Menty</p>
        </ProgramThemeScope>
      </div>
    </div>
  );
}

export function themeIssuesFor(value: ThemeValue): number {
  const colours = [value.primaryColor, value.secondaryColor, value.accentColor, value.backgroundColor, value.foregroundColor].map(normaliseHex);
  if (colours.some((c) => !c)) return 1;
  const [primaryColor, secondaryColor, accentColor, backgroundColor, foregroundColor] = colours as string[];
  return auditThemeContrast(buildTheme({ primaryColor, secondaryColor, accentColor, backgroundColor, foregroundColor })).length;
}
