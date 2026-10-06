/**
 * Evaluation Module - Canonical NLE Timeline Evaluation
 *
 * Architecture:
 *
 *   Timeline State (Clips / Tracks / Assets)
 *        ↓
 *   evaluateTimelineScene()  ← entry point for all rendering paths
 *        ↓
 *   EvaluatedScene           ← universal render currency
 *        ↓
 *   rasterizeScene()         ← pixel generation (rasterizer.ts)
 *
 * Naming note: the function is called evaluateTimelineScene (not evaluateScene)
 * to avoid collision with @clypra-studio/engine's evaluateScene, which operates on
 * a SceneDocument and draws directly to a Canvas 2D context.
 */

// Types
export type { EvaluatedScene, EvaluatedVisualLayer, EvaluatedMediaLayer, EvaluatedTextLayer, EvaluatedAudioLayer, EvaluatedTransition, EvaluatedEffect, EvaluatedMask, SceneMetadata, BlendMode, EvaluationCacheKey, EvaluationResult } from "./types";

// Evaluator — primary API
export { evaluateTimelineScene, evaluateTimelineSceneCached, getEvaluationCacheStats, clearEvaluationCache, invalidateEvaluationCache, normalizeFontFamily } from "./evaluator";

// Cache
export { getEvaluationCache, resetEvaluationCache, computeClipVersion } from "./cache";
export type { EvaluationCache } from "./cache";
