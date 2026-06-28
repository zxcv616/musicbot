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

/** How a video clip shorter than its slot fills the remaining time. */
export type VideoFit = "loop" | "freeze";

/**
 * A background media item: a still image or a video clip. Images and videos can
 * be mixed; each takes one slot in the schedule (like image crossfades).
 */
export type BackgroundMedia =
  | { kind: "image"; image: FrameImage }
  | { kind: "video"; video: HTMLVideoElement; duration: number; fit: VideoFit };

/** A single lyric line with its timing (seconds), derived from transcription. */
export interface LyricLine {
  text: string;
  start: number;
  end: number;
}

/** One media item's window on the song timeline. */
export interface ScheduleEntry {
  start: number;
  end: number;
  /** When the item first becomes visible (its crossfade-in start). */
  motionStart: number;
}

export interface FrameInputs {
  /** Background media (images and/or videos), in order. Empty = black frame. */
  media: BackgroundMedia[];
  /** Free-running animation clock in seconds. Drives the animated grain. */
  timeSeconds: number;
  /** Audio playback position in seconds. Drives lyric sync, motion, crossfades. */
  playbackSeconds?: number;
  /** Total song length in seconds, used to spread media across the song. */
  durationSeconds?: number;
  /** Lyric lines to display, in order. Empty/omitted = no text. */
  lines?: LyricLine[];
}

export class MoodRenderer {
  // Mutable so callers can swap settings (text colour, aspect ratio) between
  // frames without rebuilding the renderer and its grain pool.
  preset: LyricPreset;

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

    // Solid-colour backdrop (e.g. Brat lime). Drawn before media so uploaded
    // images/videos appear on top of it when present.
    if (this.preset.background.solidColor) {
      ctx.fillStyle = this.preset.background.solidColor;
      ctx.fillRect(0, 0, width, height);
    }

    this.drawBackground(ctx, width, height, inputs);

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

