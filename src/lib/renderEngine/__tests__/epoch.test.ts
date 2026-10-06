import { describe, it, expect } from 'vitest';
import { computeEpochId, validateEpoch } from '../epoch';
import {
  SpatialTier,
  TemporalTier,
  VelocityState,
  RendererMode,
  type EpochDimensions,
} from '../types';

const BASE: EpochDimensions = {
  clipId: 'clip-1',
  clipVersion: 0,
  transformGraphVersion: 0,
  viewportBounds: { x: 0, y: 0, width: 1920, height: 1080 },
  velocityState: VelocityState.Stable,
  zoomLevel: 1.0,
  spatialTier: SpatialTier.L1,
  temporalTier: TemporalTier.L1,
  rendererMode: RendererMode.Canvas2D,
};

describe('computeEpochId', () => {
  it('is deterministic for same dimensions', () => {
    expect(computeEpochId(BASE)).toBe(computeEpochId({ ...BASE }));
  });
  it('changes on clipId change', () => {
    expect(computeEpochId(BASE)).not.toBe(computeEpochId({ ...BASE, clipId: 'clip-2' }));
  });
  it('changes on clipVersion change', () => {
    expect(computeEpochId(BASE)).not.toBe(computeEpochId({ ...BASE, clipVersion: 1 }));
  });
  it('changes on spatialTier change', () => {
    expect(computeEpochId(BASE)).not.toBe(computeEpochId({ ...BASE, spatialTier: SpatialTier.L2 }));
  });
  it('changes on rendererMode change', () => {
    expect(computeEpochId(BASE)).not.toBe(computeEpochId({ ...BASE, rendererMode: RendererMode.WebGL }));
  });
  it('is stable for zoom noise within 4 decimal places', () => {
    const a = computeEpochId({ ...BASE, zoomLevel: 1.00001 });
    const b = computeEpochId({ ...BASE, zoomLevel: 1.00002 });
    // Both round to 1.0000 → same epoch
    expect(a).toBe(b);
  });
  it('changes for meaningful zoom change', () => {
    const a = computeEpochId({ ...BASE, zoomLevel: 1.0 });
    const b = computeEpochId({ ...BASE, zoomLevel: 1.5 });
    expect(a).not.toBe(b);
  });
});

describe('validateEpoch — rejection reasons', () => {
  it('is valid when dimensions are unchanged', () => {
    const result = validateEpoch(BASE, BASE);
    expect(result.valid).toBe(true);
  });
  it('rejects on clipId change', () => {
    const result = validateEpoch(BASE, { ...BASE, clipId: 'clip-2' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('clip-id-changed');
  });
  it('rejects on clipVersion change', () => {
    const result = validateEpoch(BASE, { ...BASE, clipVersion: 1 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('clip-version-changed');
  });
  it('rejects on spatialTier change', () => {
    const result = validateEpoch(BASE, { ...BASE, spatialTier: SpatialTier.L3 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('spatial-tier-changed');
  });
  it('rejects on rendererMode change', () => {
    const result = validateEpoch(BASE, { ...BASE, rendererMode: RendererMode.WebGL });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('renderer-mode-changed');
  });
  it('rejects when velocity crosses Fast boundary (R3)', () => {
    // Stable → Fast: crosses the Fast boundary
    const result = validateEpoch(
      { ...BASE, velocityState: VelocityState.Stable },
      { ...BASE, velocityState: VelocityState.Fast },
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('velocity-crossed-fast-boundary');
  });
  it('does NOT reject for Stable → Slow (within same side of boundary)', () => {
    const result = validateEpoch(
      { ...BASE, velocityState: VelocityState.Stable },
      { ...BASE, velocityState: VelocityState.Slow },
    );
    // Both below Fast — no boundary crossing
    expect(result.valid).toBe(true);
  });
  it('rejects on viewport shift >50% width (R3)', () => {
    const result = validateEpoch(BASE, {
      ...BASE,
      viewportBounds: { x: 1100, y: 0, width: 1920, height: 1080 }, // shifted >50% of 1920
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('viewport-shift-major');
  });
  it('accepts viewport shift ≤50% width', () => {
    const result = validateEpoch(BASE, {
      ...BASE,
      viewportBounds: { x: 800, y: 0, width: 1920, height: 1080 }, // shifted <50%
    });
    expect(result.valid).toBe(true);
  });
});
