import type { LyricLine } from "./renderer/moodRenderer";

/** A lyric line with a stable id so React can track it across edits. */
export interface EditableLine extends LyricLine {
  id: string;
}

interface LyricEditorProps {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  onPlayFrom: (seconds: number) => void;
}

const NUDGE = 0.1; // seconds per nudge

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Minimal-but-real lyric/timing editor (Milestone 5). Edit text, nudge a line's
 * start time earlier/later, split a line in two, merge a line into the next, and
 * "play from here" to check sync. Lines are kept sorted by start time.
 */
export function LyricEditor({ lines, onChange, onPlayFrom }: LyricEditorProps) {
  const sortStart = (ls: EditableLine[]) =>
    [...ls].sort((a, b) => a.start - b.start);

  function setText(id: string, text: string) {
    onChange(lines.map((l) => (l.id === id ? { ...l, text } : l)));
  }

  function nudge(id: string, delta: number) {
    onChange(
      sortStart(
        lines.map((l) =>
          l.id === id ? { ...l, start: round2(Math.max(0, l.start + delta)) } : l,
        ),
      ),
    );
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
    onChange([...lines.slice(0, i), merged, ...lines.slice(i + 2)]);
  }

  function split(id: string) {
    const i = lines.findIndex((l) => l.id === id);
    if (i < 0) return;
    const l = lines[i];
    const words = l.text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return; // nothing meaningful to split
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
    onChange([...lines.slice(0, i), first, second, ...lines.slice(i + 1)]);
  }

  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 h-full min-h-0">
      <h2 className="text-sm font-medium text-neutral-300 shrink-0">
        Lyrics &amp; timing
      </h2>
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <div
            key={line.id}
            className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2"
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPlayFrom(line.start)}
                title="Play from here"
                className="rounded bg-neutral-100 text-neutral-900 px-2 py-1 text-xs font-medium hover:bg-white"
              >
                ▶
              </button>
              <button
                onClick={() => nudge(line.id, -NUDGE)}
                title="Start earlier"
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                −
              </button>
              <span className="text-xs tabular-nums text-neutral-400 w-14 text-center">
                {line.start.toFixed(2)}s
              </span>
              <button
                onClick={() => nudge(line.id, NUDGE)}
                title="Start later"
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                +
              </button>
              <div className="ml-auto flex gap-1.5">
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
                  merge ↓
                </button>
              </div>
            </div>
            <input
              type="text"
              value={line.text}
              onChange={(e) => setText(line.id, e.target.value)}
              className="w-full rounded bg-neutral-950 border border-neutral-800 px-2 py-1.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
