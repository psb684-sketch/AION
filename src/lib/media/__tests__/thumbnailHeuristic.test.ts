import { describe, it, expect } from "vitest";
import { computeThumbnailSeekTime } from "../thumbnailHeuristic";

describe("computeThumbnailSeekTime", () => {
  it("floors short videos at 1.0s", () => {
    expect(computeThumbnailSeekTime(5)).toBe(1.0);   // 5 × 0.15 = 0.75 → floor
    expect(computeThumbnailSeekTime(2)).toBe(1.0);   // 2 × 0.15 = 0.30 → floor
    expect(computeThumbnailSeekTime(6.67)).toBeCloseTo(1.0, 2); // 6.67 × 0.15 = 1.0
  });

  it("uses 15% for mid-length videos", () => {
    expect(computeThumbnailSeekTime(20)).toBe(3.0);    // 20 × 0.15 = 3.0
    expect(computeThumbnailSeekTime(60)).toBe(9.0);    // 1 min → 9s
    expect(computeThumbnailSeekTime(120)).toBe(18.0);  // 2 min → 18s
  });

  it("caps long videos at 30.0s", () => {
    expect(computeThumbnailSeekTime(200)).toBe(30.0);  // 200 × 0.15 = 30
    expect(computeThumbnailSeekTime(3600)).toBe(30.0); // 1 hr → cap
    expect(computeThumbnailSeekTime(600)).toBe(30.0);  // 10 min → 90s, capped
  });
});
