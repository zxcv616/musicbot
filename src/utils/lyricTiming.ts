/** Round to 2 decimal places (seconds precision displayed in the editor). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clamp a start value to ≥0 and round to 2dp. */
export function clampStart(n: number): number {
  return round2(Math.max(0, n));
}

export interface TimingLine {
  id: string;
  start: number;
}

/** Return a new sorted-by-start copy of the array. */
export function sortLines<T extends TimingLine>(lines: T[]): T[] {
  return [...lines].sort((a, b) => a.start - b.start);
}
