/**
 * "Chroma" — big lowercase sans on a flat textured colour field, with the text
 * split into red/cyan chromatic-aberration ghosts.
 *
 * The risograph / anaglyph-3D lyric look: a solid saturated background (green
 * here, like Brat's lime) carrying a fine grain so it reads as printed/woven
 * rather than digital-flat, with large plain Helvetica-style type (Arimo,
 * already bundled) centred and stacked. The signature is the colour fringe —
 * a pink/cyan offset on every letter — which the renderer's `text.chromatic`
 * effect provides. No photo treatment; the colour field IS the background.
 */

import type { LyricPreset } from "./mood-preset";

export const CHROMA: LyricPreset = {
  id: "chroma",
  name: "Chroma",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    solidColor: "#3E9B47",     // the green field; shows when no media is uploaded
    saturation: 1,             // identity — applies only to uploaded media
    contrast: 1,
    brightness: 1,
    liftBlacks: 0,
    tint: { r: 255, g: 255, b: 255, strength: 0 },
    vignette: { strength: 0, softness: 0 },        // flat, even field
    topGradient:    { color: "#000000", height: 0, opacity: 0 },
    bottomGradient: { color: "#000000", height: 0, opacity: 0 },
    grain: { opacity: 0.09, size: 1.5, animated: true }, // fine printed/woven texture
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Playfair Display", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,           // plain regular weight, like the reference
    fontSizeVmin: 13,          // big — a couple of words per row, stacked
    lineHeight: 1.1,
    letterSpacingEm: 0,
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0.004,       // a hair of softness so the fringe reads as bleed
    textTransform: "lowercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",
    verticalAnchor: 0.5,       // centred block, like the reference
    horizontalPaddingVw: 10,
    shadow: { color: "#14320F", blur: 16, opacity: 0.35 }, // soft dark-green depth
    // The signature: solid red/cyan offset copies under the white fill (anaglyph
    // fringe). additive:false so the colours stay clean over the bright green.
    chromatic: { offsetFrac: 0.022, opacity: 0.85, additive: false },
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
