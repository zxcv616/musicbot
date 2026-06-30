import { describe, it, expect } from "vitest";
import { alignLyrics, wordsToLines, type TimedWord } from "./lyricAlign";

/** Build evenly-spaced timed words, one per token, starting at t=0. */
function words(...tokens: string[]): TimedWord[] {
  return tokens.map((word, i) => ({ word, start: i, end: i + 0.5 }));
}

describe("alignLyrics", () => {
  it("returns one line per non-empty row", () => {
    const lyrics = "hello world\nsecond line";
    const transcript = words("hello", "world", "second", "line");
    const lines = alignLyrics(lyrics, transcript);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("hello world");
    expect(lines[1].text).toBe("second line");
  });

  it("times each line from the matched transcript words", () => {
    const lyrics = "hello world\nsecond line";
    const transcript = words("hello", "world", "second", "line");
    const lines = alignLyrics(lyrics, transcript);
    expect(lines[0].start).toBe(0); // "hello" starts at 0
    expect(lines[0].end).toBe(1.5); // "world" ends at 1.5
    expect(lines[1].start).toBe(2); // "second" starts at 2
    expect(lines[1].end).toBe(3.5); // "line" ends at 3.5
  });

  it("keeps the artist's words even when the transcript misheard them", () => {
    // Transcript mishears "purple haze" as "people days" but timing is right.
    const lyrics = "purple haze";
    const transcript = words("people", "days");
    const lines = alignLyrics(lyrics, transcript);
    expect(lines[0].text).toBe("purple haze"); // correct words preserved
    expect(lines[0].start).toBe(0); // timing borrowed from transcript
    expect(lines[0].end).toBe(1.5);
  });

  it("ignores punctuation and case when matching", () => {
    const lyrics = "Hello, World!";
    const transcript = words("hello", "world");
    const lines = alignLyrics(lyrics, transcript);
    expect(lines[0].start).toBe(0);
    expect(lines[0].end).toBe(1.5);
  });

  it("interpolates timing for words the transcript dropped", () => {
    // Transcript missed the middle word "brave"; it should be interpolated.
    const lyrics = "stay brave now";
    const transcript: TimedWord[] = [
      { word: "stay", start: 0, end: 1 },
      { word: "now", start: 4, end: 5 },
    ];
    const lines = alignLyrics(lyrics, transcript);
    expect(lines[0].start).toBe(0);
    expect(lines[0].end).toBe(5);
  });

  it("spreads unmatched lines instead of stacking them on one timestamp", () => {
    // The model only heard the first and last words; the two middle lines
    // matched nothing. They must get distinct, increasing times — not collapse
    // onto a single shared timestamp.
    const lyrics = "alpha\nbravo\ncharlie\ndelta";
    const transcript: TimedWord[] = [
      { word: "alpha", start: 0, end: 1 },
      { word: "delta", start: 9, end: 10 },
    ];
    const lines = alignLyrics(lyrics, transcript);
    expect(lines).toHaveLength(4);
    expect(lines[1].start).toBeGreaterThan(lines[0].start);
    expect(lines[2].start).toBeGreaterThan(lines[1].start);
    expect(lines[3].start).toBeGreaterThan(lines[2].start);
    // bravo and charlie must not share a timestamp
    expect(lines[1].start).not.toBeCloseTo(lines[2].start, 3);
  });

  it("does not let a line's end overrun the next line's start", () => {
    const lyrics = "one two\nthree four";
    const transcript = words("one", "two", "three", "four");
    const lines = alignLyrics(lyrics, transcript);
    expect(lines[0].end).toBeLessThanOrEqual(lines[1].start);
  });

  it("keeps line starts non-decreasing", () => {
    const lyrics = "one two\nthree four\nfive six";
    const transcript = words("one", "two", "three", "four", "five", "six");
    const lines = alignLyrics(lyrics, transcript);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].start).toBeGreaterThanOrEqual(lines[i - 1].start);
    }
  });

  it("returns [] when there are no transcript words to time off", () => {
    expect(alignLyrics("hello world", [])).toEqual([]);
  });

  it("returns [] for empty lyrics", () => {
    expect(alignLyrics("   \n  ", words("hello"))).toEqual([]);
  });
});

describe("wordsToLines (auto-transcribe)", () => {
  it("breaks a new line on a sung pause", () => {
    const transcript: TimedWord[] = [
      { word: "hello", start: 0, end: 0.4 },
      { word: "world", start: 0.5, end: 0.9 },
      // ~1.5s gap → new line
      { word: "second", start: 2.4, end: 2.8 },
      { word: "line", start: 2.9, end: 3.3 },
    ];
    const lines = wordsToLines(transcript);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("hello world");
    expect(lines[1].text).toBe("second line");
    expect(lines[0].start).toBe(0);
    expect(lines[1].end).toBe(3.3);
  });

  it("caps very long phrases at maxWords", () => {
    const transcript = "a b c d e f g h i j".split(" ").map((w, i) => ({
      word: w,
      start: i * 0.1,
      end: i * 0.1 + 0.05,
    }));
    const lines = wordsToLines(transcript, { maxWords: 4 });
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(l.text.split(" ").length).toBeLessThanOrEqual(4);
    }
  });

  it("returns [] when there are no words", () => {
    expect(wordsToLines([])).toEqual([]);
  });
});