  // --- Background: multi-media crossfade + Ken-Burns drift ----------------

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    inputs: FrameInputs,
  ): void {
    const media = inputs.media;
    if (!media || media.length === 0) return;
    const t = inputs.playbackSeconds ?? 0;

    const schedule = this.getSchedule(media.length, inputs.durationSeconds, inputs.lines);

    // Draw the visible layer(s): the primary item, plus the incoming item during
    // a crossfade (drawn over it at ramping alpha = true dissolve).
    for (const layer of this.visibleAt(t, schedule)) {
      const entry = schedule[layer.index];
      this.drawMediaItem(
        ctx,
        media[layer.index],
        width,
        height,
        t - entry.motionStart,
        layer.alpha,
      );
    }
  }

  /**
   * Which media item(s) are on screen at time t, with their alpha. One entry,
   * or two during a crossfade (the second is the incoming item). Public so the
   * live preview / export can drive each video element to the same schedule.
   */
  visibleAt(t: number, schedule: ScheduleEntry[]): { index: number; alpha: number }[] {
    let i = 0;
    for (let k = 0; k < schedule.length; k++) {
      if (t >= schedule[k].start) i = k;
      else break;
    }
    const layers = [{ index: i, alpha: 1 }];
    const cf = this.preset.background.crossfadeSeconds;
    if (i + 1 < schedule.length && cf > 0) {
      const cfStart = schedule[i].end - cf;
      if (t >= cfStart) {
        layers.push({ index: i + 1, alpha: clamp((t - cfStart) / cf, 0, 1) });
      }
    }
    return layers;
  }

  /**
   * The local time within a clip to display at song time t, honouring loop vs
   * freeze. Long clips clamp ("cut to fit from the start"); short clips loop or
   * freeze. Shared by the preview (seek/play) and the export (frame-accurate).
   */
  clipLocalTime(entry: ScheduleEntry, duration: number, fit: VideoFit, t: number): number {
    let local = Math.max(0, t - entry.motionStart);
    if (duration <= 0) return 0;
    if (fit === "loop") return local % duration;
    // freeze / cut: hold at the last frame once past the clip's end.
    return Math.min(local, Math.max(0, duration - 1 / this.preset.output.fps));
  }

  /** Even-spaced media windows across the song, snapped to lyric line starts. */
  getSchedule(
    count: number,
    durationSeconds?: number,
    linesArg?: LyricLine[],
  ): ScheduleEntry[] {
    const cf = this.preset.background.crossfadeSeconds;
    const lines = linesArg ?? [];
    const duration =
      durationSeconds && durationSeconds > 0
        ? durationSeconds
        : lines.length > 0
          ? lines[lines.length - 1].end
          : 0;

    if (count <= 1 || duration <= 0) {
      return [{ start: 0, end: Number.POSITIVE_INFINITY, motionStart: 0 }];
    }

    // Even split points, then snap interior boundaries to the nearest lyric
    // line start so each image change lands on a line, not mid-phrase.
    const slot = duration / count;
    const bounds: number[] = [];
    for (let k = 0; k <= count; k++) {
      let b = k * slot;
      if (k > 0 && k < count && lines.length > 0) {
        b = this.nearestLineStart(b, lines);
      }
      bounds.push(b);
    }
    // Keep boundaries strictly increasing after snapping.
    for (let k = 1; k < bounds.length; k++) {
      if (bounds[k] <= bounds[k - 1]) bounds[k] = bounds[k - 1] + 0.01;
    }

    const schedule: { start: number; end: number; motionStart: number }[] = [];
    for (let k = 0; k < count; k++) {
      schedule.push({
        start: bounds[k],
        end: bounds[k + 1],
        // Motion begins as the image first appears (its crossfade-in start) and
        // runs continuously for its whole life, so the drift never jumps.
        motionStart: Math.max(0, bounds[k] - cf),
      });
    }
    return schedule;
  }

  private nearestLineStart(time: number, lines: LyricLine[]): number {
    let best = lines[0].start;
    let bestDist = Math.abs(time - best);
    for (const line of lines) {
      const d = Math.abs(time - line.start);
      if (d < bestDist) {
        best = line.start;
        bestDist = d;
      }
    }
    return best;
  }

  /** Center-crop "cover" fill + colour grade, with optional Ken-Burns drift. */
  private drawMediaItem(
    ctx: CanvasRenderingContext2D,
    item: BackgroundMedia,
    width: number,
    height: number,
    localTime: number,
    alpha: number,
  ): void {
    const bg = this.preset.background;
    const kb = this.preset.motion.kenBurns;

    // The drawable source + its intrinsic size (videos expose videoWidth/Height,
    // and aren't drawable until they have data).
    const source: CanvasImageSource =
      item.kind === "image" ? item.image : item.video;
    const iw = item.kind === "image" ? item.image.width : item.video.videoWidth;
    const ih = item.kind === "image" ? item.image.height : item.video.videoHeight;
    if (!iw || !ih) return; // video not ready yet — leave the black base
    if (item.kind === "video" && item.video.readyState < 2) return;

    // Cover scale: smallest scale that fills the frame.
    const coverScale = Math.max(width / iw, height / ih);
    const coverW = iw * coverScale;
    const coverH = ih * coverScale;

    let drawW = coverW;
    let drawH = coverH;
    let panX = 0;
    let panY = 0;

    if (kb.enabled) {
      const cycle = Math.max(kb.cycleSeconds, 1e-3);
      const phase = (2 * Math.PI * localTime) / cycle;
      // Smooth ease-in/out zoom oscillation (zoomFrom → zoomTo → zoomFrom).
      const zoomOsc = (1 - Math.cos(phase)) / 2;
      const zoom = kb.zoomFrom + (kb.zoomTo - kb.zoomFrom) * zoomOsc;

      const ampX = ((kb.panXvw / 100) * width) / 2;
      const ampY = ((kb.panYvh / 100) * height) / 2;
      const zMin = Math.min(kb.zoomFrom, kb.zoomTo);

      // Overscan so even at minimum zoom there is slack to pan without ever
      // exposing an edge of the image.
      const reqX = (width + 2 * ampX) / (coverW * zMin);
      const reqY = (height + 2 * ampY) / (coverH * zMin);
      const overscan = Math.max(1, reqX, reqY);

      drawW = coverW * overscan * zoom;
      drawH = coverH * overscan * zoom;

      const slackX = (drawW - width) / 2;
      const slackY = (drawH - height) / 2;
      // Elliptical drift (sin × cos) reads more organic than a straight line.
      panX = clamp(ampX * Math.sin(phase), -slackX, slackX);
      panY = clamp(ampY * Math.cos(phase), -slackY, slackY);
    }

    const dx = (width - drawW) / 2 + panX;
    const dy = (height - drawH) / 2 + panY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `saturate(${bg.saturation}) contrast(${bg.contrast}) brightness(${bg.brightness})`;
    ctx.drawImage(source, dx, dy, drawW, drawH);
    ctx.restore();
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
    // Aspect-aware: size text off the SHORTER side so it reads consistently on
    // 9:16, 1:1 and 16:9 instead of shrinking on wide frames.
    const fontPx = (tc.fontSizeVmin / 100) * Math.min(width, height);
    const rowH = fontPx * tc.lineHeight;
    // fonts.* are full CSS family stacks, used as-is.
    const family = tc.defaultFont === "serif" ? tc.fonts.serif : tc.fonts.sans;
    const maxWidth = width - 2 * (tc.horizontalPaddingVw / 100) * width;
    const centerX = width / 2;
    // The preset anchor (lower-centre) is tuned for portrait; on square/landscape
    // centre the text vertically so it still sits right.
    const portrait = height > width;
    const anchorY = (portrait ? tc.verticalAnchor : 0.5) * height;

    ctx.save();
    ctx.font = `${tc.fontWeight} ${fontPx}px ${family}`;
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

    const fadeInMs = tc.lineIn.fadeMs;
    const fadeOutMs = tc.lineOut.fadeMs;
    const risePx = (tc.lineIn.riseVh / 100) * height;
    // Text is stretched by horizontalScale when drawn, so wrap against the
    // padding-limited width divided by that scale.
    const wrapWidth = maxWidth / tc.horizontalScale;

    const active = lines[activeIndex];
    const nextLine = lines[activeIndex + 1];

    // Clear the line during long instrumental gaps (and after the song's last
    // line) so stale lyrics don't linger; back-to-back lines stay continuous.
    let visibleUntil: number;
    if (nextLine) {
      const gap = nextLine.start - active.end;
      visibleUntil =
        gap > tc.clearGapSeconds ? active.end + tc.lineHoldSeconds : nextLine.start;
    } else {
      visibleUntil = active.end + tc.lineHoldSeconds;
    }
    if (t >= visibleUntil) {
      ctx.restore();
      return; // blank during the gap / after the final line
    }

    // Entrance: hard cut when fadeMs is 0, otherwise fade + rise in.
    let activeAlpha = 1;
    let activeRise = 0;
    if (fadeInMs > 0) {
      const inP = clamp((t - active.start) / (fadeInMs / 1000), 0, 1);
      activeAlpha = inP;
      activeRise = (1 - easeOutCubic(inP)) * risePx;
    }

    // Exit: only crossfade the previous line out if a fade-out is configured.
    // With fadeOut = 0 the previous line is simply gone (hard cut).
    // Blur: fraction of font size → absolute pixels at this resolution.
    const blurPx = (tc.blurFontFrac ?? 0) * fontPx;

    if (fadeOutMs > 0 && activeIndex > 0) {
      const outP = clamp((t - active.start) / (fadeOutMs / 1000), 0, 1);
      const prevAlpha = 1 - outP;
      if (prevAlpha > 0.001) {
        const prevRows = this.wrapText(ctx, lines[activeIndex - 1].text, wrapWidth);
        this.drawTextBlock(ctx, prevRows, centerX, anchorY, 0, rowH, prevAlpha, blurPx);
      }
    }

    // Active (current) line.
    const activeRows = this.wrapText(ctx, active.text, wrapWidth);
    const activeBottom = this.drawTextBlock(
      ctx,
      activeRows,
      centerX,
      anchorY,
      activeRise,
      rowH,
      activeAlpha,
      blurPx,
    );

    // Next line, dimmed, sitting just below the current line.
    if (tc.maxLinesVisible === 2 && activeIndex + 1 < lines.length) {
      const nextRows = this.wrapText(ctx, lines[activeIndex + 1].text, wrapWidth);
      const nextAlpha = tc.nextLineOpacity * activeAlpha;
      if (nextAlpha > 0.001) {
        const gap = rowH * 0.35;
        const nextCenterY = activeBottom + gap + (nextRows.length * rowH) / 2;
        this.drawTextBlock(ctx, nextRows, centerX, nextCenterY, 0, rowH, nextAlpha, blurPx);
      }
    }

    ctx.restore();
  }

  /**
   * Draw a block of pre-wrapped rows centred at (centerX, centerY + yShift).
   * Applies horizontalScale (X) and verticalScale (Y) anchored at that centre
   * so the block expands/contracts symmetrically. Returns block bottom in
   * screen-space pixels (accounting for vertical scale).
   */
  private drawTextBlock(
    ctx: CanvasRenderingContext2D,
    rows: string[],
    centerX: number,
    centerY: number,
    yShift: number,
    rowH: number,
    alpha: number,
    blurPx: number,
  ): number {
    const tc = this.preset.text;
    const total = rows.length * rowH;
    const vy = tc.verticalScale ?? 1;

    // Translate to the visual centre of the text block, then apply both scales.
    // Drawing at y ∈ (-total/2 .. total/2) around the origin keeps the block
    // anchored at (centerX, centerY+yShift) regardless of vy.
    ctx.save();
    ctx.translate(centerX, centerY + yShift);
    ctx.scale(tc.horizontalScale, vy);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = tc.color;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;

    // textAlign is "center", so draw at x = 0 (the translated centre).
    const drawRows = () => {
      for (let i = 0; i < rows.length; i++) {
        ctx.fillText(rows[i], 0, -total / 2 + rowH * (i + 0.5));
      }
    };

    if (tc.shadow.opacity > 0 && tc.shadow.blur > 0) {
      // Two soft dark passes build a legibility halo that survives busy/bright
      // images, then a final crisp pass with no shadow keeps the letters sharp.
      ctx.shadowColor = hexToRgba(tc.shadow.color, tc.shadow.opacity);
      ctx.shadowBlur = tc.shadow.blur;
      drawRows();
      drawRows();
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowBlur = 0;
    }
    drawRows();

    ctx.restore();
    // Screen-space bottom accounts for vertical scale.
    return (centerY + yShift) + (total / 2) * vy;
  }

  /** Greedy word-wrap to fit maxWidth using the context's current font. */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] {
    const transform = this.preset.text.textTransform;
    const cased =
      transform === "lowercase"
        ? text.toLowerCase()
        : transform === "uppercase"
          ? text.toUpperCase()
          : text;
    const words = cased.trim().split(/\s+/).filter(Boolean);
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
