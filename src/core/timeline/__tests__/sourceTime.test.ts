/**
 * Source Time Resolution Tests
 *
 * Tests sourceTime calculation and clamping to prevent black frames
 * when scrubbing split clips.
 */

import { describe, it, expect } from "vitest";
import { resolveClipSourceTime } from "../sourceTime";

describe("resolveClipSourceTime", () => {
  describe("basic sourceTime calculation", () => {
    it("calculates sourceTime from timeline time", () => {
      const clip = {
        startTime: 10,
        duration: 5,
        trimIn: 2,
        trimOut: 7,
      };

      // At timeline time 12 (2s into clip)
      const result = resolveClipSourceTime(clip, 12);
      expect(result.sourceTime).toBe(4); // trimIn (2) + localTime (2)
      expect(result.localTime).toBe(2);
      expect(result.active).toBe(true);
    });

    it("marks clip inactive when outside time bounds", () => {
      const clip = {
        startTime: 10,
        duration: 5,
        trimIn: 2,
        trimOut: 7,
      };

      const before = resolveClipSourceTime(clip, 9);
      expect(before.active).toBe(false);

      const after = resolveClipSourceTime(clip, 16);
      expect(after.active).toBe(false);
    });
  });

  describe("clamping with frameRate (bug fix)", () => {
    it("clamps sourceTime to trimOut - frameTime", () => {
      const clip = {
        startTime: 36.94,
        duration: 2.0,
        trimIn: 36.94,
        trimOut: 38.94,
      };

      // Timeline time at the very end of clip
      const result = resolveClipSourceTime(clip, 38.93, {
        clampToRange: true,
        frameRate: 30,
      });

      // Should clamp to trimOut - (1/30)
      const expectedMax = 38.94 - 1 / 30;
      expect(result.sourceTime).toBeLessThanOrEqual(expectedMax);
      expect(result.sourceTime).toBeCloseTo(expectedMax, 4);
    });

    it("prevents seeking past trimOut (black frame bug)", () => {
      const clip = {
        startTime: 36.94,
        duration: 2.0,
        trimIn: 36.94,
        trimOut: 38.94,
      };

      // Playhead at 39s (past clip end) - this caused black frames
      const result = resolveClipSourceTime(clip, 39.0, {
        clampToRange: true,
        frameRate: 30,
      });

      // Should never exceed trimOut
      expect(result.sourceTime).toBeLessThan(clip.trimOut);
    });

    it("handles undefined trimOut gracefully", () => {
      const clip = {
        startTime: 10,
        duration: 5,
        trimIn: 2,
        trimOut: undefined as any, // Simulate bad split
      };

      // Should fallback to trimIn + duration
      const result = resolveClipSourceTime(clip, 14, {
        clampToRange: true,
        frameRate: 30,
      });

      const expectedTrimOut = 2 + 5; // trimIn + duration
      expect(result.sourceTime).toBeLessThan(expectedTrimOut);
    });
  });

  describe("split clip coherence", () => {
    it("maintains coherence between left and right clips", () => {
      // Original clip split into 3 pieces at 30fps
      const originalClip = {
        startTime: 0,
        duration: 10,
        trimIn: 0,
        trimOut: 10,
      };

      // Split at 3.33s (frame boundary) and 6.67s (frame boundary)
      const leftClip = {
        startTime: 0,
        duration: 3.33,
        trimIn: 0,
        trimOut: 3.33,
      };

      const middleClip = {
        startTime: 3.33,
        duration: 3.34,
        trimIn: 3.33,
        trimOut: 6.67,
      };

      const rightClip = {
        startTime: 6.67,
        duration: 3.33,
        trimIn: 6.67,
        trimOut: 10,
      };

      // Verify coherence: rightClip.trimIn === leftClip.trimOut
      expect(middleClip.trimIn).toBe(leftClip.trimOut);
      expect(rightClip.trimIn).toBe(middleClip.trimOut);

      // Verify last frame of left matches first frame of middle
      const leftLastFrame = resolveClipSourceTime(leftClip, 3.33, {
        clampToRange: true,
        frameRate: 30,
      });
      const middleFirstFrame = resolveClipSourceTime(middleClip, 3.33, {
        clampToRange: true,
        frameRate: 30,
      });

      // Should be very close (within one frame time)
      expect(Math.abs(leftLastFrame.sourceTime - middleFirstFrame.sourceTime)).toBeLessThan(1 / 30);
    });
  });

  describe("without clamping", () => {
    it("allows sourceTime to exceed trimOut", () => {
      const clip = {
        startTime: 10,
        duration: 5,
        trimIn: 2,
        trimOut: 7,
      };

      // Seek past clip end without clamping
      const result = resolveClipSourceTime(clip, 16);
      expect(result.sourceTime).toBe(8); // trimIn (2) + localTime (6)
      expect(result.sourceTime).toBeGreaterThan(clip.trimOut);
    });
  });

  describe("edge cases", () => {
    it("handles zero trimIn", () => {
      const clip = {
        startTime: 0,
        duration: 5,
        trimIn: 0,
        trimOut: 5,
      };

      const result = resolveClipSourceTime(clip, 2);
      expect(result.sourceTime).toBe(2);
    });

    it("handles clip at timeline start", () => {
      const clip = {
        startTime: 0,
        duration: 5,
        trimIn: 0,
        trimOut: 5,
      };

      const result = resolveClipSourceTime(clip, 0, {
        clampToRange: true,
        frameRate: 30,
      });
      expect(result.sourceTime).toBe(0);
      expect(result.active).toBe(true);
    });

    it("never returns negative sourceTime", () => {
      const clip = {
        startTime: 10,
        duration: 5,
        trimIn: 2,
        trimOut: 7,
      };

      // Timeline time before clip starts
      const result = resolveClipSourceTime(clip, 5);
      expect(result.sourceTime).toBeGreaterThanOrEqual(0);
    });

    it("handles very small durations", () => {
      const clip = {
        startTime: 10,
        duration: 0.033, // 1 frame at 30fps
        trimIn: 5,
        trimOut: 5.033,
      };

      const result = resolveClipSourceTime(clip, 10.016, {
        clampToRange: true,
        frameRate: 30,
      });

      expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn);
      expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut);
    });
  });
});
