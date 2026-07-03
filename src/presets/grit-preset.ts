/**
 * "Grit" — heavy condensed caps glowing over crushed-black footage.
 *
 * The underground rap / phonk edit look: ALL-CAPS Anton (Impact-style
 * condensed, bundled via @fontsource, imported in main.tsx) dead-centre with a
 * cool white glow, over footage pushed almost to black — deep shadows, strong
 * vignette, heavy animated grain reading as VHS noise. The opposite grade to
 * Mood's lifted faded film: here blacks are crushed, not lifted. Hard cuts,
 * built for short punchy phrases (one bar or less per line).
 */

import type { LyricPreset } from "./mood-preset";

export const GRIT: LyricPreset = {
  id: "grit",
  name: "Grit",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    saturation: 0.7,           // drained colour — near-monochrome darkness
    contrast: 1.1,             // push shadows down hard
    brightness: 0.8,           // the frame lives in the dark
    liftBlacks: 0,             // crushed, never lifted — core of the look
    tint: { r: 205, g: 214, b: 255, strength: 0.05 }, // faint cool cast
    vignette: { strength: 0.6, softness: 0.7 },
    topGradient:    { color: "#000000", height: 0.25, opacity: 0.35 },
    bottomGradient: { color: "#000000", height: 0.3, opacity: 0.4 },
    grain: { opacity: 0.12, size: 1.8, animated: true }, // heavy — reads as VHS noise
    scanlines: { opacity: 0.1, spacingFrac: 0.005 },     // subtle CRT line pitch
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 0.8,     // quicker dissolves — this style cuts, not drifts
  },

  text: {
    fonts: {
      sans: '"Anton", "Arial Narrow", Impact, sans-serif',
      serif: '"Fraunces", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,           // Anton ships one weight; it's already heavy
    fontSizeVmin: 10,          // dominant — the text IS the frame
    lineHeight: 1.05,          // stacked tight
    letterSpacingEm: 0,        // Anton is tight by design; don't cram further
    horizontalScale: 1,
    verticalScale: 1.08,       // a touch taller — extra condensed menace
    blurFontFrac: 0.006,       // hair of softness — takes the digital edge off
    textTransform: "uppercase",
    color: "#FFFFFF",
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",
    verticalAnchor: 0.5,       // dead centre, like the reference edits
    horizontalPaddingVw: 8,
    // The reference's halo is a TIGHT blue-violet ring hugging the letters
    // (VHS chroma bleed), not a wide soft bloom: a close blue glow, a blue
    // stroke ring at the glyph edge, and faint red/cyan aberration ghosts.
    shadow: { color: "#6B7BFF", blur: 24, opacity: 0.9 },
    outline: { color: "#7B8CFF", widthFrac: 0.05, opacity: 0.7 },
    chromatic: { offsetFrac: 0.02, opacity: 0.35 },
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut in
    lineOut: { fadeMs: 0 },            // hard cut out
    wordHighlight: { enabled: false, activeColor: "#FFFFFF", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,
      zoomFrom: 1.0,
      zoomTo: 1.06,
      panXvw: 2,
      panYvh: 2,
      cycleSeconds: 8,
    },
  },
};
