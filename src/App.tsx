import { useEffect, useMemo, useRef, useState } from "react";
import {
  segmentsToLines,
  transcribe,
  type TranscriptionResult,
} from "./transcription";
import { MoodPreview } from "./MoodPreview";
import { LyricEditor, type EditableLine } from "./LyricEditor";
import { AudioPlayer } from "./AudioPlayer";
import { exportMoodVideo } from "./renderer/exportVideo";
import { MOOD, TEXT_COLOR_OPTIONS } from "./presets/mood-preset";

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "transcribing" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [images, setImages] = useState<ImageBitmap[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Style settings (driven through the Mood preset) ---
  const [colorIndex, setColorIndex] = useState(0);

  const effectivePreset = useMemo(() => {
    const c = TEXT_COLOR_OPTIONS[colorIndex];
    return {
      ...MOOD,
      text: {
        ...MOOD.text,
        color: c.color,
        shadow: { ...MOOD.text.shadow, color: c.haloColor, opacity: c.haloOpacity },
      },
    };
  }, [colorIndex]);

  // Editable lyric lines, seeded from the transcription (word-level timing) and
  // then refined in the editor. Drives the preview directly.
  const [lines, setLines] = useState<EditableLine[]>([]);
  useEffect(() => {
    if (!result) return;
    const seeded = segmentsToLines(result);
    if (seeded.length === 0) return; // keep existing lines if nothing came back
    setLines(seeded.map((l) => ({ ...l, id: crypto.randomUUID() })));
  }, [result]);

  function playFrom(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    void audio.play();
  }

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canExport =
    images.length > 0 &&
    lines.length > 0 &&
    !!audioFile &&
    Number.isFinite(audioRef.current?.duration ?? NaN);

  async function handleExport() {
    const audio = audioRef.current;
    if (!audio || !audioFile || !Number.isFinite(audio.duration)) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportMoodVideo({
        preset: effectivePreset,
        images,
        lines,
        audioFile,
        durationSeconds: audio.duration,
        onProgress: setExportProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lyric-video.mp4";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  // Revoke the object URL when it changes or on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setResult(null);
    setError(null);
    setStatus("idle");
  }

  // Dispose decoded bitmaps on unmount to free memory.
  useEffect(() => {
    return () => {
      images.forEach((b) => b.close());
    };
  }, [images]);

  async function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const bitmaps = await Promise.all(files.map((f) => createImageBitmap(f)));
    setImages((prev) => {
      prev.forEach((b) => b.close());
      return bitmaps;
    });
  }

  async function handleTranscribe() {
    if (!audioFile) return;
    setStatus("transcribing");
    setError(null);
    setResult(null);
    try {
      const res = await transcribe(audioFile);
      setResult(res);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const uploadLabel =
    "flex flex-col items-center gap-1 border border-dashed border-neutral-700 rounded-xl p-4 cursor-pointer hover:border-neutral-500 transition-colors text-center";

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="shrink-0 px-5 py-3 border-b border-neutral-900 flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight">Lyric Video</h1>
        <span className="text-xs text-neutral-500">Mood preset · 9:16</span>
      </header>

      <main className="flex-1 min-h-0 flex">
        {/* LEFT: controls */}
        <aside className="w-72 shrink-0 h-full overflow-y-auto border-r border-neutral-900 p-4 flex flex-col gap-3">
          <label className={uploadLabel}>
            <span className="text-sm text-neutral-300">
              {audioFile ? audioFile.name : "Audio file"}
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">mp3 / wav / m4a</span>
          </label>

          <label className={uploadLabel}>
            <span className="text-sm text-neutral-300">
              {images.length > 0
                ? `${images.length} image${images.length > 1 ? "s" : ""} loaded`
                : "Background images"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">
              select multiple to crossfade
            </span>
          </label>

          {audioFile && (
            <button
              onClick={handleTranscribe}
              disabled={status === "transcribing"}
              className="rounded-lg bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "transcribing" ? "Transcribing…" : "Transcribe"}
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">
              Text color
            </span>
            <div className="flex gap-2">
              {TEXT_COLOR_OPTIONS.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setColorIndex(i)}
                  title={c.name}
                  aria-label={c.name}
                  className={`w-7 h-7 rounded-full border transition-transform ${
                    i === colorIndex
                      ? "ring-2 ring-offset-2 ring-offset-neutral-950 ring-neutral-300 scale-105 border-transparent"
                      : "border-neutral-700 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          </div>

          {status === "transcribing" && (
            <p className="text-xs text-neutral-400">
              Running local Whisper… first run downloads the model.
            </p>
          )}
          {error && (
            <p className="text-xs text-red-400 break-words">Error: {error}</p>
          )}
          {result && (
            <p className="text-[11px] text-neutral-600 leading-snug">
              {result.engine} · {result.model} · {result.language}
            </p>
          )}

          {/* Export pinned to the bottom of the controls column. */}
          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={handleExport}
              disabled={!canExport || exporting}
              className="rounded-lg bg-emerald-500 text-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {exporting
                ? `Exporting… ${Math.round(exportProgress * 100)}%`
                : "Export MP4"}
            </button>
            {exporting && (
              <div className="h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-[width]"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
            )}
            <p className="text-[11px] text-neutral-600 leading-snug">
              {canExport
                ? "1080×1920 · 30fps · audio muxed"
                : "Add audio, images & lyrics to export"}
            </p>
          </div>
        </aside>

        {/* CENTER: preview + playback */}
        <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <MoodPreview
              preset={effectivePreset}
              images={images}
              lines={lines}
              audioRef={audioRef}
            />
          </div>
          <div className="w-full max-w-sm shrink-0">
            {audioUrl ? (
              <AudioPlayer src={audioUrl} audioRef={audioRef} />
            ) : (
              <p className="text-xs text-neutral-600 text-center">
                Upload audio to preview playback
              </p>
            )}
          </div>
        </section>

        {/* RIGHT: lyric/timing editor (scrolls within itself) */}
        <aside className="w-96 shrink-0 h-full border-l border-neutral-900 p-4 flex flex-col min-h-0">
          {audioUrl ? (
            <LyricEditor
              lines={lines}
              onChange={setLines}
              onPlayFrom={playFrom}
              audioRef={audioRef}
            />
          ) : (
            <div className="m-auto text-center text-sm text-neutral-600">
              Upload audio, then transcribe or add lyric lines here.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
