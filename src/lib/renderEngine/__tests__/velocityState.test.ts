import { describe, it, expect } from 'vitest';
import { classifyVelocity, VelocityState, VELOCITY_THRESHOLDS } from '../types';

describe('classifyVelocity — spec-derived thresholds (R3 + R13)', () => {
  // Stable: < 50 px/s
  it('classifies 0 px/s as Stable', () => {
    expect(classifyVelocity(0)).toBe(VelocityState.Stable);
  });
  it('classifies 49 px/s as Stable', () => {
    expect(classifyVelocity(49)).toBe(VelocityState.Stable);
  });

  // Slow: 50–100 px/s
  it('classifies 50 px/s as Slow', () => {
    expect(classifyVelocity(50)).toBe(VelocityState.Slow);
  });
  it('classifies 99 px/s as Slow', () => {
    expect(classifyVelocity(99)).toBe(VelocityState.Slow);
  });

  // Fast: 100–200 px/s (R3 epoch rejection threshold)
  it('classifies 100 px/s as Fast (R3 boundary)', () => {
    expect(classifyVelocity(100)).toBe(VelocityState.Fast);
  });
  it('classifies 199 px/s as Fast', () => {
    expect(classifyVelocity(199)).toBe(VelocityState.Fast);
  });

  // Ballistic: > 200 px/s (R13 tier-skip threshold)
  it('classifies 200 px/s as Ballistic (R13 boundary)', () => {
    expect(classifyVelocity(200)).toBe(VelocityState.Ballistic);
  });
  it('classifies 1000 px/s as Ballistic', () => {
    expect(classifyVelocity(1000)).toBe(VelocityState.Ballistic);
  });

  // Absolute value (negative velocities)
  it('treats negative velocity symmetrically', () => {
    expect(classifyVelocity(-200)).toBe(VelocityState.Ballistic);
    expect(classifyVelocity(-50)).toBe(VelocityState.Slow);
  });
});

describe('VELOCITY_THRESHOLDS — match spec requirements', () => {
  it('SLOW_MAX matches R3 epoch rejection threshold (100 px/s)', () => {
    expect(VELOCITY_THRESHOLDS.SLOW_MAX).toBe(100);
  });
  it('FAST_MAX matches R13 tier-skip threshold (200 px/s)', () => {
    expect(VELOCITY_THRESHOLDS.FAST_MAX).toBe(200);
  });
});
