// Types + client for the local Whisper transcription backend (Milestone 1).

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
