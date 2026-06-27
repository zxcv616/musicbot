/**
 * Mood renderer — the single source of truth for drawing a frame.
 *
 * Both the live preview AND the (later) export call this exact code, so what
 * you see is what you get. It is framework-agnostic: hand it a 2D context sized
 * to the preset's output and a set of per-frame inputs, and it draws one frame.
 *
 * EVERY visual constant comes from the LyricPreset passed in. Nothing about the
 * "Mood" look is hardcoded here — swapping presets swaps the aesthetic.
 *
 * Milestone 2 scope: center-cropped image fill, colour grade, tint, lifted
 * blacks, vignette, top/bottom gradient overlays, animated film grain.
 * (No text, no Ken-Burns motion yet — those arrive in later milestones.)
 */

import type { LyricPreset } from "../presets/mood-preset";

export type FrameImage = HTMLImageElement | ImageBitmap;

/** A single lyric line with its timing (seconds), derived from transcription. */
export interface LyricLine {
  text: string;
  start: number;
  end: number;
}

export interface FrameInputs {
  /** The (single, for now) background image, or null for a black frame. */
  image: FrameImage | null;
  /** Free-running animation clock in seconds. Drives the animated grain. */
  timeSeconds: number;
  /** Audio playback position in seconds. Drives lyric line sync. */
  playbackSeconds?: number;
  /** Lyric lines to display, in order. Empty/omitted = no text. */
  lines?: LyricLine[];
}

export class MoodRenderer {
  private readonly preset: LyricPreset;

  // Pre-rendered pool of film-grain tiles. Cycling through them each frame
  // gives animated grain cheaply and deterministically (frame index -> tile).
  private grainTiles: HTMLCanvasElement[] = [];
  private grainForSize = { w: 0, h: 0 };
  private readonly grainPoolSize = 16;

  constructor(preset: LyricPreset) {
    this.preset = preset;
  }

  /** Convenience: size a canvas to the preset's output resolution. */
  sizeCanvas(canvas: HTMLCanvasElement): void {
    canvas.width = this.preset.output.width;
    canvas.height = this.preset.output.height;
  }

  /** Draw one full frame into the given context. */
  render(ctx: CanvasRenderingContext2D, inputs: FrameInputs): void {
    const { width, height } = this.preset.output;

    // Reset any leftover state from a previous draw.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    // Black base so transparent regions never flash white.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    if (inputs.image) {
      this.drawImageCover(ctx, inputs.image, width, height);
    }

    this.applyTint(ctx, width, height);
    this.applyLiftBlacks(ctx, width, height);
    this.applyVignette(ctx, width, height);
    this.applyGradients(ctx, width, height);
    this.applyGrain(ctx, width, height, inputs.timeSeconds);

    // Text sits on top of the grain so lyrics stay crisp and legible.
    this.drawText(ctx, width, height, inputs);

