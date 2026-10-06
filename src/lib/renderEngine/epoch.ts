/**
 * Epoch Contract
 *
 * Render_Epoch_ID is the identity token for a render result.
 * It answers: "Is it safe to commit this render?"
 *
 * 9 visual-determinism dimensions (final, post-review):
 *   clipId, clipVersion, transformGraphVersion,
 *   viewportBounds, velocityState, zoomLevel,
 *   spatialTier, temporalTier, rendererMode
 *
 * NOT in epoch (scheduler/runtime only):
 *   memoryPressureState, preloadInterferenceFlag
 *
 * Rejection thresholds per R3:
 *   - viewportBounds shifted >50% width
 *   - velocityState crossing Fast boundary (R3: >100 px/s change)
 *   - zoom state change
 *   - clip trim/swap/removal (clipVersion change)
 *   - tier change (spatial or temporal)
 *   - DPR change (affects rendererMode output)
 */

import {
  type EpochDimensions,
  type RenderEpochId,
  type ViewportBounds,
  VelocityState,
  SpatialTier,
  TemporalTier,
  RendererMode,
} from './types';

// ─── Hash ─────────────────────────────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash — fast, deterministic, synchronous.
 * Not cryptographic; purpose is unique identity per dimension combination.
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Unsigned 32-bit multiplication
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

function serializeDimensions(dims: EpochDimensions): string {
  // Viewport bounds serialised to integers (sub-pixel shifts are noise, not epoch boundaries)
  const vp = dims.viewportBounds;
  return [
    dims.clipId,
    dims.clipVersion,
    dims.transformGraphVersion,
    `${Math.round(vp.x)},${Math.round(vp.y)},${Math.round(vp.width)},${Math.round(vp.height)}`,
    dims.velocityState,
    // Zoom quantised to 4 decimal places — prevents float noise from generating new epochs
    dims.zoomLevel.toFixed(4),
    dims.spatialTier,
    dims.temporalTier,
    dims.rendererMode,
  ].join('|');
}

/**
 * Compute a deterministic RenderEpochId from 9 visual-determinism dimensions.
 * Synchronous — safe to call in render loops.
 */
export function computeEpochId(dims: EpochDimensions): RenderEpochId {
  const serialized = serializeDimensions(dims);
  const hash = fnv1a(serialized);
  return hash.toString(16).padStart(8, '0') as RenderEpochId;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type RejectionReason =
  | 'viewport-shift-major'
  | 'velocity-crossed-fast-boundary'
  | 'zoom-changed'
  | 'clip-version-changed'
  | 'spatial-tier-changed'
  | 'temporal-tier-changed'
  | 'renderer-mode-changed'
  | 'clip-id-changed';

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: RejectionReason;
  readonly newEpochId: RenderEpochId;
}

/**
 * Viewport shift threshold for epoch rejection (R3): >50% of visible width.
 */
const VIEWPORT_SHIFT_THRESHOLD = 0.5;

function viewportShiftFraction(prev: ViewportBounds, next: ViewportBounds): number {
  if (prev.width === 0) return 1;
  return Math.abs(next.x - prev.x) / prev.width;
}

/**
 * Validate whether a render job computed under `currentDims` is still safe to
 * commit given the `candidateDims` that represent the current engine state.
 *
 * Returns valid=true if the epoch is still current, or valid=false with the
 * reason for rejection so the caller can request a fresh render.
 */
export function validateEpoch(
  currentDims: EpochDimensions,
  candidateDims: EpochDimensions,
): ValidationResult {
  const newEpochId = computeEpochId(candidateDims);

  if (currentDims.clipId !== candidateDims.clipId) {
    return { valid: false, reason: 'clip-id-changed', newEpochId };
  }

  if (currentDims.clipVersion !== candidateDims.clipVersion) {
    return { valid: false, reason: 'clip-version-changed', newEpochId };
  }

  if (currentDims.spatialTier !== candidateDims.spatialTier) {
    return { valid: false, reason: 'spatial-tier-changed', newEpochId };
  }

  if (currentDims.temporalTier !== candidateDims.temporalTier) {
    return { valid: false, reason: 'temporal-tier-changed', newEpochId };
  }

  if (currentDims.rendererMode !== candidateDims.rendererMode) {
    return { valid: false, reason: 'renderer-mode-changed', newEpochId };
  }

  // Zoom state change (quantised to match epoch serialization)
  if (currentDims.zoomLevel.toFixed(4) !== candidateDims.zoomLevel.toFixed(4)) {
    return { valid: false, reason: 'zoom-changed', newEpochId };
  }

  // Velocity crossed the Fast boundary — temporal validity of viewport prediction broken (R3)
  const prevFast = currentDims.velocityState >= VelocityState.Fast;
  const nextFast = candidateDims.velocityState >= VelocityState.Fast;
  if (prevFast !== nextFast) {
    return { valid: false, reason: 'velocity-crossed-fast-boundary', newEpochId };
  }

  // Viewport shift >50% width (R3)
  const shift = viewportShiftFraction(currentDims.viewportBounds, candidateDims.viewportBounds);
  if (shift > VIEWPORT_SHIFT_THRESHOLD) {
    return { valid: false, reason: 'viewport-shift-major', newEpochId };
  }

  return { valid: true, newEpochId };
}
