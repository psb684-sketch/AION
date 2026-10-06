/**
 * Motion Behavior & Kinetic Preset Contracts.
 *
 * Defines one-click animation presets across In (Build-In), Out (Build-Out),
 * and Loop (Continuous Emphasis) categories.
 */

import type { KeyframeEasing, KeyframeSpringConfig } from "./keyframes";

export type MotionBehaviorCategory = "in" | "out" | "loop";

export interface ClipMotionConfig {
  inPreset?: string;
  inDuration?: number;
  inEasing?: KeyframeEasing;
  inSpring?: KeyframeSpringConfig;
  inDistance?: number;

  outPreset?: string;
  outDuration?: number;
  outEasing?: KeyframeEasing;
  outSpring?: KeyframeSpringConfig;
  outDistance?: number;

  loopPreset?: string;
  loopSpeed?: number;
  loopIntensity?: number;
}

export interface MotionPresetMeta {
  id: string;
  name: string;
  category: MotionBehaviorCategory;
  description: string;
  defaultDuration?: number;
  defaultEasing?: KeyframeEasing;
  icon: string;
}
