import { describe, it, expect } from "vitest";
import { round2, clampStart, sortLines } from "./lyricTiming";

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
