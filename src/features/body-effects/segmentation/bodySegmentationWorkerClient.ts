import { bodyMaskCache } from "./maskCache";
import { getBodySegmentationConfig } from "./segmentationConfig";
import type { BodySegmentationOptions, BodySegmentationRequest, BodySegmentationResponse } from "./types";
import { telemetryCollector } from "@/services/telemetryCollector";
import { workerPerfCollector } from "@/core/monitoring/WorkerPerfCollector";

const REQUEST_TIMEOUT_MS = 900;
const MASK_CADENCE_INTERVAL_S = 0.1;
const MAX_SEGMENTATION_DIM = 512;

let requestId = 1;
let worker: Worker | null = null;
const pending = new Map<number, {
  resolve: (value: ImageData | null) => void;
  timeout: number;
  startTime: number;
  target: string;
  targetWidth: number;
  targetHeight: number;
}>();

interface QueuedSegmentationTask {
  payload: BodySegmentationRequest;
  requestTimeoutMs: number;
  resolve: (value: ImageData | null) => void;
  target: string;
  targetWidth: number;
  targetHeight: number;
}

const activeWorkerDispatches = new Map<string, number>();
const nextQueuedTaskByClip = new Map<string, QueuedSegmentationTask>();

function dispatchOrQueue(clipKey: string, task: QueuedSegmentationTask): void {
  const activeWorker = getWorker();
  if (!activeWorker) {
    task.resolve(null);
    return;
  }

  // If worker is already busy computing a frame for this clip:
  // supersede any older pending task with this latest frame
  if (activeWorkerDispatches.has(clipKey)) {
    const previous = nextQueuedTaskByClip.get(clipKey);
    if (previous) {
      previous.resolve(null);
    }
    nextQueuedTaskByClip.set(clipKey, task);
    return;
  }

  // Worker is idle for this clip: dispatch immediately
  activeWorkerDispatches.set(clipKey, task.payload.requestId);
  const startTime = performance.now();
  const timeout = window.setTimeout(() => {
    pending.delete(task.payload.requestId);
    activeWorkerDispatches.delete(clipKey);
    task.resolve(null);
    drainNext(clipKey);
  }, task.requestTimeoutMs);

  pending.set(task.payload.requestId, {
    resolve: (mask) => {
      activeWorkerDispatches.delete(clipKey);
      task.resolve(mask);
      drainNext(clipKey);
    },
    timeout,
    startTime,
    target: task.target,
    targetWidth: task.targetWidth,
    targetHeight: task.targetHeight,
  });

  activeWorker.postMessage(task.payload);
}

function drainNext(clipKey: string): void {
  const next = nextQueuedTaskByClip.get(clipKey);
  if (next) {
    nextQueuedTaskByClip.delete(clipKey);
    dispatchOrQueue(clipKey, next);
  }
}

function getWorker(): Worker | null {
  if (worker || typeof Worker === "undefined") return worker;

  try {
    worker = new Worker(new URL("./bodySegmentation.worker.ts", import.meta.url), { type: "classic" });
    console.info("[BodySegmentation] Worker initialized successfully");
    worker.onmessage = (event: MessageEvent<BodySegmentationResponse>) => {
      const response = event.data;
      const item = pending.get(response.requestId);
      if (!item) return;
      window.clearTimeout(item.timeout);
      pending.delete(response.requestId);

      const durationMs = performance.now() - item.startTime;

      if (response.mask) {
        const finalMask = (item.targetWidth !== response.mask.width || item.targetHeight !== response.mask.height)
          ? upscaleMask(response.mask, item.targetWidth, item.targetHeight)
          : response.mask;

        telemetryCollector.recordAIInferenceSpan(
          "body-segmentation",
          durationMs,
          1000 / Math.max(durationMs, 1),
          1.0,
          true,
          response.runtimeUsed,
          item.target,
        );

        if (response.runtimeUsed === "fallback") {
          console.info(
            `[BodySegmentation] Runtime: fallback (heuristic). ${response.error ? `Reason: ${response.error}` : ""}`,
          );
          telemetryCollector.recordFallbackEvent(
            "mediapipe",
            "heuristic",
            response.error || "fallback_to_heuristic",
          );
        } else {
          console.info(
            `[BodySegmentation] Runtime: ${response.runtimeUsed} (${durationMs.toFixed(1)}ms)`,
          );
        }

        bodyMaskCache.set(response.cacheKey, finalMask);
        workerPerfCollector.record({
          domain: "BodySegmentationWorker",
          operation: "segment",
          durationMs,
          overBudget: durationMs > 33.33,
          metadata: { runtimeUsed: response.runtimeUsed, target: item.target },
        });
        item.resolve(finalMask);
      } else {
        telemetryCollector.recordAIInferenceSpan(
          "body-segmentation",
          durationMs,
          0,
          0,
          false,
          response.runtimeUsed,
          item.target,
        );

        workerPerfCollector.recordError(
          "BodySegmentationWorker",
          response.error || "Inference failed",
          "segment",
          { runtimeUsed: response.runtimeUsed, target: item.target },
        );

        if (response.error) {
          console.warn(`[BodySegmentation] ${response.error}`);
        }
        item.resolve(null);
      }
    };
    worker.onerror = (event) => {
      console.warn("[BodySegmentation] Worker error:", event.message);
      workerPerfCollector.recordError(
        "BodySegmentationWorker",
        event.message || "Worker runtime error",
      );
      flushPending();
      worker?.terminate();
      worker = null;
    };
  } catch (error) {
    console.warn("[BodySegmentation] Worker unavailable:", error);
    worker = null;
  }

  return worker;
}

