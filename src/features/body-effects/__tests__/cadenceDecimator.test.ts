import { describe, it, expect } from "vitest";
import {
  deriveTorsoOrientation,
  slerpQuaternion,
  lerpLandmark,
  interpolateSkeletalPose,
} from "../capture/cadenceDecimator";
import type { Landmark3D, SkeletalPoseData } from "@clypra-studio/types";

describe("cadenceDecimator", () => {
  const leftShoulder: Landmark3D = { x: 0.4, y: 0.3, z: 0.0, visibility: 0.95 };
  const rightShoulder: Landmark3D = { x: 0.6, y: 0.3, z: 0.0, visibility: 0.95 };
  const neck: Landmark3D = { x: 0.5, y: 0.25, z: 0.0, visibility: 0.95 };
  const spineCenter: Landmark3D = { x: 0.5, y: 0.5, z: 0.0, visibility: 0.95 };
  const leftWrist: Landmark3D = { x: 0.3, y: 0.6, z: 0.0, visibility: 0.9 };
  const rightWrist: Landmark3D = { x: 0.7, y: 0.6, z: 0.0, visibility: 0.9 };

  it("derives a normalized torso orientation quaternion", () => {
    const q = deriveTorsoOrientation(leftShoulder, rightShoulder, neck, spineCenter);
    expect(q).toBeDefined();
    const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    expect(len).toBeCloseTo(1.0, 4);
  });

  it("slerps smoothly between two quaternions", () => {
    const q1 = { x: 0, y: 0, z: 0, w: 1 };
    const q2 = { x: 0, y: 0.7071, z: 0, w: 0.7071 }; // 90 deg around Y

    const mid = slerpQuaternion(q1, q2, 0.5);
    const len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z + mid.w * mid.w);
    expect(len).toBeCloseTo(1.0, 4);
    expect(mid.y).toBeGreaterThan(0.3);
    expect(mid.w).toBeGreaterThan(0.8);
  });

  it("interpolates position landmarks linearly", () => {
    const l1: Landmark3D = { x: 0.2, y: 0.4, z: -0.1, visibility: 1.0 };
    const l2: Landmark3D = { x: 0.4, y: 0.8, z: 0.1, visibility: 0.8 };

    const interpolated = lerpLandmark(l1, l2, 0.5);
    expect(interpolated.x).toBeCloseTo(0.3, 4);
    expect(interpolated.y).toBeCloseTo(0.6, 4);
    expect(interpolated.z).toBeCloseTo(0.0, 4);
    expect(interpolated.visibility).toBeCloseTo(0.8, 4);
  });

  it("interpolates full SkeletalPoseData between keyframes", () => {
    const qA = deriveTorsoOrientation(leftShoulder, rightShoulder, neck, spineCenter);
    const poseA: SkeletalPoseData = {
      type: "skeletal_pose",
      landmarks: [leftShoulder, rightShoulder],
      anchors: {
        leftShoulder,
        rightShoulder,
        neck,
        spineCenter,
        leftWrist,
        rightWrist,
        torsoOrientation: qA,
      },
    };

    const movedShoulder: Landmark3D = { ...leftShoulder, x: leftShoulder.x + 0.1 };
    const qB = deriveTorsoOrientation(movedShoulder, rightShoulder, neck, spineCenter);
    const poseB: SkeletalPoseData = {
      type: "skeletal_pose",
      landmarks: [movedShoulder, rightShoulder],
      anchors: {
        leftShoulder: movedShoulder,
        rightShoulder,
        neck,
        spineCenter,
        leftWrist,
        rightWrist,
        torsoOrientation: qB,
      },
    };

    const poseMid = interpolateSkeletalPose(poseA, poseB, 0.5);
    expect(poseMid.landmarks[0].x).toBeCloseTo(0.45, 4);
    expect(poseMid.anchors.leftShoulder.x).toBeCloseTo(0.45, 4);
    const qLen = Math.sqrt(
      poseMid.anchors.torsoOrientation.x ** 2 +
      poseMid.anchors.torsoOrientation.y ** 2 +
      poseMid.anchors.torsoOrientation.z ** 2 +
      poseMid.anchors.torsoOrientation.w ** 2
    );
    expect(qLen).toBeCloseTo(1.0, 4);
  });
});
