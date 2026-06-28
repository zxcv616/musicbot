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

// Single-thread ESM core (no SharedArrayBuffer → no COOP/COEP headers needed).
// @ffmpeg/ffmpeg runs a module worker, so the ESM core is required (it dynamic-
// imports the core and reads its default export).
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

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

  // Render each frame and hand it to ffmpeg's in-memory filesystem.
  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    renderer.render(ctx, {
      media,
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
