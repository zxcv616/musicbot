/**
 * In-browser speech recognition via transformers.js (Whisper, ONNX runtime).
 *
 * Runs fully client-side — no backend, no per-song cost, works on static
 * hosting (Cloudflare). It produces word-level timestamps from the audio; the
 * *words* may be wrong on sung vocals, which is fine: alignLyrics() borrows only
 * the timing and keeps the artist's pasted lyrics (see utils/lyricAlign).
 *
 * The model is downloaded once from the Hugging Face Hub and cached by the
 * browser. We try WebGPU first (much faster) and fall back to wasm so it still
 * runs on phones. The pipeline is created lazily and reused across calls.
 */

import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { TimedWord } from "./utils/lyricAlign";

// "small" (~150MB) hears sung vocals much better than "base", giving the
// aligner more correct anchors and steadier word timestamps. Bump to
// "whisper-medium" for best accuracy (~500MB, heavy on phones), or drop back to
// "whisper-base" (~40MB) for the fastest download. Word timestamps need a model
// whose repo ships alignment-head metadata — the Xenova whisper exports do.
const MODEL_ID = "Xenova/whisper-small";

export interface SyncProgress {
  /** Coarse phase label for the UI. */
  stage: "loading" | "transcribing";
  /** 0..1 within the loading phase (model download); undefined while transcribing. */
  progress?: number;
}

let pipePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function loadPipeline(
  onProgress?: (p: SyncProgress) => void,
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (pipePromise) return pipePromise;

  const progress_callback = (item: { status?: string; progress?: number }) => {
    if (item.status === "progress" && typeof item.progress === "number") {
      onProgress?.({ stage: "loading", progress: item.progress / 100 });
    }
  };

  pipePromise = (async () => {
    // Dynamic import: keep the heavy ML library (and its ~23 MB ONNX runtime)
    // out of the initial bundle — it loads only when the user syncs.
    const { pipeline, env } = await import("@huggingface/transformers");
    // We only ever fetch models from the Hub, never from our own server path.
    env.allowLocalModels = false;
    try {
      return (await pipeline("automatic-speech-recognition", MODEL_ID, {
        device: "webgpu",
        // fp16 ≈ half the download of fp32 with negligible accuracy loss, and is
        // the well-supported quantization for WebGPU.
        dtype: "fp16",
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline;
    } catch {
      // No WebGPU (or it failed to init) → wasm with a quantised model.
      return (await pipeline("automatic-speech-recognition", MODEL_ID, {
        device: "wasm",
        dtype: "q8",
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline;
    }
  })();
  return pipePromise;
}

/** Decode any browser-supported audio file to mono Float32 PCM at 16 kHz. */
async function decodeTo16kMono(file: File): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(buf);
  await ctx.close();

  // Resample + downmix: a 1-channel OfflineAudioContext destination mixes the
  // source down to mono and renders at the target 16 kHz rate.
  const frames = Math.ceil(decoded.duration * 16000);
  const offline = new OfflineAudioContext(1, frames, 16000);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Transcribe an audio file in the browser, returning timed words. Long audio is
 * chunked internally by the pipeline; timestamps are stitched across chunks.
 */
export async function transcribeInBrowser(
  file: File,
  onProgress?: (p: SyncProgress) => void,
): Promise<TimedWord[]> {
  const asr = await loadPipeline(onProgress);
  const audio = await decodeTo16kMono(file);

  onProgress?.({ stage: "transcribing" });
  const output = await asr(audio, {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  // With return_timestamps: "word", output.chunks is [{ text, timestamp:[s,e] }].
  const chunks =
    (output as { chunks?: { text: string; timestamp: [number, number] }[] })
      .chunks ?? [];

  const wordsOut: TimedWord[] = [];
  for (const c of chunks) {
    const text = c.text?.trim();
    const [start, end] = c.timestamp ?? [];
    if (!text || start == null || end == null) continue;
    wordsOut.push({ word: text, start, end });
  }
  return wordsOut;
}
