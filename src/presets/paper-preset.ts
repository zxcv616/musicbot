/**
 * "Paper" — bold black lowercase sans, justified, on a flat white field.
 *
 * The stark notes-app / diary-caption look: a plain white background (baked-in
 * solidColor, like Brat) with big bold Arimo (Arial-Bold-metric, already
 * bundled) in near-black, words spread edge-to-edge by the justified layout.
 * No grade, no grain, no shadow — the whole point is dead-simple contrast.
 */

import type { LyricPreset } from "./mood-preset";

export const PAPER: LyricPreset = {
  id: "paper",
  name: "Paper",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    solidColor: "#FFFFFF",     // flat white field; shows when no media uploaded
    saturation: 1,             // identity — applies only to uploaded media
    contrast: 1,
    brightness: 1,
    liftBlacks: 0,
    tint: { r: 255, g: 255, b: 255, strength: 0 },
    vignette: { strength: 0, softness: 0 },
    topGradient:    { color: "#000000", height: 0, opacity: 0 },
    bottomGradient: { color: "#000000", height: 0, opacity: 0 },
    grain: { opacity: 0, size: 1, animated: false }, // clean, no texture
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Playfair Display", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 700,           // bold, like the reference
    fontSizeVmin: 9,
    lineHeight: 1.35,
    letterSpacingEm: 0,
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0,
    textTransform: "lowercase",
    color: "#121212",          // near-black (default colour is Black)
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "justify",      // words spread edge-to-edge across the column
    wrapMaxWords: 3,           // even three-word-per-row rhythm, like the reference
    verticalAnchor: 0.5,
    horizontalPaddingVw: 8,
    shadow: { color: "#000000", blur: 0, opacity: 0 }, // none — crisp on white
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut in
    lineOut: { fadeMs: 0 },            // hard cut out
    wordHighlight: { enabled: false, activeColor: "#000000", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,
      zoomFrom: 1.0,
      zoomTo: 1.05,
      panXvw: 2,
      panYvh: 2,
      cycleSeconds: 9,
    },
  },
};
