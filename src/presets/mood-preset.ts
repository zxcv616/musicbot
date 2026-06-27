/**
 * "Mood" — the v1 aesthetic preset for the lyric video app.
 *
 * This is the heart of the product. Every value here is a deliberate taste
 * decision tuned for the "underground / moody / Pinterest-mood" look:
 * centered lyric text, soft faded photo behind, film grain, slow drift.
 *
 * The renderer (both live preview AND final export) reads from this object.
 * New aesthetics later = new config objects. Do not hardcode any of these
 * values inside the renderer.
 *
 * Numbers are starting points tuned to look good with zero user input.
 * Expect to fine-tune during the Milestone 7 polish pass while watching
 * real output on a phone-sized screen.
 */

export interface LyricPreset {
  id: string;
  name: string;
  output: OutputConfig;
  background: BackgroundConfig;
  text: TextConfig;
  motion: MotionConfig;
}

export interface OutputConfig {
  width: number;        // px
  height: number;       // px
  fps: number;
}

export interface BackgroundConfig {
  // Color grade applied to every uploaded image.
  saturation: number;          // 1.0 = untouched. < 1 desaturates.
  contrast: number;            // 1.0 = untouched.
  brightness: number;          // 1.0 = untouched.
  liftBlacks: number;          // 0..1. Raises shadow floor for a faded-film look. 0 = none.
  tint: { r: number; g: number; b: number; strength: number }; // subtle color cast, strength 0..1

  // Readability overlays (so white text survives any image).
  vignette: { strength: number; softness: number };  // 0..1 each
  topGradient: { color: string; height: number; opacity: number };    // height = fraction of frame (0..1)
  bottomGradient: { color: string; height: number; opacity: number };

  // Film grain (animated — regenerate/scroll noise each frame).
  grain: { opacity: number; size: number; animated: boolean };  // opacity 0..1

  // Optional light leak / bloom. OFF by default — very easy to overdo.
  lightLeak: { enabled: boolean; opacity: number };

  // Crossfade when switching between multiple uploaded images.
  crossfadeSeconds: number;
}

export interface TextConfig {
  // Two or three curated fonts ONLY. No giant font picker — curation is the product.
  // Each value is a full CSS font-family stack so it can fall back gracefully.
  fonts: {
    sans: string;   // e.g. a tight Helvetica/Arial grotesque
    serif: string;  // e.g. "Fraunces" or "EB Garamond"
  };
  defaultFont: "sans" | "serif";

  fontWeight: number;          // e.g. 500
  fontSizeVh: number;          // font size as % of frame HEIGHT, so it scales with output
  lineHeight: number;          // multiplier
  letterSpacingEm: number;     // tracking, in em (negative = letters nearly touching)
  horizontalScale: number;     // canvas X-scale on text; >1 = stretched-wide (Brat) feel
  textTransform: "none" | "lowercase" | "uppercase"; // case treatment for lyrics
  color: string;               // off-white reads softer than pure #fff
  maxLinesVisible: 1 | 2;      // show current line, optionally next line dimmed
  nextLineOpacity: number;     // 0 if maxLinesVisible === 1
  textAlign: "center";
  // Vertical anchor: fraction of frame height for the text baseline zone.
  // ~0.5–0.62 keeps it in the mobile eye-focus center third, not dead center.
  verticalAnchor: number;
  horizontalPaddingVw: number; // side padding as % of frame WIDTH, keeps lines off edges

  // Legibility: soft shadow/glow behind text rather than a hard drop shadow.
  shadow: { color: string; blur: number; opacity: number };

  // Per-line entrance/exit animation.
  lineIn:  { fadeMs: number; riseVh: number };  // riseVh = px-rise as % of frame height
  lineOut: { fadeMs: number };

  // Word-by-word highlight as vocals hit each word. OFF by default — opt-in.
  wordHighlight: { enabled: boolean; activeColor: string; inactiveOpacity: number };
}

export interface MotionConfig {
  // Slow Ken-Burns drift on the background. Subtle. Never fast.
  kenBurns: {
    enabled: boolean;
    zoomFrom: number;     // 1.0
    zoomTo: number;       // ~1.08
    panXvw: number;       // horizontal drift as % of frame width over the cycle
    panYvh: number;       // vertical drift as % of frame height
    cycleSeconds: number; // how long one drift cycle takes
  };
}

export const MOOD: LyricPreset = {
  id: "mood",
  name: "Mood",

  output: {
    width: 1080,
    height: 1920,
    fps: 30,
  },

  background: {
    saturation: 0.85,
    contrast: 0.96,
    brightness: 0.98,
    liftBlacks: 0.06,
    tint: { r: 255, g: 244, b: 230, strength: 0.06 }, // faint warm cast; swap to a cool cast for a cooler preset later
    vignette: { strength: 0.45, softness: 0.7 },
    topGradient:    { color: "#000000", height: 0.30, opacity: 0.35 },
    bottomGradient: { color: "#000000", height: 0.40, opacity: 0.55 },
    grain: { opacity: 0.07, size: 1.4, animated: true },
    lightLeak: { enabled: false, opacity: 0.12 },
    crossfadeSeconds: 1.0,
  },

  text: {
    fonts: {
      // "Brat"-style: Arial via Arimo (bundled, metric-compatible, deterministic).
      sans: '"Arimo", Arial, Helvetica, sans-serif',
      serif: '"Fraunces", Georgia, serif',
    },
    defaultFont: "sans",
    fontWeight: 700,           // Brat is bold/black, not medium
    fontSizeVh: 4.4,            // ~84px at 1920 tall
    lineHeight: 1.25,
    letterSpacingEm: -0.04,     // very tight tracking — letters crammed together
    horizontalScale: 1.12,      // stretched-wide Brat feel
    textTransform: "lowercase", // Brat aesthetic: all lowercase
    color: "#F4F1EA",          // warm off-white
    maxLinesVisible: 1,        // one lyric line at a time
    nextLineOpacity: 0,        // no dimmed next line
    textAlign: "center",
    verticalAnchor: 0.56,
    horizontalPaddingVw: 10,
    shadow: { color: "#000000", blur: 24, opacity: 0.45 },
    lineIn:  { fadeMs: 0, riseVh: 0 },  // hard cut in — no fade, no rise
    lineOut: { fadeMs: 0 },             // hard cut out — no fade
    wordHighlight: { enabled: false, activeColor: "#FFFFFF", inactiveOpacity: 0.55 },
  },

  motion: {
    kenBurns: {
      enabled: false,           // background image is completely still
      zoomFrom: 1.0,
      zoomTo: 1.08,
      panXvw: 2,
      panYvh: 3,
      cycleSeconds: 9,
    },
  },
};
