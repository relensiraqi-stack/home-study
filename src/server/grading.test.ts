import { describe, expect, it } from "vitest";
import {
  formatTime,
  overlaps,
  parseTime,
  sameAnswer,
  scorePercent,
  starsFor,
} from "./grading";

describe("grading", () => {
  it("matches answers loosely", () => {
    expect(sameAnswer("  2/5 ", "2/5")).toBe(true);
    expect(sameAnswer("Roots", "roots")).toBe(true);
    expect(sameAnswer("", "")).toBe(false);
    expect(sameAnswer("3/8", "3/4")).toBe(false);
  });

  it("gives stars at 90, 70 and 50 percent", () => {
    expect(starsFor(100)).toBe(3);
    expect(starsFor(90)).toBe(3);
    expect(starsFor(89)).toBe(2);
    expect(starsFor(70)).toBe(2);
    expect(starsFor(69)).toBe(1);
    expect(starsFor(50)).toBe(1);
    expect(starsFor(49)).toBe(0);
    expect(scorePercent(2, 3)).toBe(67);
    expect(scorePercent(0, 0)).toBe(0);
  });
});

describe("schedule", () => {
  it("finds overlapping slots on the same day only", () => {
    const a = { weekday: 1, startMinute: 960, minutes: 45 };
    expect(overlaps(a, { weekday: 1, startMinute: 990, minutes: 30 })).toBe(true);
    expect(overlaps(a, { weekday: 1, startMinute: 1005, minutes: 30 })).toBe(false);
    expect(overlaps(a, { weekday: 2, startMinute: 960, minutes: 45 })).toBe(false);
    expect(overlaps(a, { weekday: 1, startMinute: 900, minutes: 60 })).toBe(false);
    expect(overlaps(a, { weekday: 1, startMinute: 900, minutes: 61 })).toBe(true);
  });

  it("reads and writes times of day", () => {
    expect(parseTime("16:05")).toBe(965);
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("noon")).toBeNull();
    expect(formatTime(965)).toBe("16:05");
  });
});
