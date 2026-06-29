import { describe, it, expect } from "vitest";
import { parseFlag } from "./featureFlags";

describe("parseFlag", () => {
  it("returns true for the exact string 'true'", () => {
    expect(parseFlag("true")).toBe(true);
  });

  it("returns false when undefined (var not set)", () => {
    expect(parseFlag(undefined)).toBe(false);
  });

  it("returns false for common truthy-looking strings that aren't 'true'", () => {
    expect(parseFlag("1")).toBe(false);
    expect(parseFlag("yes")).toBe(false);
    expect(parseFlag("True")).toBe(false);
    expect(parseFlag("TRUE")).toBe(false);
    expect(parseFlag("on")).toBe(false);
  });

  it("returns false for falsy strings", () => {
    expect(parseFlag("false")).toBe(false);
    expect(parseFlag("0")).toBe(false);
    expect(parseFlag("")).toBe(false);
  });
});
