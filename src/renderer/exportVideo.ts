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
  /** "draft" = half-resolution + ultrafast encode for a quick check. */
  quality?: ExportQuality;
  /** 0..1 across render + encode. */
  onProgress?: (fraction: number) => void;
}

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

  // Offscreen render target at the (effective) output resolution.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Same renderer instance type as the preview — identical code path.
  const renderer = new MoodRenderer(renderPreset);

  // Make sure the bundled font is ready so frames aren't rendered with a fallback.
  await document.fonts.load(`${preset.text.fontWeight} 84px "Arimo"`);
  await document.fonts.ready;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });

  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

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

  // Render each frame and hand it to ffmpeg's in-memory filesystem.
  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;

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

    renderer.render(ctx, {
      media: exportMedia,
      timeSeconds: t,
      playbackSeconds: t,
      durationSeconds,
      lines,
    });
    const jpeg = await canvasToJpeg(canvas);
    const name = `frame_${String(f).padStart(5, "0")}.jpg`;
    await ffmpeg.writeFile(name, jpeg);
    onProgress?.((f / totalFrames) * 0.8); // rendering is ~80% of the work
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

  await ffmpeg.exec([
    "-framerate", String(fps),
    "-i", "frame_%05d.jpg",
    "-i", audioName,
    "-c:v", "libx264",
    ...x264,
    "-pix_fmt", "yuv420p",
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
