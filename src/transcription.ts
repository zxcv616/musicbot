// Types + client for the local Whisper transcription backend (Milestone 1).

import type { LyricLine } from "./renderer/moodRenderer";

export interface Word {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface TranscriptionResult {
  engine: string;
  model: string;
  language: string;
  duration: number;
  segments: Segment[];
}

/**
 * Turn transcription segments into lyric lines for the renderer. Line timing is
 * taken from the first/last word-level timestamps (falling back to the segment
 * bounds), so display sync is driven by the word timings.
 */
export function segmentsToLines(result: TranscriptionResult): LyricLine[] {
  return result.segments
    .map((seg) => {
      const start = seg.words[0]?.start ?? seg.start;
      const end = seg.words[seg.words.length - 1]?.end ?? seg.end;
      return { text: seg.text, start, end };
    })
    .filter((line) => line.text.length > 0);
}

export async function transcribe(file: File): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new Error(detail);
  }
  return (await res.json()) as TranscriptionResult;
}
