import { describe, it, expect } from "vitest";
import { buildEffectivePreset } from "./presetUtils";
import { MOOD, TEXT_COLOR_OPTIONS, ASPECT_OPTIONS } from "../presets/mood-preset";
import { BRAT } from "../presets/brat-preset";
import { TYPEWRITER } from "../presets/typewriter-preset";
import { GRIT } from "../presets/grit-preset";
import { POEM } from "../presets/poem-preset";
import { GRACE } from "../presets/grace-preset";
import { HAZE } from "../presets/haze-preset";
import { PAPER } from "../presets/paper-preset";
import { CHROMA } from "../presets/chroma-preset";

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

  it("injects noiseIntensity and flipX (default off, and does not mutate base)", () => {
    const def = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]);
    expect(def.noiseIntensity).toBe(0);
    expect(def.flipX).toBe(false);
    const set = buildEffectivePreset(
      MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0], 1, 0.15, true,
    );
    expect(set.noiseIntensity).toBeCloseTo(0.15);
    expect(set.flipX).toBe(true);
    expect(MOOD.flipX).toBeUndefined(); // base preset untouched
  });

  it("injects backgroundBlur (default 0, and does not mutate base)", () => {
    const def = buildEffectivePreset(MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0]);
    expect(def.backgroundBlur).toBe(0);
    const set = buildEffectivePreset(
      MOOD, TEXT_COLOR_OPTIONS[0], ASPECT_OPTIONS[0], 1, 0, false, 0.5,
    );
    expect(set.backgroundBlur).toBe(0.5);
    expect(MOOD.backgroundBlur).toBeUndefined(); // base preset untouched
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

describe("GRIT preset values", () => {
  it("uses heavy condensed caps (Anton) at dominant size", () => {
    expect(GRIT.text.fonts.sans).toContain("Anton");
    expect(GRIT.text.textTransform).toBe("uppercase");
    expect(GRIT.text.fontSizeVmin).toBeGreaterThan(MOOD.text.fontSizeVmin);
  });

  it("crushes blacks instead of lifting them", () => {
    expect(GRIT.background.liftBlacks).toBe(0);
    expect(GRIT.background.contrast).toBeGreaterThan(1);
    expect(GRIT.background.brightness).toBeLessThan(0.9);
  });

  it("glows light-on-light rather than a dark halo", () => {
    expect(GRIT.text.color).toBe("#FFFFFF");
    expect(GRIT.text.shadow.color).not.toBe("#000000");
    expect(GRIT.text.shadow.blur).toBeGreaterThan(15);
  });

  it("has the VHS treatment: ring, chromatic ghosts, scanlines", () => {
    expect(GRIT.text.outline?.opacity).toBeGreaterThan(0);
    expect(GRIT.text.outline?.widthFrac).toBeGreaterThan(0);
    expect(GRIT.text.chromatic?.opacity).toBeGreaterThan(0);
    expect(GRIT.background.scanlines?.opacity).toBeGreaterThan(0);
  });
});

describe("POEM preset values", () => {
  it("justifies a narrow column of small lowercase text", () => {
    expect(POEM.text.textAlign).toBe("justify");
    expect(POEM.text.horizontalPaddingVw).toBeGreaterThan(20); // narrow column
    expect(POEM.text.fontSizeVmin).toBeLessThan(TYPEWRITER.text.fontSizeVmin);
    expect(POEM.text.textTransform).toBe("lowercase");
  });

  it("keeps the background nearly untreated", () => {
    expect(POEM.background.saturation).toBeGreaterThanOrEqual(0.85);
    expect(POEM.background.grain.opacity).toBeLessThan(0.06);
    expect(POEM.motion.kenBurns.enabled).toBe(false);
  });

  it("hard-cuts between lines like the reference (no fades)", () => {
    expect(POEM.text.lineIn.fadeMs).toBe(0);
    expect(POEM.text.lineOut.fadeMs).toBe(0);
  });
});

describe("GRACE preset values", () => {
  it("uses a high-contrast serif as its default font", () => {
    expect(GRACE.text.defaultFont).toBe("serif");
    expect(GRACE.text.fonts.serif).toContain("Playfair Display");
    expect(GRACE.text.textTransform).toBe("lowercase");
  });

  it("keeps the footage vivid rather than faded", () => {
    expect(GRACE.background.saturation).toBeGreaterThanOrEqual(1);
    expect(GRACE.background.liftBlacks).toBe(0);
    expect(GRACE.background.grain.opacity).toBe(0);
  });

  it("carries legibility on the text (shadow + thin edge), not the grade", () => {
    expect(GRACE.text.shadow.opacity).toBeGreaterThan(0);
    expect(GRACE.text.outline?.opacity).toBeGreaterThan(0);
    expect(GRACE.text.color).toBe("#FFFFFF");
  });
});

describe("CHROMA preset values", () => {
  it("is a flat solid-colour field with grain texture", () => {
    expect(CHROMA.background.solidColor).toBeDefined();
    expect(CHROMA.background.vignette.strength).toBe(0);
    expect(CHROMA.background.grain.opacity).toBeGreaterThan(0);
  });

  it("has the chromatic-aberration fringe on big lowercase sans", () => {
    expect(CHROMA.text.chromatic?.opacity).toBeGreaterThan(0);
    expect(CHROMA.text.textTransform).toBe("lowercase");
    expect(CHROMA.text.fontSizeVmin).toBeGreaterThan(MOOD.text.fontSizeVmin);
  });
});

describe("HAZE preset values", () => {
  it("is crisp white text with a tight halo on a solid dark field", () => {
    expect(HAZE.background.solidColor).toBeDefined();
    expect(HAZE.text.blurFontFrac).toBe(0);                  // crisp, not soft-focus
    expect(HAZE.text.shadow.color).toBe("#FFFFFF");          // white halo
    expect(HAZE.text.shadow.opacity).toBeGreaterThan(0);
    expect(HAZE.text.color).toBe("#FFFFFF");
  });

  it("uses justified two-word-per-row columns, fine static grain, no chromatic", () => {
    expect(HAZE.text.textAlign).toBe("justify");
    expect(HAZE.text.wrapMaxWords).toBe(2);
    expect(HAZE.background.grain.opacity).toBeGreaterThan(0.1);
    expect(HAZE.background.grain.size).toBeLessThanOrEqual(1); // fine per-pixel static
    expect(HAZE.text.chromatic).toBeUndefined();
  });
});

describe("PAPER preset values", () => {
  it("is bold near-black justified text on a flat white field", () => {
    expect(PAPER.background.solidColor).toBe("#FFFFFF");
    expect(PAPER.text.fontWeight).toBe(700);
    expect(PAPER.text.textAlign).toBe("justify");
    expect(PAPER.text.textTransform).toBe("lowercase");
  });

  it("is completely clean — no grain, no shadow, no motion", () => {
    expect(PAPER.background.grain.opacity).toBe(0);
    expect(PAPER.text.shadow.blur).toBe(0);
    expect(PAPER.background.vignette.strength).toBe(0);
    expect(PAPER.motion.kenBurns.enabled).toBe(false);
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
