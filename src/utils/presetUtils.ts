import type { LyricPreset, TextColorOption, AspectOption } from "../presets/mood-preset";

/**
 * Produce the effective preset from a base preset plus the user's current
 * text-color, aspect-ratio and text-size selections. Pure function — does not
 * mutate the base preset.
 *
 * @param textScale Multiplier on the preset's fontSizeVmin (1 = preset default).
 */
export function buildEffectivePreset(
  base: LyricPreset,
  color: TextColorOption,
  aspect: AspectOption,
  textScale = 1,
): LyricPreset {
  return {
    ...base,
    output: { ...base.output, width: aspect.width, height: aspect.height },
    text: {
      ...base.text,
      color: color.color,
      fontSizeVmin: base.text.fontSizeVmin * textScale,
      shadow: { ...base.text.shadow, color: color.haloColor, opacity: color.haloOpacity },
    },
  };
}
