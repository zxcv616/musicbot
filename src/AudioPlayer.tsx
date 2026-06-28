import { useCallback, useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  src: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Themed playback bar matching the app's muted-dark aesthetic. Wraps a hidden
 * native <audio> (so audioRef stays shared with the preview + editor) and draws
 * its own play/pause button, scrubber, and time display.
 */
export function AudioPlayer({ src, audioRef }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
    };
  }, [audioRef, src]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, [audioRef]);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const a = audioRef.current;
      const bar = barRef.current;
      if (!a || !bar || !Number.isFinite(a.duration)) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      a.currentTime = ratio * a.duration;
      setCurrent(a.currentTime);
    },
    [audioRef],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) seekToClientX(e.clientX);
    };
    const onUp = () => (draggingRef.current = false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [seekToClientX]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 rounded-full bg-neutral-900/80 border border-neutral-800 px-3 py-2">
      <audio ref={audioRef} src={src} className="hidden" />

      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-neutral-100 text-neutral-900 hover:bg-white transition-colors"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11a1 1 0 0 0 1.5.87l9-5.5a1 1 0 0 0 0-1.74l-9-5.5A1 1 0 0 0 4 2.5Z" />
          </svg>
        )}
      </button>

      <span className="shrink-0 text-xs tabular-nums text-neutral-400 w-9 text-right">
        {fmt(current)}
      </span>

      <div
        ref={barRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          seekToClientX(e.clientX);
        }}
        className="group relative flex-1 h-4 flex items-center cursor-pointer"
      >
        <div className="relative h-1 w-full rounded-full bg-neutral-700">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-neutral-200"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-neutral-500 w-9">
        {fmt(duration)}
      </span>
    </div>
  );
}
