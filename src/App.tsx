import { useEffect, useRef, useState } from "react";

function App() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
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
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-2xl font-medium tracking-tight">Lyric Video</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Upload a song to get started.
          </p>
        </header>

        <label className="flex flex-col items-center gap-3 border border-dashed border-neutral-700 rounded-xl p-8 cursor-pointer hover:border-neutral-500 transition-colors">
          <span className="text-sm text-neutral-300">
            {fileName ? fileName : "Choose an audio file (mp3 / wav / m4a)"}
          </span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="text-xs text-neutral-500">Click to browse</span>
        </label>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}

export default App;
