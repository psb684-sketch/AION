import { describe, it, expect, vi } from "vitest";
import {
  joinHybridSubjectCapture,
  type SubjectCaptureState,
} from "../capture/hybridJoinCoordinator";
import type { SkeletalPoseData } from "@clypra-studio/types";

describe("hybridJoinCoordinator", () => {
  const dummyMask = {} as ImageData;
  const dummyPose: SkeletalPoseData = {
    type: "skeletal_pose",
    landmarks: [],
    anchors: {
      leftShoulder: { x: 0, y: 0, z: 0, visibility: 1 },
      rightShoulder: { x: 0, y: 0, z: 0, visibility: 1 },
      neck: { x: 0, y: 0, z: 0, visibility: 1 },
      spineCenter: { x: 0, y: 0, z: 0, visibility: 1 },
      leftWrist: { x: 0, y: 0, z: 0, visibility: 1 },
      rightWrist: { x: 0, y: 0, z: 0, visibility: 1 },
      torsoOrientation: { x: 0, y: 0, z: 0, w: 1 },
    },
  };

  it("resolves fresh mask and fresh pose when both succeed before deadline", async () => {
    const state: SubjectCaptureState = {
      lastValidMask: null,
      lastValidPose: null,
      lastMaskTimestampUs: 0,
      lastPoseTimestampUs: 0,
    };

    const maskPromise = Promise.resolve(dummyMask);
    const posePromise = Promise.resolve(dummyPose);

    const result = await joinHybridSubjectCapture(
      "clip-1",
      1_000_000,
      maskPromise,
      posePromise,
      state,
      50,
    );

    expect(result.mask).toBe(dummyMask);
    expect(result.pose).toBe(dummyPose);
    expect(result.isDegraded).toBe(false);
    expect(result.maskSource).toBe("fresh");
    expect(result.poseSource).toBe("fresh");
    expect(state.lastValidMask).toBe(dummyMask);
    expect(state.lastValidPose).toBe(dummyPose);
  });

  it("falls back to stale mask when mask promise times out but stale mask is within tolerance", async () => {
    const staleMask = {} as ImageData;
    const state: SubjectCaptureState = {
      lastValidMask: staleMask,
      lastValidPose: null,
      lastMaskTimestampUs: 900_000, // 100ms ago (within 250ms tolerance)
      lastPoseTimestampUs: 0,
    };

    const hangingMaskPromise = new Promise<ImageData | null>(() => {});
    const posePromise = Promise.resolve(dummyPose);

    const result = await joinHybridSubjectCapture(
      "clip-1",
      1_000_000,
      hangingMaskPromise,
      posePromise,
      state,
      20, // 20ms deadline
    );

    expect(result.mask).toBe(staleMask);
    expect(result.pose).toBe(dummyPose);
    expect(result.isDegraded).toBe(true);
    expect(result.maskSource).toBe("stale");
    expect(result.poseSource).toBe("fresh");
  });

  it("returns null mask when stale mask exceeds tolerance", async () => {
    const veryStaleMask = {} as ImageData;
    const state: SubjectCaptureState = {
      lastValidMask: veryStaleMask,
      lastValidPose: null,
      lastMaskTimestampUs: 500_000, // 500ms ago (>250ms tolerance)
      lastPoseTimestampUs: 0,
    };

    const failingMaskPromise = Promise.reject(new Error("Worker failure"));
    const posePromise = Promise.resolve(dummyPose);

    const result = await joinHybridSubjectCapture(
      "clip-1",
      1_000_000,
      failingMaskPromise,
      posePromise,
      state,
      20,
    );

    expect(result.mask).toBeNull();
    expect(result.maskSource).toBe("missing");
    expect(result.pose).toBe(dummyPose);
  });
});
