/**
 * Save / load a lyric set (text + timings) as a small JSON file, so a musician
 * can close the tab and come back to the timing work they did — or hand the
 * timed lyrics to a friend. Fully client-side: the file is downloaded from and
 * dropped back into the browser, no server involved.
 *
 * Only the lyrics travel in the file (text + start/end per line). The audio,
 * background media and style preset are not included — the artist re-adds those
 * and re-picks the look; the tedious, losable part is the timing, and that's
 * what this preserves.
 */

import type { LyricLine } from "../renderer/moodRenderer";

const FORMAT = "lyric-video-lyrics";
const VERSION = 1;

/** Serialize lyric lines to the JSON text written to the downloaded file. */
export function serializeLyrics(lines: LyricLine[]): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      lines: lines.map((l) => ({ text: l.text, start: l.start, end: l.end })),
    },
    null,
    2,
  );
}

/**
 * Parse the text of a dropped/opened lyrics file back into lyric lines, sorted
 * by start time. Throws a user-facing message if the file isn't a valid lyrics
 * file. Malformed individual lines are skipped rather than failing the whole load.
 */
export function parseLyricsFile(text: string): LyricLine[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a saved lyrics file (couldn't read it).");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("That file isn't a saved lyrics file.");
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== FORMAT) {
    throw new Error("That file isn't a saved lyrics file.");
  }
  if (!Array.isArray(obj.lines)) {
    throw new Error("This lyrics file has no lines in it.");
  }

  const lines: LyricLine[] = [];
  for (const raw of obj.lines) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const text = typeof r.text === "string" ? r.text : "";
    const start = Number(r.start);
    const end = Number(r.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    lines.push({ text, start, end });
  }
  if (lines.length === 0) {
    throw new Error("This lyrics file had no usable lines.");
  }

  lines.sort((a, b) => a.start - b.start);
  return lines;
}
