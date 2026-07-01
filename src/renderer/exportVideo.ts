/**
 * MP4 export (Milestone 6).
 *
 * Renders the full composition with the SAME MoodRenderer the live preview uses
 * — so the exported file matches what's on screen — then encodes the frames to
 * H.264 and muxes the original audio with ffmpeg.wasm (client-side, no uploads).
 *
 * Frames are rendered deterministically at t = frame / fps for both the lyric
 * sync/crossfade timeline and the grain clock, so the encode is reproducible.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { LyricPreset } from "../presets/mood-preset";
import {
  MoodRenderer,
  type BackgroundMedia,
  type LyricLine,
} from "./moodRenderer";

// jsDelivr is an NPM mirror backed by multiple CDNs — more reliable than unpkg.
// coreURL and wasmURL are always passed explicitly to ffmpeg.load() so the
// worker's own internal fallback URL (@ffmpeg/core@0.12.9 on unpkg) is never
// reached.
const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

export type ExportQuality = "draft" | "full";

export interface ExportOptions {
  preset: LyricPreset;
  media: BackgroundMedia[];
  lines: LyricLine[];
  audioFile: File;
  durationSeconds: number;
  /**
   * Trim: render only the song-time window [startSeconds, endSeconds). Defaults
   * to the whole song. The media schedule still spans the full song, so a
   * trimmed clip shows exactly what the preview shows during that window.
   */
  startSeconds?: number;
  endSeconds?: number;
  /** "draft" = half-resolution + ultrafast encode for a quick check. */
  quality?: ExportQuality;
  /** 0..1 across render + encode. */
  onProgress?: (fraction: number) => void;
}

const clampRange = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const evenize = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Seek a video to an exact time and resolve once the frame is actually ready.
 * `seeked` fires after the decoded frame is available, so awaiting it makes the
 * subsequent drawImage frame-accurate. A timeout guards against a stuck seek so
 * the export can never hang.
 */
function seekVideoAndWait(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 1e-3 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 3000);
    video.addEventListener("seeked", finish);
    try {
      video.currentTime = time;
    } catch {
      finish();
    }
  });
}

/**
 * Create a private video element for the export from the same source. The export
 * MUST NOT share <video> elements with the live preview: the preview's rAF keeps
 * seeking those elements to follow the audio playhead, which would fight the
 * export's per-frame seeks and freeze the background. Cloning fully isolates it.
 */
function cloneExportVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    if (v.readyState >= 1) {
      resolve(v);
      return;
    }
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("Could not load video for export"));
  });
}

/** Clamp a seek target into the clip's actually-seekable range (never the dead tail). */
function safeSeekTarget(video: HTMLVideoElement, target: number, fps: number): number {
  let end = Number.isFinite(video.duration) ? video.duration : target;
  if (video.seekable.length > 0) {
    end = Math.min(end, video.seekable.end(video.seekable.length - 1));
  }
  // Keep one frame clear of the end so we never land on an unplayable tail.
  return Math.min(Math.max(0, target), Math.max(0, end - 1 / fps));
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("canvas.toBlob failed"));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Hardware H.264 video encoding via WebCodecs.
 *
 * Canvas frames go straight into the platform encoder as raw pixels — skipping
 * the JPEG round-trip of the fallback path entirely — and come out as an
 * Annex B H.264 elementary stream. ffmpeg then only muxes ("-c:v copy") that
 * stream with the audio, so the slow wasm x264 encode is avoided. Several times
 * faster AND slightly higher quality (no intermediate JPEG loss).
 *
 * `create()` returns null when WebCodecs/H.264 isn't available (older Safari,
 * Firefox configs), in which case the caller uses the JPEG+libx264 path.
 */
class WebCodecsH264 {
  private encoder: VideoEncoder;
  private chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private error: unknown = null;
  private readonly fps: number;

