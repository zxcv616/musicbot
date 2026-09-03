import { describe, it, expect } from "vitest";
import { MoodRenderer } from "./moodRenderer";
import { MOOD } from "../presets/mood-preset";

describe("getSchedule", () => {
  it("even-spreads each image once when no photo interval is set", () => {
    const r = new MoodRenderer(MOOD);
    const s = r.getSchedule(3, 30, []);
    expect(s).toHaveLength(3);
    expect(s.map((e) => e.mediaIndex)).toEqual([0, 1, 2]);
    expect(s[0].start).toBe(0);
    expect(s[2].end).toBe(30);
  });

  it("cycles through photos at a fixed interval, looping to fill the song", () => {
    const r = new MoodRenderer(MOOD);
    r.preset = { ...MOOD, photoIntervalSeconds: 5 };
    const s = r.getSchedule(3, 22, []);
    expect(s).toHaveLength(5); // ceil(22 / 5)
    expect(s.map((e) => e.mediaIndex)).toEqual([0, 1, 2, 0, 1]); // wraps at 3
    expect(s.map((e) => e.start)).toEqual([0, 5, 10, 15, 20]);
    expect(s[4].end).toBe(22); // last slot clamps to the song end
  });

  it("faster interval = more, shorter slots (higher change rate)", () => {
    const r = new MoodRenderer(MOOD);
    r.preset = { ...MOOD, photoIntervalSeconds: 3 };
    const fast = r.getSchedule(2, 30, []);
    r.preset = { ...MOOD, photoIntervalSeconds: 6 };
    const slow = r.getSchedule(2, 30, []);
    expect(fast.length).toBeGreaterThan(slow.length);
  });

  it("returns a single infinite slot for one image", () => {
    const r = new MoodRenderer(MOOD);
    r.preset = { ...MOOD, photoIntervalSeconds: 5 };
    const s = r.getSchedule(1, 30, []);
    expect(s).toHaveLength(1);
    expect(s[0].mediaIndex).toBe(0);
  });
});
