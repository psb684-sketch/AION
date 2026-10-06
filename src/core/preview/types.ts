/**
 * Types for the Program Preview Layout Engine & Dual-Surface Coordinator.
 */

export type PreviewFitnessMode = "fit" | "fill" | "100%" | "custom";

export interface PreviewLayoutInput {
  /** Sequence / Project canvas width (e.g. 1920 or 1080) */
  canvasWidth: number;
  /** Sequence / Project canvas height (e.g. 1080 or 1920) */
  canvasHeight: number;
  /** Current DOM container width in CSS pixels */
  containerWidth: number;
  /** Current DOM container height in CSS pixels */
  containerHeight: number;
  /** Fitness mode: 'fit' (default letterbox/pillarbox), 'fill', '100%' or 'custom' */
  mode?: PreviewFitnessMode;
  /** Uniform safety inset padding in CSS pixels (default: 0) */
  padding?: number;
  /** Viewport zoom multiplier (1.0 = normal) */
  zoom?: number;
  /** Pan horizontal offset in screen pixels */
  panX?: number;
  /** Pan vertical offset in screen pixels */
  panY?: number;
  /** Display device pixel ratio for physical pixel quantization */
  devicePixelRatio?: number;
}

export interface PreviewLayoutResult {
  /** Base scale factor mapping sequence canvas to container area (zoom-exclusive) */
  scale: number;
  /** Horizontal offset in container CSS pixels (includes pan, integer-snapped) */
  offsetX: number;
  /** Vertical offset in container CSS pixels (includes pan, integer-snapped) */
  offsetY: number;
  /** Display width in CSS pixels (snapped to even integer) */
  displayWidth: number;
  /** Display height in CSS pixels (snapped to even integer) */
  displayHeight: number;
  /** Physical device width in pixels (snapped to even integer) */
  physicalWidth: number;
  /** Physical device height in pixels (snapped to even integer) */
  physicalHeight: number;
  /** Aspect ratio width / height */
  aspectRatio: number;
}

export type PreviewSurfaceState =
  | "paused"
  | "transitioning-to-play"
  | "playing"
  | "transitioning-to-pause";

export type SurfacePresentationMode =
  | "webview-canvas"
  | "native-direct-surface";
