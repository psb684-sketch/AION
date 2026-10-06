/**
 * Hysteresis Controller
 *
 * Prevents tier thrashing at zoom boundaries by requiring:
 *   - 10% overshoot past a boundary before updating targetTierCandidate
 *   - 200ms debounce before committing the candidate
 *   - Max 1 tier commit per 200ms
 *   - ±5% boundary zone maintains current candidate (dead band)
 *
 * Pure class — zero browser API dependencies. Safe to unit test in Node.
 */

import { SpatialTier, DEFAULT_SRP_CONFIG, type SrpConfig } from './types';

const OVERSHOOT_THRESHOLD = 0.10; // 10% past boundary required
const DEAD_BAND = 0.05;           // ±5% of boundary — no change
const COMMIT_DEBOUNCE_MS = 200;
const MAX_COMMITS_PER_WINDOW = 1; // max 1 commit per 200ms

export interface HysteresisState {
  readonly currentTier: SpatialTier;
  readonly targetTierCandidate: SpatialTier;
  readonly committedAt: number; // performance.now() of last commit
}

export class HysteresisController {
  private _current: SpatialTier;
  private _candidate: SpatialTier;
  private _candidateStableAt: number;  // when candidate first became stable
  private _lastCommitAt: number;
  private _config: SrpConfig;

  /** @param now  Monotonic clock injection for testability. Defaults to performance.now. */
  constructor(
    initialTier: SpatialTier = SpatialTier.L0,
    config: SrpConfig = DEFAULT_SRP_CONFIG,
    private readonly now: () => number = () => performance.now(),
  ) {
    this._current = initialTier;
    this._candidate = initialTier;
    this._candidateStableAt = -Infinity;
    this._lastCommitAt = -Infinity;
    this._config = config;
  }

  get currentTier(): SpatialTier { return this._current; }
  get candidateTier(): SpatialTier { return this._candidate; }

  updateConfig(config: SrpConfig): void {
    this._config = config;
  }

  /**
   * Feed a new zoom level. Returns the committed tier if a commit occurred,
   * or null if the controller is still in the debounce/hysteresis window.
   *
   * @param zoomLevel  Current zoom level.
   * @param targetTier The tier SRP would select at this zoom level (no hysteresis).
   */
  update(zoomLevel: number, targetTier: SpatialTier): SpatialTier | null {
    const t = this.now();

    // Determine boundary for current tier
    const currentBoundary = this._config[this._current];
    if (!currentBoundary) {
      // Config doesn't include current tier — commit immediately
      return this._commit(targetTier, t);
    }

    // Dead band: within ±5% of the boundary, hold current candidate
    const boundaryMin = currentBoundary.min;
    const boundaryMax = currentBoundary.max;
    const deadBandLow  = boundaryMin * (1 + DEAD_BAND);
    const deadBandHigh = boundaryMax * (1 - DEAD_BAND);

    if (zoomLevel >= deadBandLow && zoomLevel <= deadBandHigh) {
      // Inside safe zone of current tier — reset candidate if it drifted
      if (this._candidate !== this._current) {
        this._candidate = this._current;
        this._candidateStableAt = -Infinity;
      }
      return null;
    }

    // Check 10% overshoot before updating candidate
    const requiredOvershoot = targetTier !== this._current;
    if (requiredOvershoot) {
      const newCandidate = this._computeCandidateWithOvershoot(zoomLevel, targetTier, currentBoundary);
      if (newCandidate !== this._candidate) {
        this._candidate = newCandidate;
        this._candidateStableAt = t;
      }
    }

    if (this._candidate === this._current) return null;

    // Debounce: candidate must be stable for 200ms
    const stableFor = t - this._candidateStableAt;
    if (stableFor < COMMIT_DEBOUNCE_MS) return null;

    // Rate limit: max 1 commit per 200ms
    const sinceLast = t - this._lastCommitAt;
    if (sinceLast < COMMIT_DEBOUNCE_MS) return null;

    return this._commit(this._candidate, t);
  }

  private _computeCandidateWithOvershoot(
    zoomLevel: number,
    targetTier: SpatialTier,
    currentBoundary: { min: number; max: number },
  ): SpatialTier {
    if (targetTier > this._current) {
      // Zooming in — need 10% past upper boundary
      const threshold = currentBoundary.max * (1 + OVERSHOOT_THRESHOLD);
      return zoomLevel >= threshold ? targetTier : this._current;
    } else {
      // Zooming out — need 10% past lower boundary
      const threshold = currentBoundary.min * (1 - OVERSHOOT_THRESHOLD);
      return zoomLevel <= threshold ? targetTier : this._current;
    }
  }

  private _commit(tier: SpatialTier, t: number): SpatialTier {
    this._current = tier;
    this._candidate = tier;
    this._candidateStableAt = -Infinity;
    this._lastCommitAt = t;
    return tier;
  }

  /** Snapshot of current state for debugging / metrics. */
  getState(): HysteresisState {
    return {
      currentTier: this._current,
      targetTierCandidate: this._candidate,
      committedAt: this._lastCommitAt,
    };
  }

  /** Force-reset to a tier (e.g. on renderer mode change or epoch invalidation). */
  reset(tier: SpatialTier): void {
    this._current = tier;
    this._candidate = tier;
    this._candidateStableAt = -Infinity;
  }
}
