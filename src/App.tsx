import { useEffect, useRef, useState } from "react";
import {
  segmentsToLines,
  transcribe,
  type TranscriptionResult,
} from "./transcription";
import { MoodPreview } from "./MoodPreview";
import { LyricEditor, type EditableLine } from "./LyricEditor";
import { exportMoodVideo } from "./renderer/exportVideo";

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

  // Editable lyric lines, seeded from the transcription (word-level timing) and
  // then refined in the editor. Drives the preview directly.
  const [lines, setLines] = useState<EditableLine[]>([]);
  useEffect(() => {
    if (!result) return;
    setLines(
      segmentsToLines(result).map((l) => ({ ...l, id: crypto.randomUUID() })),
    );
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6 mt-10">
        <header className="text-center">
          <h1 className="text-2xl font-medium tracking-tight">Lyric Video</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Upload a song, then transcribe it.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col items-center gap-2 border border-dashed border-neutral-700 rounded-xl p-6 cursor-pointer hover:border-neutral-500 transition-colors">
            <span className="text-sm text-neutral-300">
              {images.length > 0
                ? `${images.length} background image${images.length > 1 ? "s" : ""} loaded`
                : "Choose background image(s)"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">
              Click to browse — select multiple to crossfade
            </span>
          </label>
          <MoodPreview images={images} lines={lines} audioRef={audioRef} />
          {lines.length > 0 && (
            <p className="text-xs text-neutral-500 text-center">
              Press play below — lyrics sync to the audio.
            </p>
          )}
        </div>

        <label className="flex flex-col items-center gap-3 border border-dashed border-neutral-700 rounded-xl p-8 cursor-pointer hover:border-neutral-500 transition-colors">
          <span className="text-sm text-neutral-300">
            {audioFile ? audioFile.name : "Choose an audio file (mp3 / wav / m4a)"}
          </span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="text-xs text-neutral-500">Click to browse</span>
        </label>

        {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="w-full" />}

        {audioFile && (
          <button
            onClick={handleTranscribe}
            disabled={status === "transcribing"}
            className="rounded-lg bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "transcribing" ? "Transcribing…" : "Transcribe"}
          </button>
        )}

        {status === "transcribing" && (
          <p className="text-sm text-neutral-400 text-center">
            Running local Whisper… the first run downloads the model, so this can
            take a while.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 break-words">Error: {error}</p>
        )}

        {result && (
          <p className="text-xs text-neutral-500">
            {result.engine} · model {result.model} · {result.language} ·{" "}
            {result.duration}s
          </p>
        )}

        <LyricEditor lines={lines} onChange={setLines} onPlayFrom={playFrom} />

        {canExport && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-emerald-500 text-neutral-950 px-4 py-2 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting
                ? `Exporting… ${Math.round(exportProgress * 100)}%`
                : "Export MP4 (9:16, 1080×1920)"}
            </button>
            {exporting && (
              <>
                <div className="h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-[width]"
                    style={{ width: `${Math.round(exportProgress * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 text-center">
                  Rendering frames in the browser, then encoding — this runs
                  locally and can take a while for longer songs.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
