import { describe, it, expect } from "vitest";
import { buildEffectivePreset } from "./presetUtils";
import { MOOD, TEXT_COLOR_OPTIONS, ASPECT_OPTIONS } from "../presets/mood-preset";
import { BRAT } from "../presets/brat-preset";
import { TYPEWRITER } from "../presets/typewriter-preset";

describe("buildEffectivePreset", () => {
  it("preserves the base preset id", () => {
    expect(buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]).id).toBe("mood");
    expect(buildEffectivePreset(BRAT, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]).id).toBe("brat");
  });

  it("applies aspect ratio dimensions", () => {
    const sq = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[1]);
    expect(sq.output.width).toBe(1080);
    expect(sq.output.height).toBe(1080);
    const wide = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[2]);
    expect(wide.output.width).toBe(1920);
    expect(wide.output.height).toBe(1080);
  });

  it("applies text color and matching halo from the color option", () => {
    const black = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[2], ASPECT_OPTIONS[0]);
    expect(black.text.color).toBe("#121212");
    expect(black.text.shadow.color).toBe("#FFFFFF");
    expect(black.text.shadow.opacity).toBe(TEXT_COLOR_OPTIONS[2].haloOpacity);
  });

  it("does not mutate the base MOOD preset", () => {
    buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[1], ASPECT_OPTIONS[1]);
    expect(MOOD.output.width).toBe(1080);
    expect(MOOD.output.height).toBe(1920);
    expect(MOOD.text.color).toBe("#F4F1EA");
  });

  it("does not mutate the base BRAT preset", () => {
    buildEffectivePreset(BRAT, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[1]);
    expect(BRAT.output.height).toBe(1920);
    expect(BRAT.text.color).toBe("#121212");
  });

  it("defaults textScale to 1 (no change to fontSizeVmin)", () => {
    const ep = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]);
    expect(ep.text.fontSizeVmin).toBe(MOOD.text.fontSizeVmin);
  });

  it("scales fontSizeVmin by textScale", () => {
    const bigger = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0], 1.5);
    expect(bigger.text.fontSizeVmin).toBeCloseTo(MOOD.text.fontSizeVmin * 1.5);
    const smaller = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0], 0.5);
    expect(smaller.text.fontSizeVmin).toBeCloseTo(MOOD.text.fontSizeVmin * 0.5);
  });

  it("preserves non-overridden preset fields", () => {
    const ep = buildEffectivePreset(BRAT, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]);
    expect(ep.background.solidColor).toBe("#8ACE00");
    expect(ep.text.fontWeight).toBe(400);
    expect(ep.text.verticalScale).toBe(1.45);
    expect(ep.text.blurFontFrac).toBe(0);
    expect(ep.text.horizontalScale).toBe(0.78);
  });
});

describe("BRAT preset values", () => {
  it("has the expected lime solidColor", () => {
    expect(BRAT.background.solidColor).toBe("#8ACE00");
  });

  it("has no grain, vignette, or gradients", () => {
    expect(BRAT.background.grain.opacity).toBe(0);
    expect(BRAT.background.vignette.strength).toBe(0);
    expect(BRAT.background.topGradient.opacity).toBe(0);
    expect(BRAT.background.bottomGradient.opacity).toBe(0);
  });

  it("has regular weight and vertical stretch", () => {
    expect(BRAT.text.fontWeight).toBe(400);
    expect(BRAT.text.verticalScale).toBeGreaterThan(1);
    expect(BRAT.text.horizontalScale).toBeLessThan(1);
  });

  it("has no blur and no shadow halo", () => {
    expect(BRAT.text.blurFontFrac).toBe(0);
    expect(BRAT.text.shadow.opacity).toBe(0);
  });

  it("uses lowercase black text", () => {
    expect(BRAT.text.textTransform).toBe("lowercase");
    expect(BRAT.text.color).toBe("#121212");
  });
});

describe("TYPEWRITER preset values", () => {
  it("uses a bundled monospace font at regular weight", () => {
    expect(TYPEWRITER.text.fonts.sans).toContain("Courier Prime");
    expect(TYPEWRITER.text.fonts.sans).toContain("monospace");
    expect(TYPEWRITER.text.fontWeight).toBe(400);
  });

  it("is quieter than Mood: smaller text, no motion, lowercase", () => {
    expect(TYPEWRITER.text.fontSizeVmin).toBeLessThan(MOOD.text.fontSizeVmin);
    expect(TYPEWRITER.motion.kenBurns.enabled).toBe(false);
    expect(TYPEWRITER.text.textTransform).toBe("lowercase");
  });

  it("keeps the filmic treatment (grain, vignette, lifted blacks)", () => {
    expect(TYPEWRITER.background.grain.opacity).toBeGreaterThan(0);
    expect(TYPEWRITER.background.vignette.strength).toBeGreaterThan(0);
    expect(TYPEWRITER.background.liftBlacks).toBeGreaterThan(0);
  });

  it("has a legibility halo for the thin monospace strokes", () => {
    expect(TYPEWRITER.text.shadow.opacity).toBeGreaterThan(0);
    expect(TYPEWRITER.text.shadow.blur).toBeGreaterThan(0);
  });
});

describe("MOOD preset values", () => {
  it("has neutral verticalScale and no blur", () => {
    expect(MOOD.text.verticalScale).toBe(1);
    expect(MOOD.text.blurFontFrac).toBe(0);
  });

  it("has no solidColor (uses image treatment)", () => {
    expect(MOOD.background.solidColor).toBeUndefined();
  });
});
