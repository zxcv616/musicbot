import { useEffect, useRef } from "react";
import type { LyricPreset } from "./presets/mood-preset";
import {
  MoodRenderer,
  type BackgroundMedia,
  type LyricLine,
} from "./renderer/moodRenderer";

interface MoodPreviewProps {
  preset: LyricPreset;
  media: BackgroundMedia[];
  lines?: LyricLine[];
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

/**
 * Live preview surface. Renders at the preset's true output resolution and is
 * CSS-scaled down to fit the page, so the preview matches the export.
 *
 * The renderer (and its grain pool) is created once; per-frame inputs and the
 * current preset are read through refs so changing a setting never rebuilds it.
 * Background <video> elements are kept in sync with the song each frame (play
 * while their slot is on screen, seek when scrubbing) so the renderer just draws
 * whatever frame they currently hold.
 */
export function MoodPreview({ preset, media, lines, audioRef }: MoodPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const presetRef = useRef(preset);
  const mediaRef = useRef(media);
  const linesRef = useRef(lines);
  const audioElRef = useRef(audioRef);
  presetRef.current = preset;
  mediaRef.current = media;
  linesRef.current = lines;
  audioElRef.current = audioRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new MoodRenderer(presetRef.current);
    renderer.sizeCanvas(canvas);
    void document.fonts.load(`${presetRef.current.text.fontWeight} 84px "Arimo"`);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const p = presetRef.current;
      renderer.preset = p;
      if (canvas.width !== p.output.width || canvas.height !== p.output.height) {
        renderer.sizeCanvas(canvas);
      }

      const audio = audioElRef.current?.current;
      const duration =
        audio && Number.isFinite(audio.duration) ? audio.duration : undefined;
      const t = audio?.currentTime ?? 0;
      const playing = !!audio && !audio.paused && !audio.ended;
      const mediaItems = mediaRef.current;
      const lyricLines = linesRef.current;

      syncBackgroundVideos(renderer, mediaItems, duration, lyricLines, t, playing);

      renderer.render(ctx, {
        media: mediaItems,
        timeSeconds: (now - start) / 1000,
        playbackSeconds: t,
        durationSeconds: duration,
        lines: lyricLines,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      // Intrinsic size = output resolution, scaled down to fit (contain), so the
      // preview fills whichever dimension is the constraint at the chosen ratio.
      className="block max-h-full max-w-full rounded-xl shadow-2xl"
    />
  );
}

/**
 * Drive each background <video> to follow the song: play the visible clip(s) and
 * pause the rest; seek when scrubbing or when playback drifts. The renderer's
 * schedule is the single source of truth so this matches what gets drawn.
 */
function syncBackgroundVideos(
  renderer: MoodRenderer,
  media: BackgroundMedia[],
  duration: number | undefined,
  lines: LyricLine[] | undefined,
  t: number,
  playing: boolean,
): void {
  if (!media.some((m) => m.kind === "video")) return;

  const schedule = renderer.getSchedule(media.length, duration, lines);
  const visible = new Set(renderer.visibleAt(t, schedule).map((v) => v.index));

  media.forEach((m, idx) => {
    if (m.kind !== "video") return;
    const v = m.video;

    if (!visible.has(idx)) {
      if (!v.paused) v.pause();
      return;
    }

    const desired = renderer.clipLocalTime(schedule[idx], m.duration, m.fit, t);
    v.loop = m.fit === "loop";

    if (playing) {
      // Let it play; only correct when it has drifted noticeably.
      if (Math.abs(v.currentTime - desired) > 0.3) {
        try {
          v.currentTime = desired;
        } catch {
          /* not seekable yet */
        }
      }
      if (v.paused) void v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - desired) > 0.05) {
        try {
          v.currentTime = desired;
        } catch {
          /* not seekable yet */
        }
      }
    }
  });
}
