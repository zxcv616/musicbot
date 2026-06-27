import { useEffect, useRef, useState } from "react";
import { transcribe, type TranscriptionResult } from "./transcription";
import { MoodPreview } from "./MoodPreview";

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "transcribing" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Decode the uploaded image to an ImageBitmap the renderer can draw, and
  // dispose the previous one to free GPU/CPU memory.
  useEffect(() => {
    return () => {
      if (image) image.close();
    };
  }, [image]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    setImage((prev) => {
      if (prev) prev.close();
      return bitmap;
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
              {image ? "Background image loaded" : "Choose a background image"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <span className="text-xs text-neutral-500">Click to browse</span>
          </label>
          <MoodPreview image={image} />
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
          <section className="flex flex-col gap-3">
            <p className="text-xs text-neutral-500">
              {result.engine} · model {result.model} · {result.language} ·{" "}
              {result.duration}s
            </p>
            <div className="flex flex-col gap-2">
              {result.segments.map((seg) => (
                <p key={seg.id} className="text-base leading-relaxed">
                  <span className="text-neutral-600 text-xs mr-2 tabular-nums">
                    {seg.start.toFixed(1)}s
                  </span>
                  {seg.text}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
