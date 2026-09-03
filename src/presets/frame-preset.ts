/**
 * "Frame" — Haze's grainy-black look, but the lyric line is split top/bottom.
 *
 * Same near-black TV-static field and crisp white text as Haze, except the
 * active line's words are split in half: the first half sits near the top of
 * the frame, the second half near the bottom, framing the middle (where an
 * uploaded photo/video shows through). Words are centred and normally spaced
 * (like Brat), not spread edge-to-edge like Haze.
 */

import type { LyricPreset } from "./mood-preset";

export const FRAME: LyricPreset = {
  id: "frame",
  name: "Frame",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    solidColor: "#161616",     // dark charcoal — lets the static grain read
    saturation: 1,
    contrast: 1,
    brightness: 1,
    liftBlacks: 0,
    tint: { r: 255, g: 255, b: 255, strength: 0 },
    vignette: { strength: 0, softness: 0 },
    topGradient:    { color: "#000000", height: 0, opacity: 0 },
    bottomGradient: { color: "#000000", height: 0, opacity: 0 },
    grain: { opacity: 0.26, size: 1, animated: true }, // fine, per-pixel TV static
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
    fontSizeVmin: 13,          // big & impactful — wraps so it splits top/bottom
    lineHeight: 1.3,
    letterSpacingEm: 0,
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0,           // crisp
    textTransform: "lowercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",       // normal centred spacing (like Brat), not justified
    splitTopBottom: true,      // first half of the words up top, second half bottom
    verticalAnchor: 0.5,       // ignored while splitTopBottom is on
    horizontalPaddingVw: 10,
    shadow: { color: "#FFFFFF", blur: 12, opacity: 0.4 }, // tight white halo
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
