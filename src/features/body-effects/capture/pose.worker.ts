import type { Landmark3D, SkeletalPoseData } from "@clypra-studio/types";
import { buildSkeletalPoseData } from "./cadenceDecimator";

export interface PoseLandmarkerRequest {
  requestId: number;
  clipId: string;
  timestampUs: number;
  imageData: ImageData;
  modelUrl?: string;
  runtimeScriptUrl?: string;
  wasmBaseUrl?: string;
  minConfidence?: number;
}

export interface PoseLandmarkerResponse {
  requestId: number;
  clipId: string;
  timestampUs: number;
  pose: SkeletalPoseData | null;
  runtimeUsed: "mediapipe" | "heuristic" | "fallback";
  error?: string;
}

declare const self: {
  document?: any;
  onmessage: ((event: MessageEvent<PoseLandmarkerRequest>) => void | Promise<void>) | null;
  postMessage: (message: PoseLandmarkerResponse) => void;
};

// WebKit in Worker safeguard (MediaPipe Issue #5292):
// On WKWebView, MediaPipe's Ph() helper fails to detect Safari version, falling back to document.createElement("canvas").
if (typeof (self as any).document === "undefined" && typeof OffscreenCanvas !== "undefined") {
  (self as any).document = {
    createElement: (tag: string) => (tag === "canvas" ? new OffscreenCanvas(1, 1) : null),
  };
}

let mediaPipeModule: any = null;
let mediaPipeRuntimeScriptUrl: string | null = null;
let poseLandmarker: any = null;
let poseLandmarkerConfigKey: string | null = null;

self.onmessage = async (event: MessageEvent<PoseLandmarkerRequest>) => {
  const request = event.data;
  const response = await detectPose(request);
  self.postMessage(response);
};

async function detectPose(request: PoseLandmarkerRequest): Promise<PoseLandmarkerResponse> {
  try {
    let pose: SkeletalPoseData | null = null;
    let runtimeUsed: "mediapipe" | "heuristic" | "fallback" = "fallback";

    if (request.modelUrl && request.wasmBaseUrl) {
      try {
        pose = await detectWithMediaPipe(request);
        if (pose) {
          runtimeUsed = "mediapipe";
        }
      } catch (err) {
        // Fallback to anatomical heuristic if MediaPipe task fails or CDN offline
        runtimeUsed = "fallback";
      }
    }

    if (!pose) {
      pose = generateHeuristicPose(request.imageData);
      runtimeUsed = "heuristic";
    }

    return {
      requestId: request.requestId,
      clipId: request.clipId,
      timestampUs: request.timestampUs,
      pose,
      runtimeUsed,
    };
  } catch (error) {
    return {
      requestId: request.requestId,
      clipId: request.clipId,
      timestampUs: request.timestampUs,
      pose: generateHeuristicPose(request.imageData),
      runtimeUsed: "fallback",
      error: error instanceof Error ? error.message : "Pose landmarking failed",
    };
  }
}

async function detectWithMediaPipe(request: PoseLandmarkerRequest): Promise<SkeletalPoseData | null> {
  const scriptUrl =
    request.runtimeScriptUrl ||
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

  const module = await loadMediaPipeRuntime(scriptUrl);
  const { FilesetResolver, PoseLandmarker } = module;
  if (!FilesetResolver?.forVisionTasks || !PoseLandmarker?.createFromOptions) return null;

  const configKey = [scriptUrl, request.modelUrl, request.wasmBaseUrl].join("|");
  if (!poseLandmarker || poseLandmarkerConfigKey !== configKey) {
    const fileset = await FilesetResolver.forVisionTasks(request.wasmBaseUrl);
    poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: request.modelUrl,
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: request.minConfidence ?? 0.5,
      minPosePresenceConfidence: request.minConfidence ?? 0.5,
      minTrackingConfidence: request.minConfidence ?? 0.5,
      outputSegmentationMasks: false,
    });
    poseLandmarkerConfigKey = configKey;
  }

  const result = await runPoseDetection(poseLandmarker, request.imageData);
  if (!result || !result.landmarks || result.landmarks.length === 0) return null;

  const rawLandmarks = result.landmarks[0];
  const landmarks: Landmark3D[] = rawLandmarks.map((lm: any) => ({
    x: lm.x ?? 0.5,
    y: lm.y ?? 0.5,
    z: lm.z ?? 0.0,
    visibility: lm.visibility ?? 1.0,
  }));

  return buildSkeletalPoseData(landmarks);
}

async function loadMediaPipeRuntime(url: string): Promise<any> {
  if (mediaPipeModule && mediaPipeRuntimeScriptUrl === url) return mediaPipeModule;
  mediaPipeModule = await import(/* @vite-ignore */ url);
  mediaPipeRuntimeScriptUrl = url;
  poseLandmarker = null;
  poseLandmarkerConfigKey = null;
  return mediaPipeModule;
}

function runPoseDetection(landmarker: any, imageData: ImageData): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("MediaPipe pose landmarking timed out"));
    }, 2000);

    const finish = (result: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    try {
      const maybeResult = landmarker.detect(imageData, finish);
      if (maybeResult?.then) {
        maybeResult.then(finish, reject);
      } else if (maybeResult) {
        finish(maybeResult);
      }
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Standard anatomical human prior pose positioned centrally in frame.
 * Ensures that wing and aura anchor calculations never divide by zero or break pipeline continuity.
 */
function generateHeuristicPose(imageData: ImageData): SkeletalPoseData {
  const landmarks: Landmark3D[] = new Array(33);

  for (let i = 0; i < 33; i++) {
    landmarks[i] = { x: 0.5, y: 0.5, z: 0.0, visibility: 0.5 };
  }

  // Set standard BlazePose landmark anchors
  landmarks[0] = { x: 0.5, y: 0.2, z: 0.0, visibility: 0.9 }; // Nose
  landmarks[11] = { x: 0.42, y: 0.32, z: 0.0, visibility: 0.9 }; // Left shoulder
  landmarks[12] = { x: 0.58, y: 0.32, z: 0.0, visibility: 0.9 }; // Right shoulder
  landmarks[13] = { x: 0.38, y: 0.45, z: 0.0, visibility: 0.8 }; // Left elbow
  landmarks[14] = { x: 0.62, y: 0.45, z: 0.0, visibility: 0.8 }; // Right elbow
  landmarks[15] = { x: 0.35, y: 0.58, z: 0.0, visibility: 0.8 }; // Left wrist
  landmarks[16] = { x: 0.65, y: 0.58, z: 0.0, visibility: 0.8 }; // Right wrist
  landmarks[23] = { x: 0.45, y: 0.65, z: 0.0, visibility: 0.9 }; // Left hip
  landmarks[24] = { x: 0.55, y: 0.65, z: 0.0, visibility: 0.9 }; // Right hip

  return buildSkeletalPoseData(landmarks);
}
