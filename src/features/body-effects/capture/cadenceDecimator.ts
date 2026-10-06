/**
 * Cadence Decimator & Torso Kinematics Engine
 *
 * Runs skeletal pose inference at decimated rates (10–15 fps) and reconstructs
 * smooth 60fps tracking via Position Lerp and Torso Orientation Slerp.
 */

import type { Landmark3D, Quaternion, SkeletalPoseData, TorsoAnchors } from "@clypra-studio/types";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function sub(a: Vector3 | Landmark3D, b: Vector3 | Landmark3D): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vector3): Vector3 {
  const len = length(v);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return scale(v, 1 / len);
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Derives a normalized Torso 3D orientation quaternion from MediaPipe Pose landmarks.
 * Mediapipe Landmarks: 11 = left_shoulder, 12 = right_shoulder, 23 = left_hip, 24 = right_hip.
 */
export function deriveTorsoOrientation(
  leftShoulder: Landmark3D,
  rightShoulder: Landmark3D,
  neck: Landmark3D,
  spineCenter: Landmark3D,
): Quaternion {
  // 1. Right vector: from left shoulder to right shoulder
  const uRight = normalize(sub(rightShoulder, leftShoulder));

  // 2. Up vector: from spine center towards neck
  const uUpRaw = normalize(sub(neck, spineCenter));

  // Orthogonalize up vector against right vector (Gram-Schmidt)
  const uUp = normalize(sub(uUpRaw, scale(uRight, dot(uUpRaw, uRight))));

  // 3. Forward vector: perpendicular to chest plane (facing viewer)
  const uForward = normalize(cross(uRight, uUp));

  // 4. Matrix to Quaternion (R = [uRight, uUp, uForward])
  // m00 = uRight.x, m10 = uRight.y, m20 = uRight.z
  // m01 = uUp.x,    m11 = uUp.y,    m21 = uUp.z
  // m02 = uFwd.x,   m12 = uFwd.y,   m22 = uFwd.z
  const m00 = uRight.x, m10 = uRight.y, m20 = uRight.z;
  const m01 = uUp.x,    m11 = uUp.y,    m21 = uUp.z;
  const m02 = uForward.x, m12 = uForward.y, m22 = uForward.z;

  const trace = m00 + m11 + m22;
  let q: Quaternion;

  if (trace > 0.0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    q = {
      w: 0.25 / s,
      x: (m21 - m12) * s,
      y: (m02 - m20) * s,
      z: (m10 - m01) * s,
    };
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    q = {
      w: (m21 - m12) / s,
      x: 0.25 * s,
      y: (m01 + m10) / s,
      z: (m02 + m20) / s,
    };
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    q = {
      w: (m02 - m20) / s,
      x: (m01 + m10) / s,
      y: 0.25 * s,
      z: (m12 + m21) / s,
    };
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    q = {
      w: (m10 - m01) / s,
      x: (m02 + m20) / s,
      y: (m12 + m21) / s,
      z: 0.25 * s,
    };
  }

  // Normalize quaternion
  const qLen = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (qLen < 1e-6) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / qLen, y: q.y / qLen, z: q.z / qLen, w: q.w / qLen };
}

/**
 * Spherical Linear Interpolation (Slerp) between two unit quaternions.
 */
