import { useEffect, useRef } from "react";
import { MOOD } from "./presets/mood-preset";
import { MoodRenderer, type FrameImage } from "./renderer/moodRenderer";

/**
 * Live preview surface. Renders at the preset's true output resolution
 * (1080×1920) and is CSS-scaled down to fit the page, so the preview matches
 * what the export will produce. Runs a rAF loop purely to animate the grain.
 */
export function MoodPreview({ image }: { image: FrameImage | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      renderer.render(ctx, { image, timeSeconds: (now - start) / 1000 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [image]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-auto h-[70vh] max-w-full rounded-lg shadow-2xl mx-auto"
      style={{ aspectRatio: `${MOOD.output.width} / ${MOOD.output.height}` }}
    />
  );
}
