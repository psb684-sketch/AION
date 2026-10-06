/**
 * Property-Based Tests for sourceTime Calculations
 *
 * Uses property-based testing to verify sourceTime calculation invariants
 * across a wide range of inputs. This catches edge cases that example-based
 * tests might miss.
 *
 * Properties tested:
 * 1. sourceTime is always within [trimIn, trimOut] when clamped
 * 2. sourceTime advances linearly with clockTime (no jumps)
 * 3. Playback speed multiplies time delta correctly
 * 4. Reversing twice returns to original position
 * 5. Frame boundaries align correctly
 */

import { describe, it, expect } from "vitest";
import { resolveClipSourceTime } from "../sourceTime";
import type { Clip } from "@/types";

// Simple property-based testing helpers (avoiding external dependency)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateClip(overrides: Partial<Clip> = {}): Clip {
  const trimIn = randomFloat(0, 10);
  const trimOut = trimIn + randomFloat(1, 100);
  const duration = trimOut - trimIn;

  return {
    id: `clip-${randomInt(1, 10000)}`,
    kind: "video",
    trackId: "track-1",
    mediaId: "media-1",
    startTime: randomFloat(0, 1000),
    duration,
    trimIn,
    trimOut,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    opacity: 1,
    rotation: 0,
    volume: 1,
    ...overrides,
  };
}

