/**
 * "Typewriter" — lowercase monospace over softly faded film photo.
 *
 * The bedroom-pop / indie diary look that's carrying lyric edits on TikTok and
 * Instagram right now: type that signals craft and analog nostalgia, visuals
 * kept minimal and calm. Courier Prime (bundled via @fontsource, imported in
 * main.tsx) at a deliberately modest size — typewriter text reads smaller and
 * quieter than the bold Mood stack. Warm paper tint, gentle grain, no motion,
 * hard cuts: the whole frame should feel like a still page, not an edit.
 */

import type { LyricPreset } from "./mood-preset";

export const TYPEWRITER: LyricPreset = {
  id: "typewriter",
  name: "Typewriter",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    saturation: 0.78,          // more faded than Mood — closer to expired film
    contrast: 0.95,
    brightness: 0.94,
    liftBlacks: 0.07,          // clearly lifted shadows: the "scanned photo" matte
    tint: { r: 255, g: 241, b: 222, strength: 0.1 }, // warm paper cast
    vignette: { strength: 0.42, softness: 0.75 },
    topGradient:    { color: "#000000", height: 0.25, opacity: 0.28 },
    bottomGradient: { color: "#000000", height: 0.38, opacity: 0.45 },
    grain: { opacity: 0.09, size: 1.6, animated: true }, // heavier, papery grain
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      sans: '"Courier Prime", "Courier New", Courier, monospace',
      serif: '"Fraunces", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 400,           // typewriters don't do bold
    fontSizeVmin: 5.6,         // quieter than Mood's 8.5 — diary, not billboard
    lineHeight: 1.45,          // airy spacing between wrapped rows
    letterSpacingEm: 0,        // monospace sets its own rhythm; don't fight it
    horizontalScale: 1,
    verticalScale: 1,
    blurFontFrac: 0,
    textTransform: "lowercase",
    color: "#F2EDE2",          // warm off-white, matches the paper tint
    maxLinesVisible: 1,
    nextLineOpacity: 0,
    lineHoldSeconds: 0.5,
    clearGapSeconds: 1.6,
    textAlign: "center",
    verticalAnchor: 0.58,
    horizontalPaddingVw: 12,   // wider margins — monospace lines get long fast
    shadow: { color: "#000000", blur: 22, opacity: 0.5 }, // thin strokes need the halo
    lineIn:  { fadeMs: 0, riseVh: 0 }, // hard cut, like a typed line appearing
    lineOut: { fadeMs: 0 },
    wordHighlight: { enabled: false, activeColor: "#FFFFFF", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,          // completely still — a page, not a pan
      zoomFrom: 1.0,
      zoomTo: 1.05,
      panXvw: 2,
      panYvh: 2,
      cycleSeconds: 10,
    },
  },
};
