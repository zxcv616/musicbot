import { describe, it, expect } from "vitest";
import { serializeLyrics, parseLyricsFile } from "./lyricFile";
import type { LyricLine } from "../renderer/moodRenderer";

const sample: LyricLine[] = [
  { text: "and now im pouring", start: 1.2, end: 3.4 },
  { text: "it's hard with", start: 3.5, end: 5.0 },
];

describe("lyric file round trip", () => {
  it("serializes then parses back to the same lines", () => {
    const parsed = parseLyricsFile(serializeLyrics(sample));
    expect(parsed).toEqual(sample);
  });

  it("writes a format tag and version", () => {
    const obj = JSON.parse(serializeLyrics(sample));
    expect(obj.format).toBe("lyric-video-lyrics");
    expect(obj.version).toBe(1);
    expect(obj.lines).toHaveLength(2);
  });
});

describe("parseLyricsFile", () => {
  it("sorts loaded lines by start time", () => {
    const json = JSON.stringify({
      format: "lyric-video-lyrics",
      version: 1,
      lines: [
        { text: "second", start: 5, end: 6 },
        { text: "first", start: 1, end: 2 },
      ],
    });
    const parsed = parseLyricsFile(json);
    expect(parsed.map((l) => l.text)).toEqual(["first", "second"]);
  });

  it("skips malformed lines but keeps the valid ones", () => {
    const json = JSON.stringify({
      format: "lyric-video-lyrics",
      version: 1,
      lines: [
        { text: "good", start: 0, end: 1 },
        { text: "no timing" },
        { start: 2, end: 3 }, // missing text → text defaults to ""
        null,
      ],
    });
    const parsed = parseLyricsFile(json);
    expect(parsed).toEqual([
      { text: "good", start: 0, end: 1 },
      { text: "", start: 2, end: 3 },
    ]);
  });

  it("rejects non-JSON", () => {
    expect(() => parseLyricsFile("not json at all")).toThrow();
  });

  it("rejects a JSON file that isn't a lyrics file", () => {
    expect(() => parseLyricsFile(JSON.stringify({ hello: "world" }))).toThrow();
  });

  it("rejects a lyrics file with no usable lines", () => {
    const json = JSON.stringify({
      format: "lyric-video-lyrics",
      version: 1,
      lines: [{ text: "no timing" }],
    });
    expect(() => parseLyricsFile(json)).toThrow();
  });
});
