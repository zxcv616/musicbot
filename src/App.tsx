import { useEffect, useMemo, useRef, useState } from "react";
import {
  segmentsToLines,
  transcribe,
  type TranscriptionResult,
} from "./transcription";
import { MoodPreview } from "./MoodPreview";
import { LyricEditor, type EditableLine } from "./LyricEditor";
import { AudioPlayer } from "./AudioPlayer";
import { exportMoodVideo, type ExportQuality } from "./renderer/exportVideo";
import type { BackgroundMedia, VideoFit } from "./renderer/moodRenderer";
import { MOOD, TEXT_COLOR_OPTIONS, ASPECT_OPTIONS } from "./presets/mood-preset";
import { BRAT } from "./presets/brat-preset";
import { TYPEWRITER } from "./presets/typewriter-preset";
import { buildEffectivePreset } from "./utils/presetUtils";
import { transcribeInBrowser } from "./browserTranscribe";
import { alignLyrics, wordsToLines } from "./utils/lyricAlign";
import { TRANSCRIPTION_ENABLED } from "./config";

const ALL_PRESETS = [MOOD, BRAT, TYPEWRITER];

// Smallest exportable clip length (seconds), so the trim handles can't cross.
const MIN_CLIP_SECONDS = 1;

function fmtClock(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function disposeMedia(items: BackgroundMedia[]): void {
  for (const m of items) {
    if (m.kind === "image") {
      if ("close" in m.image) m.image.close();
    } else {
      m.video.pause();
      URL.revokeObjectURL(m.video.src);
    }
  }
}

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "transcribing" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [media, setMedia] = useState<BackgroundMedia[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Style settings (driven through the active preset) ---
  const [presetIndex, setPresetIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [ratioIndex, setRatioIndex] = useState(0);
  // Multiplier on the preset's font size (1 = preset default).
  const [textScale, setTextScale] = useState(1);
  // How a video clip shorter than its slot fills the gap (loop vs hold frame).
  const [videoFit, setVideoFit] = useState<VideoFit>("loop");
  const hasVideo = media.some((m) => m.kind === "video");

  const effectivePreset = useMemo(
    () => buildEffectivePreset(
      ALL_PRESETS[presetIndex],
      TEXT_COLOR_OPTIONS[colorIndex],
      ASPECT_OPTIONS[ratioIndex],
      textScale,
    ),
    [presetIndex, colorIndex, ratioIndex, textScale],
  );

  // Reset text color to each preset's natural default when switching.
  // Mood → Cream (index 0); Brat → Black (index 2, black on lime).
  useEffect(() => {
    setColorIndex(presetIndex === 1 ? 2 : 0);
  }, [presetIndex]);

  // Editable lyric lines, seeded from the transcription (word-level timing) and
  // then refined in the editor. Drives the preview directly.
  const [lines, setLines] = useState<EditableLine[]>([]);
  useEffect(() => {
    if (!result) return;
    const seeded = segmentsToLines(result);
    if (seeded.length === 0) return; // keep existing lines if nothing came back
    setLines(seeded.map((l) => ({ ...l, id: crypto.randomUUID() })));
  }, [result]);

  // Paste-lyrics → in-browser transcription → align timings onto the artist's
  // (correct) words. Fully client-side; no backend needed.
  const [lyricsText, setLyricsText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState("");
  const [syncPct, setSyncPct] = useState(0);

  async function handleSyncLyrics() {
    if (!audioFile) return;
    const hasLyrics = lyricsText.trim().length > 0;
    setSyncing(true);
    setError(null);
    setSyncStage("Loading model…");
    setSyncPct(0);
    try {
      const words = await transcribeInBrowser(audioFile, (p) => {
        if (p.stage === "loading") {
          setSyncStage("Downloading model…");
          setSyncPct(p.progress ?? 0);
        } else {
          setSyncStage("Listening to the audio…");
          setSyncPct(0);
        }
      });
      // Pasted lyrics → keep the artist's words, borrow only timing.
      // Blank → auto-transcribe: use the model's own words, grouped into lines.
      const newLines = hasLyrics ? alignLyrics(lyricsText, words) : wordsToLines(words);
      if (newLines.length === 0) {
        throw new Error("Couldn't sync — no vocals detected in the audio.");
      }
      setLines(newLines.map((l) => ({ ...l, id: crypto.randomUUID() })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
      setSyncStage("");
    }
  }

  function playFrom(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    void audio.play();
  }

  // Export trim: the song-time window [trimStart, trimEnd] to render. Seeded to
  // the full song once metadata loads; reset when a new file is chosen.
  const [songDuration, setSongDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const trimmed = songDuration > 0 && (trimStart > 0 || trimEnd < songDuration);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => {
      const d = Number.isFinite(a.duration) ? a.duration : 0;
      setSongDuration(d);
      // Only seed the end the first time (when still 0) so reloads/durationchange
      // events don't clobber a range the user has already set.
      setTrimEnd((prev) => (prev === 0 ? d : prev));
    };
    if (Number.isFinite(a.duration) && a.duration > 0) onMeta();
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
    };
  }, [audioUrl]);

  const [exportMode, setExportMode] = useState<ExportQuality | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const exporting = exportMode !== null;

  const canExport =
    media.length > 0 &&
    lines.length > 0 &&
    !!audioFile &&
    Number.isFinite(audioRef.current?.duration ?? NaN);

  async function handleExport(quality: ExportQuality) {
    const audio = audioRef.current;
    if (!audio || !audioFile || !Number.isFinite(audio.duration)) return;
    setExportMode(quality);
    setExportProgress(0);
    try {
      const blob = await exportMoodVideo({
        preset: effectivePreset,
        media,
        lines,
        audioFile,
        durationSeconds: audio.duration,
        startSeconds: trimmed ? trimStart : 0,
        endSeconds: trimmed ? trimEnd : audio.duration,
        quality,
        onProgress: setExportProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lyric-video${quality === "draft" ? "-draft" : ""}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportMode(null);
    }
  }

  // Revoke the object URL when it changes or on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function loadAudioFile(file: File) {
    setAudioFile(file);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setResult(null);
    setError(null);
    setStatus("idle");
    // New song → reset the trim window; reseeded on loadedmetadata.
    setSongDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    loadAudioFile(file);
  }

  // Dispose media only on unmount (not on every change — videoFit remaps reuse
  // the same elements). Replacement disposal happens in handleMediaChange.
  const mediaRef = useRef<BackgroundMedia[]>([]);
  mediaRef.current = media;
  useEffect(() => () => disposeMedia(mediaRef.current), []);

  // Apply the short-clip fit setting to already-loaded video clips.
  useEffect(() => {
    setMedia((prev) =>
      prev.some((m) => m.kind === "video")
        ? prev.map((m) => (m.kind === "video" ? { ...m, fit: videoFit } : m))
        : prev,
    );
  }, [videoFit]);

  async function loadMediaFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (files.length === 0) return;
    const items: BackgroundMedia[] = await Promise.all(
      files.map(async (f): Promise<BackgroundMedia> => {
        if (f.type.startsWith("video/")) {
          const video = document.createElement("video");
          video.src = URL.createObjectURL(f);
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.loop = videoFit === "loop";
          await new Promise<void>((res, rej) => {
            video.onloadedmetadata = () => res();
            video.onerror = () => rej(new Error(`Could not load ${f.name}`));
          });
          // Prime the first frame so a paused preview isn't black.
          try {
            video.currentTime = Math.min(0.04, video.duration || 0.04);
          } catch {
            /* not seekable yet */
          }
          return { kind: "video", video, duration: video.duration, fit: videoFit };
        }
        return { kind: "image", image: await createImageBitmap(f) };
      }),
    );
    setMedia((prev) => {
      disposeMedia(prev);
      return items;
    });
  }

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    await loadMediaFiles(e.target.files);
  }

  // Drag-and-drop onto the audio / media upload zones (in addition to click-to-
  // browse). `zone` tracks which drop target is currently being dragged over,
  // for the highlight styling below.
  const [dragZone, setDragZone] = useState<"audio" | "media" | null>(null);

  function handleAudioDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragZone(null);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("audio/"),
    );
    if (file) loadAudioFile(file);
  }

  function handleMediaDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragZone(null);
    void loadMediaFiles(e.dataTransfer.files);
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

  function uploadLabelClass(active: boolean): string {
    return `flex flex-col items-center gap-1 border border-dashed rounded-xl p-4 cursor-pointer transition-colors text-center ${
      active
        ? "border-emerald-500 bg-emerald-500/10"
        : "border-neutral-700 hover:border-neutral-500"
    }`;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="shrink-0 px-5 py-3 border-b border-neutral-900 flex items-baseline gap-3">
        <h1 className="text-base font-semibold tracking-tight">Lyric Video</h1>
        <span className="text-[11px] text-neutral-600 tabular-nums">
          v{__APP_VERSION__}
        </span>
        <span className="text-xs text-neutral-500">
          {ALL_PRESETS[presetIndex].name} · {ASPECT_OPTIONS[ratioIndex].name}
        </span>
      </header>

      <main className="flex-1 min-h-0 flex">
        {/* LEFT: controls */}
        <aside className="w-72 shrink-0 h-full overflow-y-auto border-r border-neutral-900 p-4 flex flex-col gap-3">
          <label
            className={uploadLabelClass(dragZone === "audio")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragZone("audio");
            }}
            onDragLeave={() => setDragZone(null)}
            onDrop={handleAudioDrop}
          >
            <span className="text-sm text-neutral-300">
              {audioFile
                ? audioFile.name
                : dragZone === "audio"
                  ? "Drop audio file here"
                  : "Audio file"}
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">
              mp3 / wav / m4a · drag &amp; drop or click
            </span>
          </label>

          <label
            className={uploadLabelClass(dragZone === "media")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragZone("media");
            }}
            onDragLeave={() => setDragZone(null)}
            onDrop={handleMediaDrop}
          >
            <span className="text-sm text-neutral-300">
              {dragZone === "media"
                ? "Drop images / videos here"
                : media.length > 0
                  ? `${media.length} clip${media.length > 1 ? "s" : ""} loaded`
                  : "Background images / videos"}
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">
              images &amp; videos · multiple to crossfade
            </span>
          </label>

          {hasVideo && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Short clips
              </span>
              <div className="flex gap-1.5">
                {(["loop", "freeze"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setVideoFit(f)}
                    title={
                      f === "loop"
                        ? "Loop a clip that's shorter than its slot"
                        : "Hold the last frame of a short clip"
                    }
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                      videoFit === f
                        ? "bg-neutral-100 text-neutral-900"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {audioFile && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Lyrics
              </span>
              <textarea
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                placeholder="Paste your lyrics for perfect words — or leave blank to auto-transcribe"
                rows={5}
                className="w-full resize-y rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              />
              <button
                onClick={handleSyncLyrics}
                disabled={syncing}
                title={
                  lyricsText.trim()
                    ? "Transcribe the audio in your browser, then align your pasted lyrics to it"
                    : "Auto-transcribe the audio in your browser (no lyrics typed)"
                }
                className="rounded-lg bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing
                  ? syncStage || "Syncing…"
                  : lyricsText.trim()
                    ? "Sync pasted lyrics to audio"
                    : "Auto-transcribe lyrics"}
              </button>
              {syncing && (
                <>
                  <div className="h-1.5 w-full rounded bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-neutral-300 transition-[width]"
                      style={{ width: `${Math.round(syncPct * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    First run downloads the model (~tens of MB), then it's cached.
                  </p>
                </>
              )}
            </div>
          )}

          {TRANSCRIPTION_ENABLED && audioFile && (
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
              Preset
            </span>
            <div className="flex gap-1.5">
              {ALL_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setPresetIndex(i)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    i === presetIndex
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                Text size
              </span>
              {textScale !== 1 && (
                <button
                  onClick={() => setTextScale(1)}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.02}
              value={textScale}
              onChange={(e) => setTextScale(parseFloat(e.target.value))}
              aria-label="Lyric text size"
              className="w-full accent-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">
              Aspect ratio
            </span>
            <div className="flex gap-1.5">
              {ASPECT_OPTIONS.map((a, i) => (
                <button
                  key={a.name}
                  onClick={() => setRatioIndex(i)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    i === ratioIndex
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          {TRANSCRIPTION_ENABLED && status === "transcribing" && (
            <p className="text-xs text-neutral-400">
              Running local Whisper… first run downloads the model.
            </p>
          )}
          {error && (
            <p className="text-xs text-red-400 break-words">Error: {error}</p>
          )}
          {TRANSCRIPTION_ENABLED && result && (
            <p className="text-[11px] text-neutral-600 leading-snug">
              {result.engine} · {result.model} · {result.language}
            </p>
          )}

          {/* Export pinned to the bottom of the controls column. */}
          <div className="mt-auto flex flex-col gap-2">
            {songDuration > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Export range
                  </span>
                  {trimmed && (
                    <button
                      onClick={() => {
                        setTrimStart(0);
                        setTrimEnd(songDuration);
                      }}
                      className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      Full song
                    </button>
                  )}
                </div>
                <div className="relative h-4 my-0.5">
                  {/* Full track */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-neutral-700" />
                  {/* Selected region between the two handles */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-emerald-500"
                    style={{
                      left: `${(trimStart / songDuration) * 100}%`,
                      width: `${((trimEnd - trimStart) / songDuration) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={songDuration}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) =>
                      setTrimStart(
                        Math.min(
                          parseFloat(e.target.value),
                          trimEnd - MIN_CLIP_SECONDS,
                        ),
                      )
                    }
                    aria-label="Clip start"
                    className="range-dual"
                  />
                  <input
                    type="range"
                    min={0}
                    max={songDuration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) =>
                      setTrimEnd(
                        Math.max(
                          parseFloat(e.target.value),
                          trimStart + MIN_CLIP_SECONDS,
                        ),
                      )
                    }
                    aria-label="Clip end"
                    className="range-dual"
                  />
                </div>
                <div className="flex justify-between text-[11px] tabular-nums text-neutral-400">
                  <span>{fmtClock(trimStart)}</span>
                  <span className="text-neutral-300">
                    {fmtClock(trimEnd - trimStart)} clip
                  </span>
                  <span>{fmtClock(trimEnd)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("draft")}
                disabled={!canExport || exporting}
                title="Half-resolution, fast encode — quick timing/vibe check"
                className="flex-1 rounded-lg bg-neutral-800 text-neutral-100 px-3 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {exportMode === "draft"
                  ? `Draft… ${Math.round(exportProgress * 100)}%`
                  : "Draft (fast)"}
              </button>
              <button
                onClick={() => handleExport("full")}
                disabled={!canExport || exporting}
                title="Full resolution, best quality"
                className="flex-1 rounded-lg bg-emerald-500 text-neutral-950 px-3 py-2 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {exportMode === "full"
                  ? `Full… ${Math.round(exportProgress * 100)}%`
                  : "Full quality"}
              </button>
            </div>
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
                ? `${ASPECT_OPTIONS[ratioIndex].name} · 30fps · ${
                    trimmed ? `${fmtClock(trimEnd - trimStart)} clip` : "full song"
                  } · draft is half-res`
                : "Add audio, media & lyrics to export"}
            </p>
          </div>
        </aside>

        {/* CENTER: preview + playback */}
        <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <MoodPreview
              preset={effectivePreset}
              media={media}
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