describe("sourceTime Property-Based Tests", () => {
  describe("Property: sourceTime is bounded by [trimIn, trimOut]", () => {
    it("should always return sourceTime within bounds when clamping enabled", () => {
      // Run 100 random test cases
      for (let i = 0; i < 100; i++) {
        const clip = generateClip();
        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate: 30,
        });

        expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn!);
        expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut!);
      }
    });

    it("should clamp to trimIn when clockTime is before clip start", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();
        const clockTime = clip.startTime - randomFloat(0.1, 100); // Before clip

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate: 30,
        });

        expect(result.sourceTime).toBe(clip.trimIn);
      }
    });

    it("should clamp to trimOut when clockTime is after clip end", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();
        const frameRate = 30;
        const clockTime =
          clip.startTime + clip.duration + randomFloat(0.1, 100); // After clip

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate,
        });

        // Should clamp to trimOut minus one frame (to stay before boundary)
        const frameTime = 1 / frameRate;
        const expectedMax = clip.trimOut - frameTime;
        expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut);
        expect(result.sourceTime).toBeGreaterThanOrEqual(expectedMax - 0.001); // Small tolerance
      }
    });
  });

  describe("Property: sourceTime advances linearly with clockTime", () => {
    it("should advance sourceTime proportionally to clockTime delta", () => {
      for (let i = 0; i < 100; i++) {
        const clip = generateClip(); // Normal playback (1:1 mapping)

        const t1 = clip.startTime + randomFloat(0, clip.duration * 0.5);
        const delta = randomFloat(0.1, clip.duration * 0.4);
        const t2 = t1 + delta;

        const result1 = resolveClipSourceTime(clip, t1, {
          clampToRange: true,
          frameRate: 30,
        });
        const result2 = resolveClipSourceTime(clip, t2, {
          clampToRange: true,
          frameRate: 30,
        });

        const sourceDelta = result2.sourceTime - result1.sourceTime;

        // Should advance by same amount (within floating point tolerance)
        expect(Math.abs(sourceDelta - delta)).toBeLessThan(0.001);
      }
    });

    it("should never have discontinuous jumps in sourceTime", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();

        // Sample at small increments
        const samples = 20;
        const increment = clip.duration / samples;
        let prevSourceTime = clip.trimIn!;

        for (let j = 0; j <= samples; j++) {
          const clockTime = clip.startTime + j * increment;
          const result = resolveClipSourceTime(clip, clockTime, {
            clampToRange: true,
            frameRate: 30,
          });

          // sourceTime should not jump backward (except at boundaries)
          if (j > 0 && result.sourceTime < clip.trimOut!) {
            const delta = result.sourceTime - prevSourceTime;
            expect(delta).toBeGreaterThanOrEqual(0);
            expect(delta).toBeLessThanOrEqual(increment * 1.1); // Allow 10% tolerance
          }

          prevSourceTime = result.sourceTime;
        }
      }
    });
  });

  describe("Property: Linear time mapping (no speed parameter)", () => {
    it("should maintain 1:1 time mapping (no speed multiplier in this implementation)", () => {
      // This codebase doesn't support per-clip playback speed
      // The resolveClipSourceTime function uses 1:1 time mapping
      for (let i = 0; i < 100; i++) {
        const clip = generateClip();

        const t1 = clip.startTime;
        const delta = randomFloat(1, clip.duration * 0.5);
        const t2 = t1 + delta;

        const result1 = resolveClipSourceTime(clip, t1, { frameRate: 30 });
        const result2 = resolveClipSourceTime(clip, t2, { frameRate: 30 });

        const sourceDelta = result2.sourceTime - result1.sourceTime;

        // Should advance by same amount (1:1 mapping)
        expect(Math.abs(sourceDelta - delta)).toBeLessThan(0.01);
      }
    });

    it("should maintain consistent time mapping across different durations", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip({ trimIn: 0, trimOut: 100 });

        const clockDelta = 10; // 10 seconds of clock time
        const t1 = clip.startTime;
        const t2 = clip.startTime + clockDelta;

        const result1 = resolveClipSourceTime(clip, t1, { frameRate: 30 });
        const result2 = resolveClipSourceTime(clip, t2, { frameRate: 30 });

        const sourceDelta = result2.sourceTime - result1.sourceTime;

        // 1:1 time mapping
        expect(Math.abs(sourceDelta - clockDelta)).toBeLessThan(0.1);
      }
    });

    it("should handle various clip positions consistently", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip({ trimIn: 0, trimOut: 100 });

        const clockDelta = 5; // 5 seconds of clock time
        const t1 = clip.startTime;
        const t2 = clip.startTime + clockDelta;

        const result1 = resolveClipSourceTime(clip, t1, { frameRate: 30 });
        const result2 = resolveClipSourceTime(clip, t2, { frameRate: 30 });

        const sourceDelta = result2.sourceTime - result1.sourceTime;

        // 1:1 time mapping
        expect(Math.abs(sourceDelta - clockDelta)).toBeLessThan(0.1);
      }
    });
  });

  describe("Property: Reversing operations are invertible", () => {
    it("should return to original when applying inverse operations", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();
        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result = resolveClipSourceTime(clip, clockTime, {
          frameRate: 30,
        });

        // Calculate clock time from source time (inverse operation with 1:1 mapping)
        const sourceLocalTime = result.sourceTime - clip.trimIn!;
        const calculatedClockTime = clip.startTime + sourceLocalTime;

        // Should get back to original clockTime (within tolerance)
        expect(Math.abs(calculatedClockTime - clockTime)).toBeLessThan(0.01);
      }
    });
  });

  describe("Property: Frame boundaries align correctly", () => {
    it("should calculate frame-aligned positions consistently", () => {
      // resolveClipSourceTime doesn't snap to frames internally,
      // but frameRate is used for other calculations (like clamping)
      const frameRates = [24, 30, 60];

      for (const frameRate of frameRates) {
        for (let i = 0; i < 50; i++) {
          const clip = generateClip();
          const clockTime = clip.startTime + randomFloat(0, clip.duration);

          const result = resolveClipSourceTime(clip, clockTime, {
            frameRate,
            clampToRange: true,
          });

          // Result should be valid sourceTime within bounds
          expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn!);
          expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut!);
        }
      }
    });

    it("should maintain frame count consistency", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();
        const frameRate = 30;
        const frameDuration = 1 / frameRate;

        // Count frames across entire clip
        let frameCount = 0;
        for (
          let t = clip.startTime;
          t < clip.startTime + clip.duration;
          t += frameDuration
        ) {
          const result = resolveClipSourceTime(clip, t, {
            frameRate,
            clampToRange: true,
          });

          if (
            result.sourceTime >= clip.trimIn! &&
            result.sourceTime <= clip.trimOut!
          ) {
            frameCount++;
          }
        }

        // Expected frame count
        const expectedFrames = Math.floor(clip.duration * frameRate);

        // Should be close (within 1 frame tolerance for rounding)
        expect(Math.abs(frameCount - expectedFrames)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Property: Edge cases don't crash", () => {
    it("should handle zero-duration clips gracefully", () => {
      const clip = generateClip({ duration: 0, trimIn: 5, trimOut: 5 });
      const result = resolveClipSourceTime(clip, clip.startTime, {
        clampToRange: true,
        frameRate: 30,
      });

      expect(result.sourceTime).toBe(clip.trimIn);
    });

    it("should handle clips with large durations", () => {
      for (let i = 0; i < 20; i++) {
        const trimIn = randomFloat(0, 10);
        const trimOut = trimIn + randomFloat(100, 1000); // Large duration
        const clip = generateClip({
          trimIn,
          trimOut,
          duration: trimOut - trimIn,
        });
        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate: 30,
        });

        // Should still be bounded
        expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn!);
        expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut!);
      }
    });

    it("should handle clips with small durations", () => {
      for (let i = 0; i < 20; i++) {
        const trimIn = randomFloat(0, 10);
        const trimOut = trimIn + randomFloat(0.1, 1); // Small duration
        const clip = generateClip({
          trimIn,
          trimOut,
          duration: trimOut - trimIn,
        });
        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate: 30,
        });

        // Should still be bounded
        expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn!);
        expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut!);
      }
    });

    it("should handle very large time values", () => {
      for (let i = 0; i < 20; i++) {
        const clip = generateClip({
          startTime: randomFloat(0, 1000000), // Large timeline
          trimIn: randomFloat(0, 1000000),
        });
        clip.trimOut = clip.trimIn! + clip.duration;

        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result = resolveClipSourceTime(clip, clockTime, {
          clampToRange: true,
          frameRate: 30,
        });

        expect(result.sourceTime).toBeGreaterThanOrEqual(clip.trimIn!);
        expect(result.sourceTime).toBeLessThanOrEqual(clip.trimOut!);
      }
    });
  });

  describe("Property: Symmetry and consistency", () => {
    it("should produce same result for same inputs", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();
        const clockTime = clip.startTime + randomFloat(0, clip.duration);

        const result1 = resolveClipSourceTime(clip, clockTime, {
          frameRate: 30,
        });
        const result2 = resolveClipSourceTime(clip, clockTime, {
          frameRate: 30,
        });

        expect(result1.sourceTime).toBe(result2.sourceTime);
        expect(result1.localTime).toBe(result2.localTime);
      }
    });

    it("should be monotonic (increasing clockTime → increasing sourceTime)", () => {
      for (let i = 0; i < 50; i++) {
        const clip = generateClip();

        const t1 = clip.startTime + randomFloat(0, clip.duration * 0.4);
        const t2 = t1 + randomFloat(0.1, clip.duration * 0.3);
        const t3 = t2 + randomFloat(0.1, clip.duration * 0.2);

        const result1 = resolveClipSourceTime(clip, t1, { frameRate: 30 });
        const result2 = resolveClipSourceTime(clip, t2, { frameRate: 30 });
        const result3 = resolveClipSourceTime(clip, t3, { frameRate: 30 });

        // Should be non-decreasing
        expect(result2.sourceTime).toBeGreaterThanOrEqual(result1.sourceTime);
        expect(result3.sourceTime).toBeGreaterThanOrEqual(result2.sourceTime);
      }
    });
  });
});
