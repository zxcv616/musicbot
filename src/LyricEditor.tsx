import { useState } from "react";
import type { LyricLine } from "./renderer/moodRenderer";
import { round2, clampStart, sortLines } from "./utils/lyricTiming";

/** A lyric line with a stable id so React can track it across edits. */
export interface EditableLine extends LyricLine {
  id: string;
}

interface LyricEditorProps {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  onPlayFrom: (seconds: number) => void;
  /** Used to slot a newly added line at the current playback position. */
  audioRef?: React.RefObject<HTMLAudioElement | null>;
}

const NUDGE = 0.1; // seconds per nudge

/**
 * Lyric/timing editor. Edit text, type a start time directly, capture the
 * current playback time per line, nudge fine-adjust, split/merge lines, add
 * new lines from scratch, and "play from here" to check sync. Lines stay
 * sorted by start time after every mutation.
 */
export function LyricEditor({
  lines,
  onChange,
  onPlayFrom,
  audioRef,
}: LyricEditorProps) {
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const sorted = (ls: EditableLine[]) => sortLines(ls) as EditableLine[];

  function setText(id: string, text: string) {
    // Text changes don't affect sort order.
    onChange(lines.map((l) => (l.id === id ? { ...l, text } : l)));
  }

  function setStart(id: string, value: number) {
    onChange(
      sorted(
        lines.map((l) =>
          l.id === id ? { ...l, start: clampStart(value) } : l,
        ),
      ),
    );
  }

  function captureTime(id: string) {
    const t = audioRef?.current?.currentTime;
    if (t === undefined || !Number.isFinite(t)) return;
    setStart(id, t);
  }

  function nudge(id: string, delta: number) {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    setStart(id, round2(line.start + delta));
  }

  function merge(id: string) {
    const i = lines.findIndex((l) => l.id === id);
    if (i < 0 || i >= lines.length - 1) return;
    const a = lines[i];
    const b = lines[i + 1];
    const merged: EditableLine = {
      ...a,
      text: `${a.text} ${b.text}`.replace(/\s+/g, " ").trim(),
      end: b.end,
    };
    onChange(sorted([...lines.slice(0, i), merged, ...lines.slice(i + 2)]));
  }

  function split(id: string) {
    const i = lines.findIndex((l) => l.id === id);
    if (i < 0) return;
    const l = lines[i];
    const words = l.text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return;
    const mid = Math.ceil(words.length / 2);
    const midTime = round2(l.end > l.start ? (l.start + l.end) / 2 : l.start + 0.5);
    const first: EditableLine = {
      ...l,
      text: words.slice(0, mid).join(" "),
      end: midTime,
    };
    const second: EditableLine = {
      id: crypto.randomUUID(),
      text: words.slice(mid).join(" "),
      start: midTime,
      end: l.end,
    };
    onChange(sorted([...lines.slice(0, i), first, second, ...lines.slice(i + 1)]));
  }

  function addLine() {
    const playhead = audioRef?.current?.currentTime;
    const fallback = lines.length > 0 ? lines[lines.length - 1].end : 0;
    const start = clampStart(
      playhead !== undefined && Number.isFinite(playhead) && playhead > 0
        ? playhead
        : fallback,
    );
    const line: EditableLine = {
      id: crypto.randomUUID(),
      text: "",
      start,
      end: start + 2,
    };
    setJustAddedId(line.id);
    onChange(sorted([...lines, line]));
  }

  return (
    <section className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-neutral-300">Lyrics &amp; timing</h2>
        <button
          onClick={addLine}
          title="Add a new lyric line at the current playback position"
          className="rounded bg-neutral-100 text-neutral-900 px-2.5 py-1 text-xs font-medium hover:bg-white"
        >
          + Add line
        </button>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {lines.length === 0 && (
          <p className="text-sm text-neutral-600 m-auto text-center px-4">
            No lines yet. Press play, then "Add line" at each lyric and type it in.
          </p>
        )}
        {lines.map((line, i) => (
          <div
            key={line.id}
            className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2"
          >
            <div className="flex items-center gap-1 flex-wrap">
              {/* Play from here */}
              <button
                onClick={() => onPlayFrom(line.start)}
                title="Play from here"
                className="rounded bg-neutral-100 text-neutral-900 px-2 py-1 text-xs font-medium hover:bg-white"
              >
                ▶
              </button>

              {/* Nudge earlier */}
              <button
                onClick={() => nudge(line.id, -NUDGE)}
                title="Start 0.1s earlier"
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                −
              </button>

              {/* Direct start-time input */}
              <input
                type="number"
                value={line.start}
                step="0.01"
                min="0"
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  if (Number.isFinite(v) && v >= 0) setStart(line.id, v);
                }}
                title="Start time in seconds — type a value directly"
                className="w-16 rounded bg-neutral-950 border border-neutral-700 px-1 py-0.5 text-xs tabular-nums text-neutral-300 text-center focus:border-neutral-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xs text-neutral-500">s</span>

              {/* Nudge later */}
              <button
                onClick={() => nudge(line.id, NUDGE)}
                title="Start 0.1s later"
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                +
              </button>

              {/* Capture current playback time */}
              <button
                onClick={() => captureTime(line.id)}
                title="Set start to current playback time"
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                now
              </button>

              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => split(line.id)}
                  title="Split this line in two"
                  className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                >
                  split
                </button>
                <button
                  onClick={() => merge(line.id)}
                  disabled={i >= lines.length - 1}
                  title="Merge with next line"
                  className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  merge
                </button>
              </div>
            </div>
            <input
              type="text"
              value={line.text}
              autoFocus={line.id === justAddedId}
              placeholder="lyric text…"
              onChange={(e) => setText(line.id, e.target.value)}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
