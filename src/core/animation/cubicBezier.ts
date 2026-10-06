/**
 * High-Precision Cubic Bézier Curve Solver.
 *
 * Implements a robust Newton-Raphson numerical approximation with a bisection
 * fallback to solve y for any given x on arbitrary cubic Bézier curves [x1, y1, x2, y2].
 */

export type BezierControlPoints = [number, number, number, number];

export function createCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  // Clamp control points along X axis to [0, 1] for monotonic time function
  const cx1 = Math.max(0, Math.min(1, x1));
  const cx2 = Math.max(0, Math.min(1, x2));

  // Linear optimization shortcut
  if (cx1 === y1 && cx2 === y2) {
    return (x: number) => x;
  }

  return (x: number) => solveCubicBezier(cx1, y1, cx2, y2, x);
}

/**
 * Solves y for a given target x in [0, 1] using Newton-Raphson with bisection fallback.
 */
export function solveCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x1 === y1 && x2 === y2) return x;

  // 1. First try Newton-Raphson solver (usually converges in 4-8 iterations)
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX = sampleCurve(x1, x2, t) - x;
    if (Math.abs(currentX) < 1e-6) {
      return sampleCurve(y1, y2, t);
    }
    const derivative = sampleDerivative(x1, x2, t);
    if (Math.abs(derivative) < 1e-6) {
      break; // Derivative is near zero; fall back to bisection
    }
    t -= currentX / derivative;
    if (t < 0 || t > 1) {
      break; // Stepped out of bounds; fall back to bisection
    }
  }

  // 2. Bisection fallback if Newton-Raphson fails to converge
  let t0 = 0.0;
  let t1 = 1.0;
  t = x;

  for (let i = 0; i < 14; i++) {
    const currentX = sampleCurve(x1, x2, t);
    if (Math.abs(currentX - x) < 1e-5) {
      break;
    }
    if (x > currentX) {
      t0 = t;
    } else {
      t1 = t;
    }
    t = (t1 + t0) * 0.5;
  }

  return sampleCurve(y1, y2, t);
}

function sampleCurve(p1: number, p2: number, t: number): number {
  // 3*(1-t)^2 * t * p1 + 3*(1-t) * t^2 * p2 + t^3
  const oneMinusT = 1.0 - t;
  return (
    3.0 * oneMinusT * oneMinusT * t * p1 +
    3.0 * oneMinusT * t * t * p2 +
    t * t * t
  );
}

function sampleDerivative(p1: number, p2: number, t: number): number {
  // d/dt [ 3*(1-t)^2 * t * p1 + 3*(1-t) * t^2 * p2 + t^3 ]
  const oneMinusT = 1.0 - t;
  return (
    3.0 * oneMinusT * oneMinusT * p1 +
    6.0 * oneMinusT * t * (p2 - p1) +
    3.0 * t * t * (1.0 - p2)
  );
}
