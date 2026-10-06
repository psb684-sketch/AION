/**
 * Comprehensive Animation Curve Presets & Evaluator Factory.
 *
 * Provides standardized Bézier control points, kinetic curves (Overshoot, Bounce),
 * Speed curve profiles (Hero, Bullet, Montage), and Spring physics configurations.
 */

import { solveCubicBezier, type BezierControlPoints } from "./cubicBezier";
import { evaluateSpringProgress, SPRING_PRESETS, type SpringConfig } from "./springPhysics";

export interface CurvePreset {
  id: string;
  name: string;
  category: "standard" | "kinetic" | "speed" | "spring";
  controlPoints?: BezierControlPoints;
  spring?: SpringConfig;
  description: string;
}

export const CURVE_PRESETS: Record<string, CurvePreset> = {
  // ── Standard Easing ──────────────────────────────────────────────────────────
  linear: {
    id: "linear",
    name: "Linear",
    category: "standard",
    controlPoints: [0.0, 0.0, 1.0, 1.0],
    description: "Constant uniform velocity without acceleration.",
  },
  easeIn: {
    id: "easeIn",
    name: "Ease In",
    category: "standard",
    controlPoints: [0.42, 0.0, 1.0, 1.0],
    description: "Starts slowly, accelerating smoothly towards end.",
  },
  easeOut: {
    id: "easeOut",
    name: "Ease Out",
    category: "standard",
    controlPoints: [0.0, 0.0, 0.58, 1.0],
    description: "Fast departure with gentle, smooth deceleration.",
  },
  easeInOut: {
    id: "easeInOut",
    name: "Ease In-Out",
    category: "standard",
    controlPoints: [0.42, 0.0, 0.58, 1.0],
    description: "Smooth acceleration followed by smooth deceleration.",
  },
  easeInCubic: {
    id: "easeInCubic",
    name: "Ease In (Cubic)",
    category: "standard",
    controlPoints: [0.32, 0.0, 0.67, 0.0],
    description: "Pronounced acceleration toward the end.",
  },
  easeOutCubic: {
    id: "easeOutCubic",
    name: "Ease Out (Cubic)",
    category: "standard",
    controlPoints: [0.33, 1.0, 0.68, 1.0],
    description: "Natural organic deceleration.",
  },
  easeInOutCubic: {
    id: "easeInOutCubic",
    name: "Ease In-Out (Cubic)",
    category: "standard",
    controlPoints: [0.65, 0.0, 0.35, 1.0],
    description: "Pronounced cinematic slow-in, fast-transit, slow-out.",
  },
  easeInQuad: {
    id: "easeInQuad",
    name: "Ease In (Quadratic)",
    category: "standard",
    controlPoints: [0.11, 0.0, 0.5, 0.0],
    description: "Gentle acceleration.",
  },
  easeOutQuad: {
    id: "easeOutQuad",
    name: "Ease Out (Quadratic)",
    category: "standard",
    controlPoints: [0.5, 1.0, 0.89, 1.0],
    description: "Gentle deceleration.",
  },
  easeInExpo: {
    id: "easeInExpo",
    name: "Ease In (Exponential)",
    category: "standard",
    controlPoints: [0.7, 0.0, 0.84, 0.0],
    description: "Slow start with ultra-fast final burst.",
  },
  easeOutExpo: {
    id: "easeOutExpo",
    name: "Ease Out (Exponential)",
    category: "standard",
    controlPoints: [0.16, 1.0, 0.3, 1.0],
    description: "High-speed initial burst with ultra-soft landing.",
  },

  // ── Kinetic / Character Curves ──────────────────────────────────────────────
  easeOutBack: {
    id: "easeOutBack",
    name: "Overshoot (Back)",
    category: "kinetic",
    controlPoints: [0.34, 1.56, 0.64, 1.0],
    description: "Dynamic pop-in that slightly exceeds destination and snaps back.",
  },
  easeInBack: {
    id: "easeInBack",
    name: "Anticipate (Wind-up)",
    category: "kinetic",
    controlPoints: [0.36, 0.0, 0.66, -0.56],
    description: "Pulls back before launching forward.",
  },
  easeInOutBack: {
    id: "easeInOutBack",
    name: "Anticipate & Overshoot",
    category: "kinetic",
    controlPoints: [0.68, -0.6, 0.32, 1.6],
    description: "Wind-up start with an exaggerated overshoot landing.",
  },

  // ── Speed Curves (CapCut / Action Style) ─────────────────────────────────────
  speedHero: {
    id: "speedHero",
    name: "Hero Curve",
    category: "speed",
    controlPoints: [0.1, 0.9, 0.2, 1.0],
    description: "Punchy, stylized motion emphasizing impact.",
  },
  speedBullet: {
    id: "speedBullet",
    name: "Bullet Velocity",
    category: "speed",
    controlPoints: [0.05, 0.7, 0.1, 1.0],
    description: "Instant snap into a long, satisfying glide.",
  },
  speedMontage: {
    id: "speedMontage",
    name: "Montage Transit",
    category: "speed",
    controlPoints: [0.8, 0.0, 0.2, 1.0],
    description: "Aggressive S-curve for rhythmic fast cuts.",
  },

  // ── Spring Physics ──────────────────────────────────────────────────────────
  springSnappy: {
    id: "springSnappy",
    name: "Snappy Spring",
    category: "spring",
    spring: SPRING_PRESETS.snappy,
    description: "Crisp UI bounce with high rigidity.",
  },
  springBouncy: {
    id: "springBouncy",
    name: "Bouncy Spring",
    category: "spring",
    spring: SPRING_PRESETS.bouncy,
    description: "Elastic, playful spring with visible oscillation.",
  },
  springGentle: {
    id: "springGentle",
    name: "Gentle Spring",
    category: "spring",
    spring: SPRING_PRESETS.gentle,
    description: "Subtle physics-modeled smooth deceleration.",
  },
};

