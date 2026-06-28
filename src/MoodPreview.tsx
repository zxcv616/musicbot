import { useEffect, useRef } from "react";
import { MOOD } from "./presets/mood-preset";
import {
  MoodRenderer,
  type FrameImage,
  type LyricLine,
} from "./renderer/moodRenderer";

interface MoodPreviewProps {
  images: FrameImage[];
  lines?: LyricLine[];
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

/**
 * Live preview surface. Renders at the preset's true output resolution
 * (1080×1920) and is CSS-scaled down to fit the page, so the preview matches
 * what the export will produce.
 *
 * The renderer (and its grain pool) is created once; per-frame inputs are read
 * through refs so changing the image or lyrics never rebuilds it. Lyric sync is
 * driven by the <audio> element's currentTime; grain animates off a free clock.
 */
export function MoodPreview({ images, lines, audioRef }: MoodPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest per-frame inputs, read inside the rAF loop without re-running it.
  const imagesRef = useRef(images);
  const linesRef = useRef(lines);
  const audioElRef = useRef(audioRef);
  imagesRef.current = images;
  linesRef.current = lines;
  audioElRef.current = audioRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new MoodRenderer(MOOD);
    renderer.sizeCanvas(canvas);

    // Ensure the bundled Brat font is loaded so the canvas never falls back.
    void document.fonts.load(`${MOOD.text.fontWeight} 84px "Arimo"`);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const audio = audioElRef.current?.current;
      const duration =
        audio && Number.isFinite(audio.duration) ? audio.duration : undefined;
      renderer.render(ctx, {
        images: imagesRef.current,
        timeSeconds: (now - start) / 1000,
        playbackSeconds: audio?.currentTime ?? 0,
        durationSeconds: duration,
        lines: linesRef.current,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      // Intrinsic 1080×1920 scaled down to fit the container (contain), so the
      // 9:16 preview fills whichever dimension is the constraint.
      className="block max-h-full max-w-full rounded-xl shadow-2xl"
    />
  );
}
