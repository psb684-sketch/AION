/**
 * Body Capture Dual-Worker Client
 *
 * Coordinates parallel worker dispatch between MediaPipe Body Segmentation and
 * Pose Landmarker, synchronizing cadences and joining results via hybridJoinCoordinator.
 */

import type {
  SilhouetteMaskData,
  SkeletalPoseData,
  SubjectCaptureAsset,
} from "@clypra-studio/types";
import { segmentBodyMask } from "../segmentation/bodySegmentationWorkerClient";
import type { BodySegmentationOptions } from "../segmentation/types";
import { joinHybridSubjectCapture, type SubjectCaptureState } from "./hybridJoinCoordinator";
import { interpolateSkeletalPose } from "./cadenceDecimator";
import type { PoseLandmarkerRequest, PoseLandmarkerResponse } from "./pose.worker";

const clipCaptureStates = new Map<string, SubjectCaptureState>();

let poseRequestId = 1;
let poseWorker: Worker | null = null;
const pendingPoseRequests = new Map<number, {
  resolve: (value: SkeletalPoseData | null) => void;
  timeout: number;
}>();

// Cadence cache for decimated pose keyframes per clip
const poseKeyframesByClip = new Map<string, Array<{ timestampUs: number; pose: SkeletalPoseData }>>();
const POSE_CADENCE_INTERVAL_US = 100_000; // 10 fps pose cadence (100ms)

export function getPoseWorker(): Worker | null {
  if (poseWorker || typeof Worker === "undefined") return poseWorker;

  try {
    poseWorker = new Worker(new URL("./pose.worker.ts", import.meta.url), { type: "classic" });
    poseWorker.onmessage = (event: MessageEvent<PoseLandmarkerResponse>) => {
      const response = event.data;
      const item = pendingPoseRequests.get(response.requestId);
      if (!item) return;
      window.clearTimeout(item.timeout);
      pendingPoseRequests.delete(response.requestId);

      if (response.pose) {
        // Record keyframe in cadence cache
        let keyframes = poseKeyframesByClip.get(response.clipId);
        if (!keyframes) {
          keyframes = [];
          poseKeyframesByClip.set(response.clipId, keyframes);
        }
        keyframes.push({ timestampUs: response.timestampUs, pose: response.pose });
        if (keyframes.length > 32) {
          keyframes.shift();
        }
      }

      item.resolve(response.pose);
    };

    poseWorker.onerror = (event) => {
      console.warn("[PoseWorker] Worker error:", event.message);
      for (const item of pendingPoseRequests.values()) {
        window.clearTimeout(item.timeout);
        item.resolve(null);
      }
      pendingPoseRequests.clear();
      poseWorker?.terminate();
      poseWorker = null;
    };
  } catch (err) {
    console.warn("[PoseWorker] Worker unavailable:", err);
    poseWorker = null;
  }

  return poseWorker;
}

export async function detectPoseLandmarks(
  source: CanvasImageSource,
  clipId: string,
  timestampUs: number,
  width: number,
  height: number,
): Promise<SkeletalPoseData | null> {
  // Check if we can interpolate between existing keyframes
  const keyframes = poseKeyframesByClip.get(clipId);
  if (keyframes && keyframes.length >= 2) {
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];
      if (timestampUs >= k1.timestampUs && timestampUs <= k2.timestampUs) {
        const span = k2.timestampUs - k1.timestampUs;
        const t = span > 0 ? (timestampUs - k1.timestampUs) / span : 0;
        return interpolateSkeletalPose(k1.pose, k2.pose, t);
      }
    }
  }

  const worker = getPoseWorker();
  if (!worker) return null;

  // Extract pixel ImageData
  const segW = Math.min(256, Math.max(64, Math.round(width)));
  const segH = Math.min(256, Math.max(64, Math.round(height)));

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(segW, segH)
    : document.createElement("canvas");
  if (canvas instanceof HTMLCanvasElement) {
    canvas.width = segW;
    canvas.height = segH;
  }
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, segW, segH);
    const imageData = ctx.getImageData(0, 0, segW, segH);

    const id = poseRequestId++;
    const payload: PoseLandmarkerRequest = {
      requestId: id,
      clipId,
      timestampUs,
      imageData,
      wasmBaseUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    };

    return await new Promise<SkeletalPoseData | null>((resolve) => {
      const timeout = window.setTimeout(() => {
        pendingPoseRequests.delete(id);
        resolve(null);
      }, 500);

      pendingPoseRequests.set(id, { resolve, timeout });
      worker.postMessage(payload);
    });
  } catch (err) {
    console.warn("[PoseWorker] Failed to capture frame for pose:", err);
    return null;
  }
}

export interface CaptureSubjectOptions extends BodySegmentationOptions {
  requiresPose?: boolean;
}

/**
 * Unified dispatch for subject capture: launches mask segmentation and pose estimation in parallel,
 * then joins them through hybridJoinCoordinator with deadline guarantees.
 */
export async function captureSubject(
  source: CanvasImageSource,
  options: CaptureSubjectOptions,
): Promise<SubjectCaptureAsset | null> {
  const clipId = options.clipId || "clip-default";
  const timestampUs = Math.round(options.time * 1_000_000);

  // 1. Launch silhouette mask segmentation
  const maskPromise = segmentBodyMask(source, options);

  // 2. Launch pose detection if requested
  const posePromise = options.requiresPose
    ? detectPoseLandmarks(source, clipId, timestampUs, options.width, options.height)
    : Promise.resolve(null);

  // 3. Join via coordinator with 60ms deadline and 250ms staleness tolerance
  let clipState = clipCaptureStates.get(clipId);
  if (!clipState) {
    clipState = {
      lastValidMask: null,
      lastValidPose: null,
      lastMaskTimestampUs: 0,
      lastPoseTimestampUs: 0,
    };
    clipCaptureStates.set(clipId, clipState);
  }

  const result = await joinHybridSubjectCapture(
    clipId,
    timestampUs,
    maskPromise,
    posePromise,
    clipState,
    60,
  );

  if (!result.mask && !result.pose) {
    return null;
  }

  let capture: SubjectCaptureAsset["capture"];
  if (result.mask && result.pose) {
    capture = {
      type: "hybrid_body",
      mask: {
        type: "silhouette_mask",
        category: "person",
        width: result.mask.width,
        height: result.mask.height,
        textureHandle: result.mask,
      },
      pose: result.pose,
    };
  } else if (result.mask) {
    capture = {
      type: "silhouette_mask",
      category: "person",
      width: result.mask.width,
      height: result.mask.height,
      textureHandle: result.mask,
    };
  } else {
    capture = result.pose!;
  }

  return {
    id: `${clipId}:${timestampUs}`,
    sourceClipId: clipId,
    timestampUs,
    isBaked: false,
    capture,
  };
}
