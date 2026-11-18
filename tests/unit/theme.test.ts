import { describe, expect, it } from "vitest";
import {
  auditThemeContrast,
  buildTheme,
  contrastRatio,
  MENTY_THEME,
  normaliseHex,
  readableTextOn,
  themeToCssVariables,
} from "@/lib/theme/tokens";
import { themeInputSchema } from "@/lib/program-validators";

describe("colour handling", () => {
  it("accepts only hex colours", () => {
    expect(normaliseHex("#ABCDEF")).toBe("#abcdef");
    expect(normaliseHex("#abc")).toBe("#aabbcc");
    expect(normaliseHex("red")).toBeNull();
    expect(normaliseHex("#12345g")).toBeNull();
    expect(normaliseHex("#000; background:url(x)")).toBeNull();
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("picks readable text automatically", () => {
    expect(readableTextOn("#00727a")).toBe("#ffffff");
    expect(readableTextOn("#ffe600")).not.toBe("#ffffff");
  });
});

describe("theme audit", () => {
  it("Menty's default theme passes", () => {
    expect(auditThemeContrast(MENTY_THEME)).toEqual([]);
  });

  it("flags unreadable text on the page background", () => {
    const t = buildTheme({ ...MENTY_THEME, backgroundColor: "#ffffff", foregroundColor: "#dddddd" });
    expect(auditThemeContrast(t).map((i) => i.pair)).toContain("Text on page background");
  });

  it("derived button text keeps primary colours readable", () => {
    for (const primary of ["#1d4ed8", "#ffcc00", "#7c3aed", "#00a86b", "#e11d48"]) {
      const t = buildTheme({ ...MENTY_THEME, primaryColor: primary });
      expect(auditThemeContrast(t).some((i) => i.pair.startsWith("Button"))).toBe(false);
    }
  });
});

describe("CSS variables", () => {
  it("never emits anything but validated values", () => {
    const vars = themeToCssVariables({
      primaryColor: "red;} body{display:none",
      radius: "999px; x",
    } as never);
    expect(vars["--program-primary"]).toBe(MENTY_THEME.primaryColor);
    expect(vars["--program-radius"]).toBe(MENTY_THEME.radius);
  });

  it("maps every token", () => {
    expect(Object.keys(themeToCssVariables(MENTY_THEME))).toEqual(
      expect.arrayContaining(["--program-primary", "--program-secondary", "--program-accent", "--program-background", "--program-foreground"])
    );
  });

  it("validates theme input from the API", () => {
    const ok = themeInputSchema.safeParse({
      primaryColor: "#123ABC",
      secondaryColor: "#000000",
      accentColor: "#fff",
      backgroundColor: "#ffffff",
      foregroundColor: "#111111",
      radius: "1rem",
      appearance: "LIGHT",
    });
    expect(ok.success && ok.data.primaryColor).toBe("#123abc");
    expect(themeInputSchema.safeParse({ ...(ok.success ? ok.data : {}), radius: "50px" }).success).toBe(false);
  });
});
