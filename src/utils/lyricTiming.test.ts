import { describe, it, expect } from "vitest";
import { round2, clampStart, sortLines, type TimingLine } from "./lyricTiming";

describe("round2", () => {
  it("leaves already-rounded values unchanged", () => {
    expect(round2(0)).toBe(0);
    expect(round2(47.2)).toBe(47.2);
    expect(round2(1.23)).toBe(1.23);
  });

  it("rounds to 2 decimal places", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.236)).toBe(1.24);
    expect(round2(0.005)).toBe(0.01);
  });

  it("handles large values", () => {
    expect(round2(360.999)).toBe(361);
  });
});

describe("clampStart", () => {
  it("passes through non-negative values", () => {
    expect(clampStart(0)).toBe(0);
    expect(clampStart(5.5)).toBe(5.5);
    expect(clampStart(120)).toBe(120);
  });

  it("clamps negative values to 0", () => {
    expect(clampStart(-1)).toBe(0);
    expect(clampStart(-0.1)).toBe(0);
  });

  it("rounds while clamping", () => {
    expect(clampStart(3.456)).toBe(3.46);
    expect(clampStart(-0.001)).toBe(0);
  });
});

describe("sortLines", () => {
  it("returns sorted copy; does not mutate input", () => {
    const lines = [
      { id: "c", start: 3 },
      { id: "a", start: 1 },
      { id: "b", start: 2 },
    ];
    const sorted = sortLines(lines);
    expect(sorted.map((l) => l.id)).toEqual(["a", "b", "c"]);
    // original unchanged
    expect(lines[0].id).toBe("c");
  });

  it("handles already-sorted input", () => {
    const lines = [{ id: "x", start: 0 }, { id: "y", start: 5 }];
    expect(sortLines(lines).map((l) => l.id)).toEqual(["x", "y"]);
  });

  it("handles single item", () => {
    expect(sortLines([{ id: "z", start: 42 }])).toHaveLength(1);
  });

  it("handles empty array", () => {
    expect(sortLines([])).toEqual([]);
  });

  it("preserves all fields on each item", () => {
    const lines = [
      { id: "b", start: 2, end: 3, text: "second" },
      { id: "a", start: 1, end: 2, text: "first" },
    ];
    const sorted = sortLines(lines);
    expect(sorted[0]).toEqual({ id: "a", start: 1, end: 2, text: "first" });
    expect(sorted[1]).toEqual({ id: "b", start: 2, end: 3, text: "second" });
  });
});

// Verify the sort invariant holds after simulating editor mutations.
describe("sort invariant after editor operations", () => {
  function makeLine(id: string, start: number, end: number): TimingLine & { end: number } {
    return { id, start, end };
  }

  it("remains sorted after changing a start time that moves a line earlier", () => {
    const lines = [
      makeLine("a", 0, 1),
      makeLine("b", 2, 3),
      makeLine("c", 5, 6),
    ];
    // Simulate setStart("c", 1.5) — moves c before b
    const updated = lines.map((l) =>
      l.id === "c" ? { ...l, start: clampStart(1.5) } : l,
    );
    const result = sortLines(updated);
    expect(result.map((l) => l.id)).toEqual(["a", "c", "b"]);
  });

  it("remains sorted after setting start to 0 (clampStart floor)", () => {
    const lines = [makeLine("a", 1, 2), makeLine("b", 3, 4)];
    const updated = lines.map((l) =>
      l.id === "b" ? { ...l, start: clampStart(-5) } : l,
    );
    const result = sortLines(updated);
    expect(result.map((l) => l.id)).toEqual(["b", "a"]);
    expect(result[0].start).toBe(0);
  });

  it("remains sorted after a split (midTime between start and end)", () => {
    const original = makeLine("x", 4, 6);
    const midTime = round2((original.start + original.end) / 2); // 5
    const first = { ...original, end: midTime };
    const second = { id: "y", start: midTime, end: original.end };
    const result = sortLines([second, first]); // intentionally reversed input
    expect(result.map((l) => l.id)).toEqual(["x", "y"]);
    expect(result[0].start).toBe(4);
    expect(result[1].start).toBe(5);
  });

  it("remains sorted when adding a line at the start of the song", () => {
    const existing = [makeLine("b", 3, 4), makeLine("c", 7, 8)];
    const newLine = makeLine("a", 0, 2);
    const result = sortLines([...existing, newLine]);
    expect(result.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("handles ties in start time without throwing", () => {
    const lines = [
      makeLine("a", 2, 3),
      makeLine("b", 2, 4), // same start as a
    ];
    const result = sortLines(lines);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(2);
    expect(result[1].start).toBe(2);
  });
});
