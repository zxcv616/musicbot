import type { LyricPreset, TextColorOption, AspectOption } from "../presets/mood-preset";

/**
 * Produce the effective preset from a base preset plus the user's current
 * text-color and aspect-ratio selections. Pure function — does not mutate
 * the base preset.
 */
export function buildEffectivePreset(
  base: LyricPreset,
  color: TextColorOption,
  aspect: AspectOption,
): LyricPreset {
  return {
    ...base,
    output: { ...base.output, width: aspect.width, height: aspect.height },
    text: {
      ...base.text,
      color: color.color,
      shadow: { ...base.text.shadow, color: color.haloColor, opacity: color.haloOpacity },
    },
  };
}