function flushPending(): void {
  for (const item of pending.values()) {
    window.clearTimeout(item.timeout);
    item.resolve(null);
  }
  pending.clear();
  for (const task of nextQueuedTaskByClip.values()) {
    task.resolve(null);
  }
  nextQueuedTaskByClip.clear();
  activeWorkerDispatches.clear();
}

export function makeBodyMaskCacheKey(options: BodySegmentationOptions): string {
  const frameTime = Math.round(options.time / MASK_CADENCE_INTERVAL_S) * MASK_CADENCE_INTERVAL_S;
  return [
    options.clipId || "composition",
    options.effectId,
    options.renderer,
    options.width,
    options.height,
    frameTime.toFixed(3),
    options.minConfidence ?? 0.7,
  ].join(":");
}

export async function segmentBodyMask(
  source: CanvasImageSource,
  options: BodySegmentationOptions,
): Promise<ImageData | null> {
  const cacheKey = makeBodyMaskCacheKey(options);
  const cached = bodyMaskCache.get(cacheKey);
  if (cached) {
    telemetryCollector.recordAIInferenceSpan(
      "body-segmentation",
      0.1,
      60,
      1.0,
      true,
      "cache",
      options.renderer,
    );
    return cached;
  }

  const targetWidth = Math.max(1, Math.floor(options.width));
  const targetHeight = Math.max(1, Math.floor(options.height));

  // Cap inference resolution to MAX_SEGMENTATION_DIM to match model native dimensions and maximize scrub FPS
  const scale = Math.min(1, MAX_SEGMENTATION_DIM / Math.max(targetWidth, targetHeight));
  const segWidth = Math.max(1, Math.round(targetWidth * scale));
  const segHeight = Math.max(1, Math.round(targetHeight * scale));

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(segWidth, segHeight)
    : document.createElement("canvas");
  if (canvas instanceof HTMLCanvasElement) {
    canvas.width = segWidth;
    canvas.height = segHeight;
  }

  const ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, segWidth, segHeight);
    const imageData = ctx.getImageData(0, 0, segWidth, segHeight);
    return await requestWorkerMask(cacheKey, imageData, options, targetWidth, targetHeight);
  } catch (error) {
    console.warn("[BodySegmentation] Failed to read frame pixels:", error);
    return null;
  }
}

async function requestWorkerMask(
  cacheKey: string,
  imageData: ImageData,
  options: BodySegmentationOptions,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageData | null> {
  const activeWorker = getWorker();
  if (!activeWorker) return Promise.resolve(null);

  const id = requestId++;
  const config = await getBodySegmentationConfig();
  const payload: BodySegmentationRequest = {
    requestId: id,
    cacheKey,
    imageData,
    runtime: config.runtime,
    modelUrl: config.modelUrl,
    runtimeScriptUrl: config.runtimeScriptUrl,
    wasmBaseUrl: config.wasmBaseUrl,
    minConfidence: options.minConfidence ?? config.minConfidence ?? 0.7,
  };
  const requestTimeoutMs = Math.max(250, config.requestTimeoutMs ?? REQUEST_TIMEOUT_MS);
  const clipKey = options.clipId || "composition";

  return new Promise<ImageData | null>((resolve) => {
    dispatchOrQueue(clipKey, {
      payload,
      requestTimeoutMs,
      resolve,
      target: options.renderer,
      targetWidth,
      targetHeight,
    });
  });
}

function upscaleMask(mask: ImageData, targetWidth: number, targetHeight: number): ImageData {
  if (mask.width === targetWidth && mask.height === targetHeight) return mask;
  const tempCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(mask.width, mask.height)
    : document.createElement("canvas");
  tempCanvas.width = mask.width;
  tempCanvas.height = mask.height;
  const tempCtx = tempCanvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!tempCtx) return mask;
  tempCtx.putImageData(mask, 0, 0);

  const outCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(targetWidth, targetHeight)
    : document.createElement("canvas");
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;
  const outCtx = outCanvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!outCtx) return mask;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
  return outCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Creates an isolated subject cutout canvas from a source frame and alpha mask.
 * Uses hardware-accelerated Canvas2D composite operation 'source-in'.
 */
export function createCutoutCanvas(
  source: CanvasImageSource,
  mask: ImageData,
): HTMLCanvasElement {
  const width = mask.width;
  const height = mask.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return canvas;

  ctx.putImageData(mask, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(source, 0, 0, width, height);

  return canvas;
}
