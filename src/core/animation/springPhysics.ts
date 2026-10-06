/**
 * Analytical Second-Order Damped Harmonic Oscillator (Spring Physics).
 *
 * Provides closed-form, O(1) time-independent evaluation of spring dynamics
 * for video playback, scrubbing, and frame rendering.
 *
 * Differential Equation:
 *   m * x''(t) + c * x'(t) + k * (x(t) - target) = 0
 *
 * Where:
 *   m = mass
 *   k = stiffness
 *   c = damping
 *   omega_0 = sqrt(k / m)  (undamped natural frequency)
 *   zeta = c / (2 * sqrt(k * m))  (damping ratio)
 */

export interface SpringConfig {
  /** Stiffness (spring constant k). Controls frequency / speed. Default: 100 */
  stiffness: number;
  /** Damping coefficient (c). Controls oscillation decay. Default: 10 */
  damping: number;
  /** Mass (m). Controls inertia. Default: 1 */
  mass: number;
  /** Initial velocity at t = 0. Default: 0 */
  initialVelocity?: number;
}

export const SPRING_PRESETS = {
  /** Crisp, snappy pop with minimal overshoot (~5%) */
  snappy: { stiffness: 220, damping: 20, mass: 1, initialVelocity: 0 } as SpringConfig,
  /** Noticeable, energetic bounce (~20% overshoot) */
  bouncy: { stiffness: 180, damping: 12, mass: 1, initialVelocity: 0 } as SpringConfig,
  /** Heavy, exaggerated wobble with multiple oscillations */
  wobbly: { stiffness: 150, damping: 8, mass: 1, initialVelocity: 0 } as SpringConfig,
  /** Critically damped, smooth and gentle with zero overshoot */
  gentle: { stiffness: 120, damping: 22, mass: 1, initialVelocity: 0 } as SpringConfig,
  /** Fast punch with rapid deceleration */
  stiff: { stiffness: 350, damping: 28, mass: 1, initialVelocity: 0 } as SpringConfig,
} as const;

export type SpringPresetName = keyof typeof SPRING_PRESETS;

/**
 * Evaluates an analytical spring transition from 0 to 1 at normalized progress t in [0, 1].
 *
 * @param progress Normalized progress between 0 and 1 along the keyframe span.
 * @param config Spring parameters (stiffness, damping, mass, initialVelocity).
 * @returns Evaluated displacement (typically starts at 0, overshoots > 1, settles at 1).
 */
export function evaluateSpringProgress(
  progress: number,
  config: Partial<SpringConfig> = {}
): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const m = Math.max(0.001, config.mass ?? 1);
  const k = Math.max(0.001, config.stiffness ?? 180);
  const c = Math.max(0, config.damping ?? 12);
  const v0 = config.initialVelocity ?? 0;

  // We map normalized progress [0, 1] to simulation time t in seconds.
  // Standard duration scaling: 1 full unit of progress represents ~0.8s of real physical time.
  const timeScale = 0.8;
  const t = progress * timeScale;

  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  // Target is 1.0, initial displacement is x(0) = 0, so initial error x(0) - target = -1.0.
  const x0 = -1.0;

  let displacementFromTarget: number;

  if (zeta < 1.0) {
    // Underdamped: Oscillates with decaying amplitude
    const omegaD = omega0 * Math.sqrt(1.0 - zeta * zeta);
    const decay = Math.exp(-zeta * omega0 * t);
    const c1 = x0;
    const c2 = (v0 + zeta * omega0 * x0) / omegaD;
    displacementFromTarget = decay * (c1 * Math.cos(omegaD * t) + c2 * Math.sin(omegaD * t));
  } else if (Math.abs(zeta - 1.0) < 1e-5) {
    // Critically damped: Returns to equilibrium as fast as possible without oscillating
    const decay = Math.exp(-omega0 * t);
    const c1 = x0;
    const c2 = v0 + omega0 * x0;
    displacementFromTarget = decay * (c1 + c2 * t);
  } else {
    // Overdamped: Sluggish return to equilibrium
    const omegaD = omega0 * Math.sqrt(zeta * zeta - 1.0);
    const r1 = -zeta * omega0 + omegaD;
    const r2 = -zeta * omega0 - omegaD;
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    displacementFromTarget = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }

  // Value is target (1.0) + displacementFromTarget
  return 1.0 + displacementFromTarget;
}

/**
 * Evaluate spring motion at absolute time (seconds) relative to duration.
 */
export function evaluateSpring(
  t: number,
  duration: number,
  config: Partial<SpringConfig> = {}
): number {
  if (duration <= 0) return t >= 0 ? 1 : 0;
  const progress = Math.max(0, Math.min(1, t / duration));
  return evaluateSpringProgress(progress, config);
}
