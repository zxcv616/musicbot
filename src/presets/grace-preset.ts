/**
 * "Grace" — elegant high-contrast serif, lowercase, white, over vivid footage.
 *
 * The refined-type-over-chaos look carrying a lot of TikTok lyric edits: a big
 * classic serif (Playfair Display, bundled via @fontsource) set clean and white
 * in the centre of the frame, while the footage underneath stays bright and
 * saturated — the tension between the graceful type and the busy, colourful
 * background IS the aesthetic. The opposite of Mood's faded film: here the
 * image is left vivid, and legibility comes from the text's own shadow + a thin
 * dark edge rather than from darkening the whole frame.
 */

import type { LyricPreset } from "./mood-preset";

export const GRACE: LyricPreset = {
  id: "grace",
  name: "Grace",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    saturation: 1.05,          // keep the footage punchy — slightly boosted
    contrast: 1.02,
    brightness: 0.95,          // a hair darker so white text reads
    liftBlacks: 0,             // no faded matte — this look is clean and vivid
    tint: { r: 255, g: 255, b: 255, strength: 0 }, // no cast
    vignette: { strength: 0.3, softness: 0.72 },   // gentle focus toward centre
    topGradient:    { color: "#000000", height: 0.2, opacity: 0.2 },
    bottomGradient: { color: "#000000", height: 0.28, opacity: 0.28 },
    grain: { opacity: 0, size: 1.4, animated: false }, // clean, no film grain
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Playfair Display", Georgia, "Times New Roman", serif',
    },
    defaultFont: "serif",      // the defining trait
    fontWeight: 400,           // Playfair's contrast is already dramatic at 400
    fontSizeVmin: 8.5,         // large, like the reference
    lineHeight: 1.16,
    letterSpacingEm: 0,        // natural serif spacing
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0,
    textTransform: "lowercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",
    verticalAnchor: 0.5,       // dead centre, like the reference
    horizontalPaddingVw: 8,
    // Soft dark halo for legibility over bright footage, plus a thin dark edge
    // so the delicate hairlines survive busy, high-contrast backgrounds.
    shadow: { color: "#000000", blur: 26, opacity: 0.55 },
    outline: { color: "#000000", widthFrac: 0.018, opacity: 0.4 },
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut in
    lineOut: { fadeMs: 0 },            // hard cut out
    wordHighlight: { enabled: false, activeColor: "#FFFFFF", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,          // footage carries its own motion; stills stay still
      zoomFrom: 1.0,
      zoomTo: 1.06,
      panXvw: 2,
      panYvh: 2,
      cycleSeconds: 9,
    },
  },
};
