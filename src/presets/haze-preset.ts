/**
 * "Haze" — soft-focus white text, blurred and glowing, on a grainy black field.
 *
 * A cousin of Chroma: same flat solid-colour background approach and plain
 * lowercase Arimo, but the field is near-black under heavy grain (reads as a
 * photo of dark fabric), and instead of a chromatic split the text is pushed
 * out of focus — a real canvas blur plus a soft white bloom — for the dreamy,
 * nostalgic look. Words spread two-per-row into columns via the justified
 * layout (same as Poem). No photo, no motion; hard cuts.
 */

import type { LyricPreset } from "./mood-preset";

export const HAZE: LyricPreset = {
  id: "haze",
  name: "Haze",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    solidColor: "#0A0A0A",     // near-black field; grain gives it the texture
    saturation: 1,             // identity — applies only to uploaded media
    contrast: 1,
    brightness: 1,
    liftBlacks: 0,
    tint: { r: 255, g: 255, b: 255, strength: 0 },
    vignette: { strength: 0, softness: 0 },
    topGradient:    { color: "#000000", height: 0, opacity: 0 },
    bottomGradient: { color: "#000000", height: 0, opacity: 0 },
    grain: { opacity: 0.13, size: 1.6, animated: true }, // heavy, coarse noise
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Playfair Display", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,
    fontSizeVmin: 9.5,
    lineHeight: 1.5,           // airy rows for the two-line column layout
    letterSpacingEm: 0,
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0.055,       // the signature: text clearly out of focus
    textTransform: "lowercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "justify",      // spread each row's words into columns
    wrapMaxWords: 2,           // deliberate two-word-per-row stacked chunks
    verticalAnchor: 0.5,
    horizontalPaddingVw: 12,
    shadow: { color: "#FFFFFF", blur: 32, opacity: 0.45 }, // soft white bloom
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut in
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
      cycleSeconds: 9,
    },
  },
};
