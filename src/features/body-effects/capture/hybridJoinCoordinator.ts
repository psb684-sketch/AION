/**
 * Hybrid Subject Capture Join Coordinator
 *
 * Coordinates concurrent silhouette mask and skeletal pose tasks using
 * Promise.allSettled with per-track staleness fallback and telemetry tracing.
 */

import type { SkeletalPoseData } from "@clypra-studio/types";
import { traceCutoutEvent } from "@/core/playback/cutoutPipelineTrace";
import { telemetryCollector } from "@/services/telemetryCollector";

export interface SubjectCaptureState {
  lastValidMask: ImageData | null;
  lastValidPose: SkeletalPoseData | null;
  lastMaskTimestampUs: number;
  lastPoseTimestampUs: number;
}

export interface HybridJoinResult {
  mask: ImageData | null;
  pose: SkeletalPoseData | null;
  isDegraded: boolean;
  maskSource: "fresh" | "stale" | "missing";
  poseSource: "fresh" | "stale" | "missing";
}

const MAX_STALE_TOLERANCE_US = 250_000; // 250ms

export async function joinHybridSubjectCapture(
  clipId: string,
  targetTimestampUs: number,
  maskPromise: Promise<ImageData | null>,
  posePromise: Promise<SkeletalPoseData | null>,
  state: SubjectCaptureState,
  deadlineMs = 60,
): Promise<HybridJoinResult> {
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), deadlineMs),
  );

  const [maskOutcome, poseOutcome] = await Promise.allSettled([
    Promise.race([maskPromise, timeoutPromise]),
    Promise.race([posePromise, timeoutPromise]),
  ]);

  let resolvedMask: ImageData | null = null;
  let resolvedPose: SkeletalPoseData | null = null;
  let maskSource: "fresh" | "stale" | "missing" = "missing";
  let poseSource: "fresh" | "stale" | "missing" = "missing";

  // 1. Evaluate Mask Outcome
  if (maskOutcome.status === "fulfilled" && maskOutcome.value !== "timeout" && maskOutcome.value) {
    resolvedMask = maskOutcome.value;
    state.lastValidMask = resolvedMask;
    state.lastMaskTimestampUs = targetTimestampUs;
    maskSource = "fresh";
  } else {
    const maskAgeUs = targetTimestampUs - state.lastMaskTimestampUs;
    if (state.lastValidMask && maskAgeUs <= MAX_STALE_TOLERANCE_US) {
      resolvedMask = state.lastValidMask;
      maskSource = "stale";
    }
  }

  // 2. Evaluate Pose Outcome
  if (poseOutcome.status === "fulfilled" && poseOutcome.value !== "timeout" && poseOutcome.value) {
    resolvedPose = poseOutcome.value;
    state.lastValidPose = resolvedPose;
    state.lastPoseTimestampUs = targetTimestampUs;
    poseSource = "fresh";
  } else {
    const poseAgeUs = targetTimestampUs - state.lastPoseTimestampUs;
    if (state.lastValidPose && poseAgeUs <= MAX_STALE_TOLERANCE_US) {
      resolvedPose = state.lastValidPose;
      poseSource = "stale";
    }
  }

  const isDegraded = maskSource === "stale" || poseSource === "stale";

  // 3. Diagnostics & Telemetry
  if (isDegraded) {
    const maskAgeUs = targetTimestampUs - state.lastMaskTimestampUs;
    const poseAgeUs = targetTimestampUs - state.lastPoseTimestampUs;

    traceCutoutEvent(
      "segment",
      `Subject capture degraded for clip '${clipId}' (mask: ${maskSource}, pose: ${poseSource})`,
      {
        clipId,
        targetTimestampUs,
        maskSource,
        poseSource,
        maskAgeUs,
        poseAgeUs,
      },
      "warn",
    );

    telemetryCollector.recordFallbackEvent(
      "hybrid-subject-capture",
      "stale-cache",
      `Stale fallback triggered (maskAge: ${(maskAgeUs / 1000).toFixed(1)}ms, poseAge: ${(poseAgeUs / 1000).toFixed(1)}ms)`,
    );
  }

  return {
    mask: resolvedMask,
    pose: resolvedPose,
    isDegraded,
    maskSource,
    poseSource,
  };
}