  private constructor(config: VideoEncoderConfig, fps: number) {
    this.fps = fps;
    this.encoder = new VideoEncoder({
      output: (chunk) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        this.chunks.push(buf);
        this.totalBytes += buf.byteLength;
      },
      error: (e) => {
        this.error = e;
      },
    });
    this.encoder.configure(config);
  }

  static async create(
    width: number,
    height: number,
    fps: number,
    quality: ExportQuality,
  ): Promise<WebCodecsH264 | null> {
    if (typeof VideoEncoder === "undefined") return null;
    // Generous bitrate: TikTok/IG re-compress on upload anyway, and clips are
    // short, so we err on quality. Draft halves the bits-per-pixel too.
    const bpp = quality === "draft" ? 0.1 : 0.2;
    const bitrate = Math.min(20_000_000, Math.round(width * height * fps * bpp));
    // High → Main → Baseline profile at levels that cover 1080x1920@30; the
    // first config the platform reports as supported wins.
    for (const codec of ["avc1.640033", "avc1.64002a", "avc1.4d002a", "avc1.42002a"]) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        framerate: fps,
        bitrate,
        latencyMode: "quality",
        avc: { format: "annexb" },
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return new WebCodecsH264(config, fps);
      } catch {
        // malformed/unsupported config on this platform — try the next
      }
    }
    return null;
  }

  async addFrame(canvas: HTMLCanvasElement, frameIndex: number): Promise<void> {
    if (this.error) throw this.error;
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((frameIndex * 1e6) / this.fps),
      duration: Math.round(1e6 / this.fps),
    });
    // Keyframe every 2s keeps the stream seekable without hurting bitrate much.
    this.encoder.encode(frame, { keyFrame: frameIndex % (2 * this.fps) === 0 });
    frame.close();
    // Backpressure: don't let render outrun the encoder unboundedly.
    while (this.encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Flush the encoder and return the concatenated Annex B stream. */
  async finish(): Promise<Uint8Array> {
    await this.encoder.flush();
    this.encoder.close();
    if (this.error) throw this.error;
    const out = new Uint8Array(this.totalBytes);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  }

  /** Abandon the encode (fallback path is taking over). */
  dispose(): void {
    try {
      if (this.encoder.state !== "closed") this.encoder.close();
    } catch {
      // already errored/closed
    }
  }
}

