/**
 * Align an artist's *known* lyrics to word-level timings produced by speech
 * recognition. The recogniser hears the audio and emits timestamped words — but
 * on sung vocals it often mishears the actual words. The artist, however, knows
 * exactly what they wrote. So we take the correct words from the pasted lyrics
 * and borrow only the *timing* from the (possibly wrong) transcript.
 *
 * This is a lightweight, fully client-side stand-in for phoneme forced
 * alignment: a global sequence alignment (Needleman–Wunsch) pairs each pasted
 * word with the transcript word at the same position in the sequence, even
 * across mishearings, insertions and deletions. Each pasted word inherits its
 * paired word's time; unpaired words are interpolated from their neighbours.
 *
 * Output is per-line start/end (one LyricLine per non-empty input row), which is
 * exactly what the renderer consumes — and the editor lets the artist nudge.
 */

import type { LyricLine } from "../renderer/moodRenderer";

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

/** Lowercase and strip everything but letters/digits, for robust matching. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Group raw transcript words into lyric lines for the *auto-transcribe* path
 * (no pasted lyrics). Breaks a line on a sung pause (gap between words) or once
 * a line gets long, so phrasing roughly follows the vocal delivery.
 */
export function wordsToLines(
  words: TimedWord[],
  opts: { maxGapSeconds?: number; maxWords?: number } = {},
): LyricLine[] {
  const maxGap = opts.maxGapSeconds ?? 0.6;
  const maxWords = opts.maxWords ?? 8;
  const timed = words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));

  const lines: LyricLine[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur
      .map((w) => w.word)
      .join(" ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
    if (text) lines.push({ text, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of timed) {
    if (cur.length > 0) {
      const gap = w.start - cur[cur.length - 1].end;
      if (gap > maxGap || cur.length >= maxWords) flush();
    }
    cur.push(w);
  }
  flush();
  return lines;
}

/**
 * Global sequence alignment. Returns aligned index pairs `[aIdx, bIdx]`; a null
 * on either side marks an insertion/deletion (a gap) in that sequence.
 */
function needlemanWunsch(
  a: string[],
  b: string[],
): Array<[number | null, number | null]> {
  const n = a.length;
  const m = b.length;
  const GAP = -1;
  const MATCH = 2;
  const MISMATCH = -1;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 0; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 0; j <= m; j++) dp[0][j] = j * GAP;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + s,
        dp[i - 1][j] + GAP,
        dp[i][j - 1] + GAP,
      );
    }
  }

  const pairs: Array<[number | null, number | null]> = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const s = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
    if (dp[i][j] === dp[i - 1][j - 1] + s) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + GAP) {
      pairs.push([i - 1, null]);
      i--;
    } else {
      pairs.push([null, j - 1]);
      j--;
    }
  }
  while (i > 0) pairs.push([(i = i - 1), null]);
  while (j > 0) pairs.push([null, (j = j - 1)]);
  pairs.reverse();
  return pairs;
}

interface ParsedLine {
  text: string;
  tokenStart: number; // index into the flat token list
  tokenCount: number;
}

/**
 * Align pasted lyrics to timed transcript words. Returns one LyricLine per
 * non-empty row of `lyricsText`, with start/end taken from the matched timings.
 * Returns [] if there are no usable lyrics or no transcript words to time off.
 */
export function alignLyrics(
  lyricsText: string,
  words: TimedWord[],
): LyricLine[] {
  const timed = words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  if (timed.length === 0) return [];

  // Parse rows → lines, building a flat list of normalized tokens with a
  // back-pointer to their original text so we can regroup by line afterwards.
  const lines: ParsedLine[] = [];
  const flat: { norm: string; start?: number; end?: number }[] = [];
  for (const raw of lyricsText.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const toks = trimmed.split(/\s+/).map(normalize).filter(Boolean);
    const tokenStart = flat.length;
    for (const norm of toks) flat.push({ norm });
    // Keep the row even if it normalises to nothing (e.g. "..."); it just won't
    // contribute its own timing and will inherit neighbours.
    lines.push({ text: trimmed, tokenStart, tokenCount: toks.length });
  }
  if (lines.length === 0) return [];

  // Pair pasted tokens with transcript words by position in the sequence.
  const transcriptNorm = timed.map((w) => normalize(w.word));
  const pairs = needlemanWunsch(
    flat.map((f) => f.norm),
    transcriptNorm,
  );
  for (const [pIdx, tIdx] of pairs) {
    if (pIdx === null || tIdx === null) continue; // gap → no timing transfer
    flat[pIdx].start = timed[tIdx].start;
    flat[pIdx].end = timed[tIdx].end;
  }

  // Each line's anchor comes ONLY from words that genuinely matched the
  // transcript. Lines with at least one match are "fixed" at that time; lines
  // that matched nothing become gaps, spread evenly between their fixed
  // neighbours below so they never collapse onto a single shared timestamp.
  const songEnd = timed[timed.length - 1].end;
  const out = lines.map((line) => {
    const slice = flat.slice(line.tokenStart, line.tokenStart + line.tokenCount);
    const starts = slice.map((t) => t.start).filter((v): v is number => v != null);
    const ends = slice.map((t) => t.end).filter((v): v is number => v != null);
    return starts.length > 0 && ends.length > 0
      ? { text: line.text, start: Math.min(...starts), end: Math.max(...ends), fixed: true }
      : { text: line.text, start: NaN, end: NaN, fixed: false };
  });

  spreadGapLines(out, songEnd);
  finalizeTiming(out, songEnd);
  return out.map(({ text, start, end }) => ({ text, start, end }));
}

/**
 * Give every line that matched no transcript word a distinct time, spread
 * evenly between the matched ("fixed") lines that bracket it — so unmatched
 * runs never stack onto one timestamp. If nothing matched at all, spread every
 * line evenly across the song.
 */
function spreadGapLines(
  out: { start: number; end: number; fixed: boolean }[],
  songEnd: number,
): void {
  const n = out.length;
  const fixed = out.map((o, i) => (o.fixed ? i : -1)).filter((i) => i >= 0);
  if (fixed.length === 0) {
    for (let i = 0; i < n; i++) out[i].start = (i / n) * songEnd;
    return;
  }
  // Each gap run lies between two anchors; use virtual bounds (song start
  // before the first anchor, song end after the last) for the edge runs.
  const bounds = [-1, ...fixed, n];
  for (let b = 0; b < bounds.length - 1; b++) {
    const from = bounds[b] + 1;
    const to = bounds[b + 1] - 1;
    if (from > to) continue;
    const loTime = bounds[b] >= 0 ? out[bounds[b]].start : 0;
    const hiTime = bounds[b + 1] < n ? out[bounds[b + 1]].start : songEnd;
    const count = to - from + 1;
    for (let k = from; k <= to; k++) {
      const f = (k - from + 1) / (count + 1);
      out[k].start = loTime + (hiTime - loTime) * f;
    }
  }
}

/**
 * Keep starts non-decreasing and give each line an end that reaches — but never
 * overruns — the next line's start (the renderer hard-cuts between lines).
 */
function finalizeTiming(
  out: { start: number; end: number }[],
  songEnd: number,
): void {
  const n = out.length;
  for (let i = 1; i < n; i++) {
    if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].start;
  }
  for (let i = 0; i < n; i++) {
    const nextStart = i + 1 < n ? out[i + 1].start : songEnd;
    let end = Number.isFinite(out[i].end) ? out[i].end : nextStart;
    end = Math.max(end, out[i].start);
    out[i].end = Math.min(end, Math.max(nextStart, out[i].start));
  }
}
