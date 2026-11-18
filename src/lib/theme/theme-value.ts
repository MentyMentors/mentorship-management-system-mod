import { MENTY_THEME, type Appearance, type RADIUS_OPTIONS } from "@/lib/theme/tokens";

/** Branding editor state (plain module so server pages can use it). */
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