export async function exportMoodVideo(opts: ExportOptions): Promise<Blob> {
  const { preset, media, lines, audioFile, durationSeconds, onProgress } = opts;
  const quality: ExportQuality = opts.quality ?? "full";

  // Draft renders at half resolution for a quick timing/vibe check; full uses
  // the chosen output resolution. Same composition either way.
  const scale = quality === "draft" ? 0.5 : 1;
  const renderPreset =
    scale === 1
      ? preset
      : {
          ...preset,
          output: {
            ...preset.output,
            width: evenize(preset.output.width * scale),
            height: evenize(preset.output.height * scale),
          },
        };
  const { width, height, fps } = renderPreset.output;

  // Song-time window to export. Defaults to the whole song. The schedule below
  // is still built from the full duration, so background timing/lyric sync match
  // the live preview at each rendered instant.
  const clipStart = clampRange(opts.startSeconds ?? 0, 0, durationSeconds);
  const clipEnd = clampRange(opts.endSeconds ?? durationSeconds, clipStart, durationSeconds);
  const windowLength = Math.max(1 / fps, clipEnd - clipStart);

  // Offscreen render target at the (effective) output resolution.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Same renderer instance type as the preview — identical code path.
  const renderer = new MoodRenderer(renderPreset);

  // Make sure the preset's bundled font is ready so frames aren't rendered with
  // a fallback (each preset can use a different family).
  const fontFamily =
    preset.text.defaultFont === "serif" ? preset.text.fonts.serif : preset.text.fonts.sans;
  await document.fonts.load(`${preset.text.fontWeight} 84px ${fontFamily}`);
  await document.fonts.ready;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });

  const totalFrames = Math.max(1, Math.ceil(windowLength * fps));

  // Use PRIVATE cloned video elements so the live preview (still mounted, still
  // running its rAF) can't seek the same elements out from under us.
  const exportMedia: BackgroundMedia[] = await Promise.all(
    media.map(async (m) =>
      m.kind === "video"
        ? { ...m, video: await cloneExportVideo(m.video.src) }
        : m,
    ),
  );
  for (const m of exportMedia) if (m.kind === "video") m.video.pause();

  // Schedule is time-independent; compute once and reuse the same timing the
  // preview uses (getSchedule / visibleAt / clipLocalTime).
  const schedule = renderer.getSchedule(exportMedia.length, durationSeconds, lines);

  // Render every frame, handing each finished canvas to `sink`. Shared by both
  // encode paths — the render/seek logic is identical; only the sink differs.
  async function renderFrames(
    sink: (canvas: HTMLCanvasElement, frameIndex: number) => Promise<void>,
  ): Promise<void> {
    for (let f = 0; f < totalFrames; f++) {
      // Offset into the song so a trimmed export renders the real song content
      // for that window (lyrics, crossfades, grain all stay in sync with preview).
      const t = clipStart + f / fps;

      // For every visible layer that's a video, seek it to its exact local time
      // and WAIT for the frame before drawing — this is what keeps export
      // frame-accurate (and honours loop/freeze + crossfades, since the layer set
      // and local times come straight from the shared schedule).
      for (const layer of renderer.visibleAt(t, schedule)) {
        const item = exportMedia[layer.index];
        if (item.kind === "video") {
          const local = renderer.clipLocalTime(
            schedule[layer.index],
            item.duration,
            item.fit,
            t,
          );
          await seekVideoAndWait(item.video, safeSeekTarget(item.video, local, fps));
        }
      }

      renderer.render(ctx!, {
        media: exportMedia,
        timeSeconds: t,
        playbackSeconds: t,
        durationSeconds,
        lines,
      });
      await sink(canvas, f);
      onProgress?.((f / totalFrames) * 0.8); // rendering is ~80% of the work
    }
  }

  // Prefer hardware encoding via WebCodecs; fall back to JPEG frames + wasm
  // libx264 when unsupported, or if the encoder dies mid-flight (rare, but
  // hardware encoders can reject long sessions) — in which case the whole
  // render is redone on the fallback path so the user still gets their file.
  let hwStream: Uint8Array | null = null;
  const hw = await WebCodecsH264.create(width, height, fps, quality);
  if (hw) {
    try {
      await renderFrames((c, f) => hw.addFrame(c, f));
      hwStream = await hw.finish();
    } catch (err) {
      console.warn("WebCodecs encode failed; falling back to libx264:", err);
      hw.dispose();
      hwStream = null;
    }
  }

  if (hwStream) {
    await ffmpeg.writeFile("video.h264", hwStream);
  } else {
    await renderFrames(async (c, f) => {
      const jpeg = await canvasToJpeg(c);
      await ffmpeg.writeFile(`frame_${String(f).padStart(5, "0")}.jpg`, jpeg);
    });
  }

  // Original audio, muxed in untouched (re-encoded to AAC).
  const audioName = `audio_${audioFile.name.replace(/[^\w.]+/g, "_")}`;
  await ffmpeg.writeFile(audioName, await fetchFile(audioFile));

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(0.8 + Math.min(Math.max(progress, 0), 1) * 0.2);
  });

  // Draft favours speed (ultrafast/higher CRF); full favours quality.
  const x264 =
    quality === "draft"
      ? ["-preset", "ultrafast", "-crf", "30"]
      : ["-preset", "veryfast", "-crf", "20"];

  // Video input: either the hardware-encoded H.264 stream (mux only, -c:v copy)
  // or the JPEG frame sequence (encode with wasm libx264).
  const videoInputArgs = hwStream
    ? ["-framerate", String(fps), "-i", "video.h264"]
    : ["-framerate", String(fps), "-i", "frame_%05d.jpg"];
  const videoCodecArgs = hwStream
    ? ["-c:v", "copy"]
    : ["-c:v", "libx264", ...x264, "-pix_fmt", "yuv420p"];

  await ffmpeg.exec([
    ...videoInputArgs,
    // Seek + limit the audio input to the same window the frames cover. With the
    // default full-song range this is "-ss 0 -t <full>", i.e. a no-op.
    "-ss", String(clipStart),
    "-t", String(windowLength),
    "-i", audioName,
    ...videoCodecArgs,
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    "out.mp4",
  ]);

  const data = await ffmpeg.readFile("out.mp4");
  onProgress?.(1);
  // data is a Uint8Array; wrap a fresh copy for the Blob.
  return new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });
}
