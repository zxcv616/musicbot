/**
 * "Brat" — a second aesthetic preset.
 *
 * Deliberately plain and blunt — the Brat look is intentionally generic.
 * Solid lime green background, regular-weight Arimo, all-lowercase, text
 * condensed taller/narrower than normal with a slight blur for that chunky
 * low-res-print feel. No grain, no vignette, no gradients.
 *
 * Uploaded images/videos still appear behind the text when provided; the
 * solidColor fills the frame before drawing media so it shows through only
 * when media is present.
 */

import type { LyricPreset } from "./mood-preset";

export const BRAT: LyricPreset = {
  id: "brat",
  name: "Brat",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    solidColor: "#8ACE00",  // the lime; shows when no media is uploaded
    saturation: 1,          // identity — images show as-is over the lime
    contrast: 1,
    brightness: 1,
    liftBlacks: 0,
    tint: { r: 255, g: 255, b: 255, strength: 0 },
    vignette: { strength: 0, softness: 0 },
    topGradient: { color: "#000000", height: 0, opacity: 0 },
    bottomGradient: { color: "#000000", height: 0, opacity: 0 },
    grain: { opacity: 0, size: 1, animated: false },
    lightLeak: { enabled: false, opacity: 0 },
    crossfadeSeconds: 1.2,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Fraunces", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,          // regular, not bold — blunt, not aggressive
    fontSizeVmin: 8.5,
    lineHeight: 1.14,
    letterSpacingEm: -0.04,   // same tight tracking
    horizontalScale: 0.78,    // narrower than normal
    verticalScale: 1.45,      // significantly taller — the condensed Brat proportions
    blurFontFrac: 0.04,       // ~4% of fontPx → soft chunky edge like a bad print
    textTransform: "lowercase",
    color: "#121212",         // near-black on lime
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",
    verticalAnchor: 0.5,      // centred — flat background has no "subject" to work around
    horizontalPaddingVw: 9,
    shadow: { color: "#000000", blur: 0, opacity: 0 }, // no halo — blur handles the edge
    lineIn:  { fadeMs: 0, riseVh: 0 },
    lineOut: { fadeMs: 0 },
    wordHighlight: { enabled: false, activeColor: "#8ACE00", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,
      zoomFrom: 1.0,
      zoomTo: 1.08,
      panXvw: 2,
      panYvh: 3,
      cycleSeconds: 9,
    },
  },
};