/**
 * Returns an evaluation function mapping progress [0, 1] to output value.
 */
export function getCurveEvaluator(
  easing: string = "linear",
  customPoints?: BezierControlPoints,
  customSpring?: SpringConfig
): (progress: number) => number {
  // 1. Explicit spring configuration
  if (customSpring) {
    return (p: number) => evaluateSpringProgress(p, customSpring);
  }

  // 2. Explicit custom Bézier control points
  if (customPoints && customPoints.length === 4) {
    const [x1, y1, x2, y2] = customPoints;
    return (p: number) => solveCubicBezier(x1, y1, x2, y2, p);
  }

  // 3. Normalized alias mapping
  const normalizedKey = easing === "ease-in"
    ? "easeIn"
    : easing === "ease-out"
      ? "easeOut"
      : easing === "ease-in-out"
        ? "easeInOut"
        : easing;

  if (normalizedKey === "linear") {
    return (p: number) => p;
  }

  const preset = CURVE_PRESETS[normalizedKey];

  if (preset) {
    if (preset.spring) {
      const springCfg = preset.spring;
      return (p: number) => evaluateSpringProgress(p, springCfg);
    }
    if (preset.controlPoints) {
      const [x1, y1, x2, y2] = preset.controlPoints;
      return (p: number) => solveCubicBezier(x1, y1, x2, y2, p);
    }
  }

  // Fallback: Special mathematical easings
  switch (easing) {
    case "easeOutBounce":
    case "bounce":
      return evaluateBounceOut;
    case "easeInBounce":
      return (p: number) => 1.0 - evaluateBounceOut(1.0 - p);
    case "easeInOutBounce":
      return (p: number) =>
        p < 0.5
          ? (1.0 - evaluateBounceOut(1.0 - 2.0 * p)) * 0.5
          : 0.5 + evaluateBounceOut(2.0 * p - 1.0) * 0.5;
    case "exponential":
      return (p: number) => (p === 0 ? 0 : Math.pow(2, 10 * (p - 1)));
    case "hold":
      return (p: number) => (p >= 1.0 ? 1.0 : 0.0);
    default:
      return (p: number) => p;
  }
}

/**
 * Standard bouncing ball closed-form solver.
 */
function evaluateBounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const adjusted = t - 1.5 / d1;
    return n1 * adjusted * adjusted + 0.75;
  } else if (t < 2.5 / d1) {
    const adjusted = t - 2.25 / d1;
    return n1 * adjusted * adjusted + 0.9375;
  } else {
    const adjusted = t - 2.625 / d1;
    return n1 * adjusted * adjusted + 0.984375;
  }
}