    // Leave state clean for the next caller.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
  }

  // --- Background image: center-crop "cover" fill + colour grade -----------

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    image: FrameImage,
    width: number,
    height: number,
  ): void {
    const bg = this.preset.background;
    const iw = image.width;
    const ih = image.height;
    const imageRatio = iw / ih;
    const frameRatio = width / height;

    let dw: number;
    let dh: number;
    if (imageRatio > frameRatio) {
      // Image is wider than the frame → match height, crop the sides.
      dh = height;
      dw = height * imageRatio;
    } else {
      // Image is taller/narrower → match width, crop top & bottom.
      dw = width;
      dh = width / imageRatio;
    }
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    // Colour grade is applied as the image is drawn.
    ctx.filter = `saturate(${bg.saturation}) contrast(${bg.contrast}) brightness(${bg.brightness})`;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.filter = "none";
  }

  // --- Subtle colour cast (warm/cool) -------------------------------------

  private applyTint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const { tint } = this.preset.background;
    if (tint.strength <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = tint.strength;
    ctx.fillStyle = `rgb(${tint.r}, ${tint.g}, ${tint.b})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // --- Lifted blacks (faded-film matte) -----------------------------------

  private applyLiftBlacks(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const { liftBlacks } = this.preset.background;
    if (liftBlacks <= 0) return;
    // "lighten" raises every channel to at least the floor value, so the
    // darkest shadows become a soft grey instead of pure black.
    const floor = Math.round(liftBlacks * 255);
    ctx.save();
    ctx.globalCompositeOperation = "lighten";
    ctx.fillStyle = `rgb(${floor}, ${floor}, ${floor})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // --- Vignette ------------------------------------------------------------

  private applyVignette(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const { strength, softness } = this.preset.background.vignette;
    if (strength <= 0) return;
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.hypot(width / 2, height / 2);
    // Higher softness → darkening begins closer to the centre (longer falloff).
    const inner = outer * (1 - softness);
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // --- Top & bottom gradient overlays (text readability) ------------------

  private applyGradients(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const bg = this.preset.background;

    // Top: opaque at the very top, fading to transparent.
    const topH = bg.topGradient.height * height;
    if (topH > 0 && bg.topGradient.opacity > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, topH);
      g.addColorStop(0, hexToRgba(bg.topGradient.color, bg.topGradient.opacity));
      g.addColorStop(1, hexToRgba(bg.topGradient.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, topH);
    }

    // Bottom: opaque at the very bottom, fading upward to transparent.
    const botH = bg.bottomGradient.height * height;
    if (botH > 0 && bg.bottomGradient.opacity > 0) {
      const y0 = height - botH;
      const g = ctx.createLinearGradient(0, height, 0, y0);
      g.addColorStop(0, hexToRgba(bg.bottomGradient.color, bg.bottomGradient.opacity));
      g.addColorStop(1, hexToRgba(bg.bottomGradient.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, width, botH);
    }
  }

  // --- Animated film grain -------------------------------------------------

  private applyGrain(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timeSeconds: number,
  ): void {
    const { grain } = this.preset.background;
    if (grain.opacity <= 0) return;

    this.ensureGrainTiles(width, height);
    if (this.grainTiles.length === 0) return;

    let index = 0;
    if (grain.animated) {
      const frame = Math.floor(timeSeconds * this.preset.output.fps);
      index = ((frame % this.grainTiles.length) + this.grainTiles.length) %
        this.grainTiles.length;
    }
    const tile = this.grainTiles[index];

    ctx.save();
    // "overlay" lets mid-grey noise leave the image untouched while lighter/
    // darker speckles modulate it — reads as real film grain, not a grey wash.
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = grain.opacity;
    ctx.imageSmoothingEnabled = false; // keep grain crisp when scaled up
    ctx.drawImage(tile, 0, 0, width, height);
    ctx.restore();
  }

  private ensureGrainTiles(width: number, height: number): void {
    if (
      this.grainTiles.length > 0 &&
      this.grainForSize.w === width &&
      this.grainForSize.h === height
    ) {
      return;
    }

    const { grain } = this.preset.background;
    // Generate noise at reduced resolution; drawn scaled up (smoothing off) so
    // each grain speck is roughly `grain.size` device pixels across.
    const gw = Math.max(1, Math.round(width / grain.size));
    const gh = Math.max(1, Math.round(height / grain.size));

    const tiles: HTMLCanvasElement[] = [];
    for (let t = 0; t < this.grainPoolSize; t++) {
      const c = document.createElement("canvas");
      c.width = gw;
      c.height = gh;
      const gctx = c.getContext("2d");
      if (!gctx) continue;
      const imgData = gctx.createImageData(gw, gh);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0; // monochrome speckle
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      gctx.putImageData(imgData, 0, 0);
      tiles.push(c);
    }

    this.grainTiles = tiles;
    this.grainForSize = { w: width, h: height };
  }

  // --- Lyric text ----------------------------------------------------------

  private drawText(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    inputs: FrameInputs,
  ): void {
    const lines = inputs.lines;
    if (!lines || lines.length === 0) return;
    const t = inputs.playbackSeconds ?? 0;

    const tc = this.preset.text;
    const fontPx = (tc.fontSizeVh / 100) * height;
    const rowH = fontPx * tc.lineHeight;
    const family = tc.defaultFont === "serif" ? tc.fonts.serif : tc.fonts.sans;
    const maxWidth = width - 2 * (tc.horizontalPaddingVw / 100) * width;
    const centerX = width / 2;
    const anchorY = tc.verticalAnchor * height;

    ctx.save();
    ctx.font = `${tc.fontWeight} ${fontPx}px "${family}", sans-serif`;
    // letterSpacing is a modern canvas property; cast for older lib typings.
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${tc.letterSpacingEm}em`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Active line = the most recent line whose start has passed.
    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start <= t) activeIndex = i;
      else break;
    }
    if (activeIndex < 0) {
      ctx.restore();
      return; // nothing has started yet
    }

    const fadeIn = Math.max(tc.lineIn.fadeMs / 1000, 1e-3);
    const fadeOut = Math.max(tc.lineOut.fadeMs / 1000, 1e-3);
    const risePx = (tc.lineIn.riseVh / 100) * height;

    const active = lines[activeIndex];
    const inP = clamp((t - active.start) / fadeIn, 0, 1);
    const activeAlpha = inP;
    const activeRise = (1 - easeOutCubic(inP)) * risePx;

    // Previous line fades out in place as the new one enters → soft crossfade.
    if (activeIndex > 0) {
      const outP = clamp((t - active.start) / fadeOut, 0, 1);
      const prevAlpha = 1 - outP;
      if (prevAlpha > 0.001) {
        const prevRows = this.wrapText(ctx, lines[activeIndex - 1].text, maxWidth);
        this.drawTextBlock(ctx, prevRows, centerX, anchorY, 0, rowH, prevAlpha);
      }
    }

    // Active (current) line — full colour, with fade + rise entrance.
    const activeRows = this.wrapText(ctx, active.text, maxWidth);
    const activeBottom = this.drawTextBlock(
      ctx,
      activeRows,
      centerX,
      anchorY,
      activeRise,
      rowH,
      activeAlpha,
    );

    // Next line, dimmed, sitting just below the current line.
    if (tc.maxLinesVisible === 2 && activeIndex + 1 < lines.length) {
      const nextRows = this.wrapText(ctx, lines[activeIndex + 1].text, maxWidth);
      const nextAlpha = tc.nextLineOpacity * activeAlpha;
      if (nextAlpha > 0.001) {
        const gap = rowH * 0.35;
        const nextCenterY = activeBottom + gap + (nextRows.length * rowH) / 2;
        this.drawTextBlock(ctx, nextRows, centerX, nextCenterY, 0, rowH, nextAlpha);
      }
    }

    ctx.restore();
  }

  /** Draw a block of pre-wrapped rows centred at centerY (+ yShift). Returns block bottom. */
  private drawTextBlock(
    ctx: CanvasRenderingContext2D,
    rows: string[],
    centerX: number,
    centerY: number,
    yShift: number,
    rowH: number,
    alpha: number,
  ): number {
    const tc = this.preset.text;
    const total = rows.length * rowH;
    const top = centerY + yShift - total / 2;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = tc.color;
    // Soft glow (zero offset + blur) for legibility over any background.
    ctx.shadowColor = hexToRgba(tc.shadow.color, tc.shadow.opacity);
    ctx.shadowBlur = tc.shadow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    for (let i = 0; i < rows.length; i++) {
      ctx.fillText(rows[i], centerX, top + rowH * (i + 0.5));
    }

    ctx.globalAlpha = 1;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.shadowBlur = 0;
    return centerY + yShift + total / 2;
  }

  /** Greedy word-wrap to fit maxWidth using the context's current font. */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && ctx.measureText(test).width > maxWidth) {
        rows.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) rows.push(cur);
    return rows.length ? rows : [""];
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
