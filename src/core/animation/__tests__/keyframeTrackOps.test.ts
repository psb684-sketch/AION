import { describe, it, expect } from "vitest";
import {
  evaluateBezierVelocity,
  generateCurveSamples,
  retimeKeyframe,
  duplicateKeyframe,
  deleteKeyframe,
  applyCurveToKeyframe,
  applyCurveToAllKeyframes,
  findActiveKeyframeSegment,
} from "../keyframeTrackOps";
import type { Keyframe } from "@/types/keyframes";

describe("keyframeTrackOps", () => {
  describe("evaluateBezierVelocity", () => {
    it("returns 1.0 for linear identity curve", () => {
      expect(evaluateBezierVelocity([0, 0, 1, 1], 0.5)).toBeCloseTo(1.0, 3);
      expect(evaluateBezierVelocity([0.4, 0.4, 0.8, 0.8], 0.5)).toBeCloseTo(1.0, 3);
    });

    it("evaluates acceleration for ease-in curve", () => {
      // Ease in starts slow, ends fast
      const vStart = evaluateBezierVelocity([0.42, 0.0, 1.0, 1.0], 0.1);
      const vEnd = evaluateBezierVelocity([0.42, 0.0, 1.0, 1.0], 0.9);
      expect(vStart).toBeLessThan(vEnd);
    });

    it("evaluates deceleration for ease-out curve", () => {
      // Ease out starts fast, ends slow
      const vStart = evaluateBezierVelocity([0.0, 0.0, 0.58, 1.0], 0.1);
      const vEnd = evaluateBezierVelocity([0.0, 0.0, 0.58, 1.0], 0.9);
      expect(vStart).toBeGreaterThan(vEnd);
    });

    it("evaluates S-curve velocity peak in the middle for ease-in-out", () => {
      const vMid = evaluateBezierVelocity([0.42, 0.0, 0.58, 1.0], 0.5);
      const vStart = evaluateBezierVelocity([0.42, 0.0, 0.58, 1.0], 0.05);
      const vEnd = evaluateBezierVelocity([0.42, 0.0, 0.58, 1.0], 0.95);
      expect(vMid).toBeGreaterThan(vStart);
      expect(vMid).toBeGreaterThan(vEnd);
    });
  });

  describe("generateCurveSamples", () => {
    it("generates 61 points for 60 samples from t=0 to t=1", () => {
      const samples = generateCurveSamples([0.25, 0.1, 0.25, 1.0], "easeInOut", undefined, 60);
      expect(samples.length).toBe(61);
      expect(samples[0].t).toBe(0);
      expect(samples[60].t).toBe(1);
      expect(samples[0].value).toBeCloseTo(0, 3);
      expect(samples[60].value).toBeCloseTo(1, 3);
    });
  });

  describe("retimeKeyframe", () => {
    const kfs: Keyframe[] = [
      { id: "kf-1", time: 0.0, value: 0 },
      { id: "kf-2", time: 1.0, value: 50 },
      { id: "kf-3", time: 2.0, value: 100 },
    ];

    it("clamps new time to clip duration and maintains sort order", () => {
      const updated = retimeKeyframe(kfs, "kf-2", 2.5, 3.0);
      expect(updated[2].id).toBe("kf-2");
      expect(updated[2].time).toBe(2.5);
      expect(updated[1].id).toBe("kf-3");
    });

    it("clamps below zero to zero", () => {
      const updated = retimeKeyframe(kfs, "kf-2", -1.0, 3.0);
      const kf2 = updated.find((k) => k.id === "kf-2");
      expect(kf2).toBeDefined();
      expect(kf2?.time).toBe(0);
    });

    it("snaps to target time if within threshold", () => {
      const updated = retimeKeyframe(kfs, "kf-2", 1.48, 3.0, {
        snapToTimes: [1.5],
        snapThreshold: 0.05,
      });
      expect(updated.find((k) => k.id === "kf-2")?.time).toBe(1.5);
    });
  });

  describe("duplicateKeyframe", () => {
    const kfs: Keyframe[] = [
      { id: "kf-1", time: 0.0, value: 10 },
      { id: "kf-2", time: 1.0, value: 20 },
    ];

    it("creates a duplicate keyframe with a new id at the target time", () => {
      const duplicated = duplicateKeyframe(kfs, "kf-2", 0.5, 3.0);
      expect(duplicated.length).toBe(3);
      const newKf = duplicated.find((k) => k.time === 0.5);
      expect(newKf).toBeDefined();
      expect(newKf?.value).toBe(20);
      expect(newKf?.id).not.toBe("kf-2");
      expect(duplicated[1].time).toBe(0.5);
    });
  });

  describe("deleteKeyframe", () => {
    it("removes the target keyframe by id", () => {
      const kfs: Keyframe[] = [
        { id: "kf-1", time: 0.0, value: 0 },
        { id: "kf-2", time: 1.0, value: 1 },
      ];
      const result = deleteKeyframe(kfs, "kf-1");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("kf-2");
    });
  });

  describe("applyCurveToKeyframe & applyCurveToAllKeyframes", () => {
    const kfs: Keyframe[] = [
      { id: "kf-1", time: 0.0, value: 0, easing: "linear" },
      { id: "kf-2", time: 1.0, value: 100, easing: "linear" },
    ];

    it("updates easing and control points for a single keyframe", () => {
      const updated = applyCurveToKeyframe(kfs, 0, "easeOutBack", [0.34, 1.56, 0.64, 1.0]);
      expect(updated[0].easing).toBe("easeOutBack");
      expect(updated[0].controlPoints).toEqual([0.34, 1.56, 0.64, 1.0]);
      expect(updated[1].easing).toBe("linear");
    });

    it("updates all keyframes when applied to all", () => {
      const updated = applyCurveToAllKeyframes(kfs, "easeInOut", [0.42, 0.0, 0.58, 1.0]);
      expect(updated[0].easing).toBe("easeInOut");
      expect(updated[1].easing).toBe("easeInOut");
    });
  });

  describe("findActiveKeyframeSegment", () => {
    const kfs: Keyframe[] = [
      { id: "kf-1", time: 1.0, value: 10 },
      { id: "kf-2", time: 3.0, value: 50 },
    ];

    it("correctly identifies interval and progress", () => {
      const segment = findActiveKeyframeSegment(kfs, 2.0);
      expect(segment).not.toBeNull();
      expect(segment?.index).toBe(0);
      expect(segment?.startKeyframe.id).toBe("kf-1");
      expect(segment?.endKeyframe?.id).toBe("kf-2");
      expect(segment?.progress).toBeCloseTo(0.5, 3);
    });

    it("handles time before first keyframe", () => {
      const segment = findActiveKeyframeSegment(kfs, 0.5);
      expect(segment?.progress).toBe(0);
    });

    it("handles time after last keyframe", () => {
      const segment = findActiveKeyframeSegment(kfs, 4.0);
      expect(segment?.progress).toBe(1);
    });
  });
});
