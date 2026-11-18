/**
 * The programme theme contract (pattern from UniSpace's lib/theme/tokens.ts).
 *
 * A programme's identity is data, not code: a ProgramTheme row becomes
 * --program-* CSS custom properties on a wrapper element, and components only
 * ever use the `program-*` Tailwind colours mapped onto those properties.
 * No component names a programme or hard-codes a programme colour.
 */

export type Appearance = "LIGHT" | "DARK" | "SYSTEM";

export interface ThemeColours {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
}

export interface ThemeTokens extends ThemeColours {
  primaryContrast: string;
  secondaryContrast: string;
  accentContrast: string;
  radius: string;
  appearance: Appearance;
}

/** Menty's own brand: the default everywhere outside a programme. */
export const MENTY_THEME: ThemeTokens = {
  primaryColor: "#00727a",
  primaryContrast: "#ffffff",
  secondaryColor: "#272754",
  secondaryContrast: "#ffffff",
  accentColor: "#8fdd36",
  accentContrast: "#272754",
  backgroundColor: "#f7f9fa",
  foregroundColor: "#1a1b28",
  radius: "0.75rem",
  appearance: "SYSTEM",
};

export const RADIUS_OPTIONS = ["0rem", "0.375rem", "0.75rem", "1rem", "1.5rem"] as const;

const HEX = /^#[0-9a-f]{6}$/;

/** Lower-case #rrggbb, or null. Accepts #rgb shorthand. Nothing else. */
export function normaliseHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (HEX.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111827";

/** The more readable of white or near-black text on `background`. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

/**
 * Builds a full theme from the colours a coordinator picks. Text colours on
 * coloured surfaces are derived automatically so they stay readable.
 */
export function buildTheme(
  colours: ThemeColours,
  options: { radius?: string; appearance?: Appearance } = {}
): ThemeTokens {
  return {
    ...colours,
    primaryContrast: readableTextOn(colours.primaryColor),
    secondaryContrast: readableTextOn(colours.secondaryColor),
    accentContrast: readableTextOn(colours.accentColor),
    radius: options.radius ?? MENTY_THEME.radius,
    appearance: options.appearance ?? "SYSTEM",
  };
}

export interface ContrastIssue {
  pair: string;
  ratio: number;
  required: number;
}

/** WCAG AA for normal text. */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * Every text/background pairing a programme page uses. Publishing a theme is
 * blocked while any of these fails, so branding can never make a programme
 * unreadable.
 */
export function auditThemeContrast(theme: ThemeTokens): ContrastIssue[] {
  const pairs: [string, string, string][] = [
    ["Text on page background", theme.foregroundColor, theme.backgroundColor],
    ["Button text on primary colour", theme.primaryContrast, theme.primaryColor],
    ["Text on secondary colour", theme.secondaryContrast, theme.secondaryColor],
    ["Text on accent colour", theme.accentContrast, theme.accentColor],
  ];
  return pairs
    .map(([pair, fg, bg]) => ({ pair, ratio: Math.round(contrastRatio(fg, bg) * 100) / 100, required: MIN_TEXT_CONTRAST }))
    .filter((r) => r.ratio < MIN_TEXT_CONTRAST);
}

const CSS_VARIABLES: Record<keyof Omit<ThemeTokens, "appearance">, string> = {
  primaryColor: "--program-primary",
  primaryContrast: "--program-primary-foreground",
  secondaryColor: "--program-secondary",
  secondaryContrast: "--program-secondary-foreground",
  accentColor: "--program-accent",
  accentContrast: "--program-accent-foreground",
  backgroundColor: "--program-background",
  foregroundColor: "--program-foreground",
  radius: "--program-radius",
};

/**
 * Inline style for a theme wrapper. Every value is re-validated here, so a
 * malformed row can never inject arbitrary CSS: invalid colours fall back to
 * Menty's defaults.
 */
export function themeToCssVariables(theme: Partial<ThemeTokens> | null | undefined): Record<string, string> {
  const merged = { ...MENTY_THEME, ...(theme ?? {}) };
  const style: Record<string, string> = {};
  for (const [token, variable] of Object.entries(CSS_VARIABLES)) {
    const key = token as keyof typeof CSS_VARIABLES;
    if (key === "radius") {
      style[variable] = (RADIUS_OPTIONS as readonly string[]).includes(merged.radius) ? merged.radius : MENTY_THEME.radius;
    } else {
      style[variable] = normaliseHex(String(merged[key])) ?? MENTY_THEME[key];
    }
  }
  return style;
}
