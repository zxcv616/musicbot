/**
 * "Poem" — small lowercase sans, justified in a narrow column, over soft dusk.
 *
 * The quiet indie look: a slim column of light Helvetica-style text (Arimo,
 * already bundled) where every row is spread to fill the column — the word
 * gaps stretching to align both edges are the signature. Text stays small and
 * unhurried; the background barely treated, just gently darkened so white text
 * reads over a sunset. Calm over impact — the counterpart to Grit.
 *
 * The column width is set via horizontalPaddingVw: large padding = narrow
 * column (justify spreads rows across whatever width remains).
 */

import type { LyricPreset } from "./mood-preset";

export const POEM: LyricPreset = {
  id: "poem",
  name: "Poem",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    saturation: 0.9,           // nearly untouched — the footage carries the mood
    contrast: 0.98,
    brightness: 0.92,          // gentle darkening for white text
    liftBlacks: 0.03,
    tint: { r: 215, g: 220, b: 255, strength: 0.05 }, // faint dusk-blue cast
    vignette: { strength: 0.3, softness: 0.75 },
    topGradient:    { color: "#000000", height: 0.2, opacity: 0.25 },
    bottomGradient: { color: "#000000", height: 0.3, opacity: 0.35 },
    grain: { opacity: 0.04, size: 1.3, animated: true }, // barely-there texture
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.2,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Fraunces", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,           // light and plain, never bold
    fontSizeVmin: 4.3,         // small — a caption, not a headline
    lineHeight: 1.5,           // airy rows
    letterSpacingEm: 0,
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0,
    textTransform: "lowercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "justify",      // the signature: rows spread edge-to-edge
    verticalAnchor: 0.52,      // just above centre, like the reference
    horizontalPaddingVw: 27,   // 27vw each side → a 46vw column
    shadow: { color: "#000000", blur: 12, opacity: 0.4 }, // whisper of a halo
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut in — lines just change, like the reference
    lineOut: { fadeMs: 0 },            // hard cut out
    wordHighlight: { enabled: false, activeColor: "#FFFFFF", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,
      zoomFrom: 1.0,
      zoomTo: 1.05,
      panXvw: 2,
      panYvh: 2,
      cycleSeconds: 10,
    },
  },
};
