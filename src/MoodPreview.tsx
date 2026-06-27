import { useEffect, useRef } from "react";
import { MOOD } from "./presets/mood-preset";
import {
  MoodRenderer,
  type FrameImage,
  type LyricLine,
} from "./renderer/moodRenderer";

interface MoodPreviewProps {
  image: FrameImage | null;
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
export function MoodPreview({ image, lines, audioRef }: MoodPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest per-frame inputs, read inside the rAF loop without re-running it.
  const imageRef = useRef(image);
  const linesRef = useRef(lines);
  const audioElRef = useRef(audioRef);
  imageRef.current = image;
  linesRef.current = lines;
  audioElRef.current = audioRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new MoodRenderer(MOOD);
    renderer.sizeCanvas(canvas);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      renderer.render(ctx, {
        image: imageRef.current,
        timeSeconds: (now - start) / 1000,
        playbackSeconds: audioElRef.current?.current?.currentTime ?? 0,
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
      className="block w-auto h-[70vh] max-w-full rounded-lg shadow-2xl mx-auto"
      style={{ aspectRatio: `${MOOD.output.width} / ${MOOD.output.height}` }}
    />
  );
}