export function slerpQuaternion(q1: Quaternion, q2: Quaternion, t: number): Quaternion {
  let cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

  let q2Target = q2;
  if (cosHalfTheta < 0) {
    q2Target = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta >= 0.9995) {
    // If quaternions are very close, use linear interpolation to avoid division by zero
    const x = q1.x + t * (q2Target.x - q1.x);
    const y = q1.y + t * (q2Target.y - q1.y);
    const z = q1.z + t * (q2Target.z - q1.z);
    const w = q1.w + t * (q2Target.w - q1.w);
    const len = Math.sqrt(x * x + y * y + z * z + w * w);
    return { x: x / len, y: y / len, z: z / len, w: w / len };
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return {
    w: q1.w * ratioA + q2Target.w * ratioB,
    x: q1.x * ratioA + q2Target.x * ratioB,
    y: q1.y * ratioA + q2Target.y * ratioB,
    z: q1.z * ratioA + q2Target.z * ratioB,
  };
}

/**
 * Linearly interpolates position landmarks between keyframes.
 */
export function lerpLandmark(l1: Landmark3D, l2: Landmark3D, t: number): Landmark3D {
  return {
    x: l1.x + (l2.x - l1.x) * t,
    y: l1.y + (l2.y - l1.y) * t,
    z: l1.z + (l2.z - l1.z) * t,
    visibility: Math.min(l1.visibility, l2.visibility),
  };
}

/**
 * Interpolates full SkeletalPoseData between two keyframes using position Lerp and torso Slerp.
 */
export function interpolateSkeletalPose(
  p1: SkeletalPoseData,
  p2: SkeletalPoseData,
  t: number,
): SkeletalPoseData {
  const count = Math.min(p1.landmarks.length, p2.landmarks.length);
  const landmarks: Landmark3D[] = new Array(count);
  for (let i = 0; i < count; i++) {
    landmarks[i] = lerpLandmark(p1.landmarks[i], p2.landmarks[i], t);
  }

  const anchors: TorsoAnchors = {
    leftShoulder: lerpLandmark(p1.anchors.leftShoulder, p2.anchors.leftShoulder, t),
    rightShoulder: lerpLandmark(p1.anchors.rightShoulder, p2.anchors.rightShoulder, t),
    neck: lerpLandmark(p1.anchors.neck, p2.anchors.neck, t),
    spineCenter: lerpLandmark(p1.anchors.spineCenter, p2.anchors.spineCenter, t),
    leftWrist: lerpLandmark(p1.anchors.leftWrist, p2.anchors.leftWrist, t),
    rightWrist: lerpLandmark(p1.anchors.rightWrist, p2.anchors.rightWrist, t),
    torsoOrientation: slerpQuaternion(
      p1.anchors.torsoOrientation,
      p2.anchors.torsoOrientation,
      t,
    ),
  };

  return {
    type: "skeletal_pose",
    landmarks,
    anchors,
  };
}

/**
 * Assembles a complete SkeletalPoseData structure from 33 MediaPipe Pose landmarks,
 * computing anatomical anchors and torso 3D orientation.
 */
export function buildSkeletalPoseData(landmarks: readonly Landmark3D[]): SkeletalPoseData {
  const leftShoulder = landmarks[11] || { x: 0.4, y: 0.3, z: 0, visibility: 0 };
  const rightShoulder = landmarks[12] || { x: 0.6, y: 0.3, z: 0, visibility: 0 };
  const leftHip = landmarks[23] || { x: 0.45, y: 0.65, z: 0, visibility: 0 };
  const rightHip = landmarks[24] || { x: 0.55, y: 0.65, z: 0, visibility: 0 };
  const leftWrist = landmarks[15] || { x: 0.3, y: 0.5, z: 0, visibility: 0 };
  const rightWrist = landmarks[16] || { x: 0.7, y: 0.5, z: 0, visibility: 0 };

  const neck: Landmark3D = {
    x: (leftShoulder.x + rightShoulder.x) * 0.5,
    y: (leftShoulder.y + rightShoulder.y) * 0.5,
    z: (leftShoulder.z + rightShoulder.z) * 0.5,
    visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility),
  };

  const hipCenter: Landmark3D = {
    x: (leftHip.x + rightHip.x) * 0.5,
    y: (leftHip.y + rightHip.y) * 0.5,
    z: (leftHip.z + rightHip.z) * 0.5,
    visibility: Math.min(leftHip.visibility, rightHip.visibility),
  };

  const spineCenter: Landmark3D = {
    x: (neck.x + hipCenter.x) * 0.5,
    y: (neck.y + hipCenter.y) * 0.5,
    z: (neck.z + hipCenter.z) * 0.5,
    visibility: Math.min(neck.visibility, hipCenter.visibility),
  };

  const torsoOrientation = deriveTorsoOrientation(
    leftShoulder,
    rightShoulder,
    neck,
    spineCenter,
  );

  const anchors: TorsoAnchors = {
    leftShoulder,
    rightShoulder,
    neck,
    spineCenter,
    leftWrist,
    rightWrist,
    torsoOrientation,
  };

  return {
    type: "skeletal_pose",
    landmarks,
    anchors,
  };
}
