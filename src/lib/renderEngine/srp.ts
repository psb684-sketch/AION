/**
 * Spatial Raster Policy (SRP)
 *
 * Maps zoom level → SpatialTier. The ONLY module allowed to make this mapping.
 * Emits: { spatialTier, textureSize, dprMultiplier }
 *
 * Rules (R1):
 *   - DPR multiplier: dpr > 1.5 ? dpr : 1.0
 *   - textureSize dims aligned to multiple of 4 (GPU compat)
 *   - Default boundaries: L0=[0.25,0.5), L1=[0.5,1), L2=[1,2), L3=[2,4)
 *   - Configurable (R15); validates ascending order; warns + resets on invalid
 *   - Quality preset filters eligible tiers (R14)
 */

import { SpatialTier, SPATIAL_TIER_DIMS, DEFAULT_SRP_CONFIG, QUALITY_PRESET_TIERS, QualityPreset, type SrpConfig, type TierBoundary } from "./types";

// ─── SRP Result ───────────────────────────────────────────────────────────────

export interface SrpResult {
  readonly spatialTier: SpatialTier;
  /** Final texture dimensions after DPR multiplication, aligned to mult of 4. */
  readonly textureSize: readonly [number, number];
  readonly dprMultiplier: number;
}

// ─── DPR ──────────────────────────────────────────────────────────────────────

/**
 * DPR multiplier per spec R1.
 * Retina displays (DPR ≥ 1.5) receive a texture scaled by their actual DPR.
 * Standard displays receive no multiplier.
 */
export function computeDprMultiplier(dpr: number): number {
  return dpr >= 1.5 ? dpr : 1.0;
}

// ─── Alignment ────────────────────────────────────────────────────────────────

/** Round up to next multiple of 4 for GPU texture compat. */
export function alignToMultipleOf4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

/** Apply DPR multiplier and align both dims to multiple of 4. */
export function computeTextureSize(baseTier: SpatialTier, dprMultiplier: number): readonly [number, number] {
  const [baseW, baseH] = SPATIAL_TIER_DIMS[baseTier];
  return [alignToMultipleOf4(Math.round(baseW * dprMultiplier)), alignToMultipleOf4(Math.round(baseH * dprMultiplier))] as const;
}

// ─── Boundary Validation ──────────────────────────────────────────────────────

/**
 * Validate SrpConfig: boundaries must be ascending, non-overlapping, 2–8 tiers.
 * Returns true if valid.
 */
export function validateSrpConfig(config: SrpConfig): boolean {
  const tiers = Object.keys(config)
    .map(Number)
    .sort((a, b) => a - b) as SpatialTier[];

  if (tiers.length < 2 || tiers.length > 8) return false;

  let prevMax = -Infinity;
  for (const tier of tiers) {
    const { min, max } = config[tier];
    if (min >= max) return false; // degenerate range
    if (min < prevMax) return false; // overlap
    prevMax = max;
  }
  return true;
}

// ─── Active Config ────────────────────────────────────────────────────────────

let _activeConfig: SrpConfig = { ...DEFAULT_SRP_CONFIG };

/**
 * Update the SRP tier boundaries (R15).
 * Falls back to defaults with a warning if the new config is invalid.
 * Re-evaluates the current tier within 16ms (caller must re-invoke computeSpatialTier).
 */
export function setSrpConfig(config: SrpConfig): void {
  if (!validateSrpConfig(config)) {
    console.warn("Invalid SRP config", config);
    _activeConfig = { ...DEFAULT_SRP_CONFIG };
    return;
  }
  _activeConfig = { ...config };
}

export function getSrpConfig(): SrpConfig {
  return _activeConfig;
}

// ─── Tier Selection ───────────────────────────────────────────────────────────

/**
 * Core SRP function: map zoom level + DPR → SpatialTier.
 *
 * @param zoomLevel   Zoom level in the range the config was designed for (default 0.25–4).
 * @param dpr         Device pixel ratio (e.g. 1.0, 2.0).
 * @param preset      Quality preset — filters which tiers are eligible (R14).
 * @returns SrpResult with spatialTier, textureSize, dprMultiplier.
 */
export function computeSpatialTier(zoomLevel: number, dpr: number, preset: QualityPreset = QualityPreset.Medium): SrpResult {
  const config = _activeConfig;
  const eligibleTiers = QUALITY_PRESET_TIERS[preset];
  const dprMultiplier = computeDprMultiplier(dpr);

  // Find the highest eligible tier whose range covers the zoom level.
  // Iterate from highest to lowest so we get the best resolution that applies.
  let selectedTier: SpatialTier = SpatialTier.L0;

  const sorted = [...eligibleTiers].sort((a, b) => b - a); // highest first
  for (const tier of sorted) {
    const boundary: TierBoundary | undefined = config[tier];
    if (!boundary) continue;
    if (zoomLevel >= boundary.min && zoomLevel < boundary.max) {
      selectedTier = tier;
      break;
    }
  }

  // Clamp to eligible range if zoom is outside all configured boundaries
  if (!sorted.some((t) => config[t] && zoomLevel >= config[t].min && zoomLevel < config[t].max)) {
    if (zoomLevel < config[sorted[sorted.length - 1]].min) {
      // Below all ranges — use lowest eligible
      selectedTier = sorted[sorted.length - 1];
    } else {
      // Above all ranges — use highest eligible
      selectedTier = sorted[0];
    }
  }

  return {
    spatialTier: selectedTier,
    textureSize: computeTextureSize(selectedTier, dprMultiplier),
    dprMultiplier,
  };
}
