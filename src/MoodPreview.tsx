import { useEffect, useRef } from "react";
import type { LyricPreset } from "./presets/mood-preset";
import {
  MoodRenderer,
  type FrameImage,
  type LyricLine,
} from "./renderer/moodRenderer";

interface MoodPreviewProps {
  preset: LyricPreset;
  images: FrameImage[];
  lines?: LyricLine[];
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

/**
 * Live preview surface. Renders at the preset's true output resolution and is
 * CSS-scaled down to fit the page, so the preview matches the export.
 *
 * The renderer (and its grain pool) is created once; per-frame inputs — and the
 * current preset (text colour, aspect ratio) — are read through refs so changing
 * a setting never rebuilds it. The canvas is resized in-loop when the output
 * dimensions change so the preview reflects the chosen aspect ratio.
 */
export function MoodPreview({ preset, images, lines, audioRef }: MoodPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const presetRef = useRef(preset);
  const imagesRef = useRef(images);
  const linesRef = useRef(lines);
  const audioElRef = useRef(audioRef);
  presetRef.current = preset;
  imagesRef.current = images;
  linesRef.current = lines;
  audioElRef.current = audioRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new MoodRenderer(presetRef.current);
    renderer.sizeCanvas(canvas);

    // Ensure the bundled Brat font is loaded so the canvas never falls back.
    void document.fonts.load(`${presetRef.current.text.fontWeight} 84px "Arimo"`);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const p = presetRef.current;
      renderer.preset = p;
      // Resize the canvas if the aspect ratio / resolution changed.
      if (canvas.width !== p.output.width || canvas.height !== p.output.height) {
        renderer.sizeCanvas(canvas);
      }

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
      // Intrinsic size = output resolution, scaled down to fit (contain), so the
      // preview fills whichever dimension is the constraint at the chosen ratio.
      className="block max-h-full max-w-full rounded-xl shadow-2xl"
    />
  );
}
