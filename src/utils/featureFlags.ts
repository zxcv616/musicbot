/**
 * Parse a Vite env string into a boolean feature flag.
 * Only the exact string "true" enables the feature — anything else
 * (undefined, "false", "1", etc.) leaves it off.
 */
export function parseFlag(val: string | undefined): boolean {
  return val === "true";
}
