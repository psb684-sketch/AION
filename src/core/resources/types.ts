/**
 * Render Resource Types
 *
 * Resolved media resources ready for rasterization.
 * Separates asset acquisition from rendering.
 *
 * Architecture:
 *   Asset URL → Resource Manager → RenderResource → Rasterizer
 */

/**
 * Render resource handle.
 * Opaque reference to a resolved media resource.
 */
export type RenderResourceHandle = string;

/**
 * Render resource types.
 */
export type RenderResourceType = "image-bitmap" | "video-element" | "canvas" | "placeholder";

/**
 * Resolved render resource.
 * Ready for immediate rasterization (no async loading).
 */
export interface RenderResource {
  /** Unique resource handle */
  handle: RenderResourceHandle;

  /** Resource type */
  type: RenderResourceType;

  /** Actual resource data */
  data: ImageBitmap | HTMLVideoElement | HTMLCanvasElement | null;

  /** Source URL (for debugging) */
  sourceUrl: string;

  /** Resource dimensions */
  width: number;
  height: number;

  /** Reference count (for lifecycle management) */
  refCount: number;

  /** Last access time (for LRU eviction) */
  lastAccessTime: number;
}

/**
 * Frame request specification.
 * Describes what frame to render and how.
 */
export interface FrameRequest {
  /** Timeline time */
  time: number;

  /** Output resolution */
  resolution: {
    width: number;
    height: number;
  };

  /** Pixel ratio (for high-DPI) */
  pixelRatio?: number;

  /** Color space */
  colorSpace?: "srgb" | "display-p3";

  /** Output format */
  outputFormat?: "imagebitmap" | "imagedata" | "blob";

  /** Quality (for blob output) */
  quality?: number;

  /** Priority (for scheduling) */
  priority?: "realtime" | "background" | "export";

  /** Map of active video elements (key: clipId-mediaId) to bypass decoding */
  videoElements?: Map<string, HTMLVideoElement>;

  /** Whether to skip applying track-level filters on the CPU (for GPU preview path) */
  skipFilters?: boolean;
}

/**
 * Frame result.
 */
export interface FrameResult {
  /** Frame request that produced this result */
  request: FrameRequest;

  /** Output data */
  data: ImageBitmap | ImageData | Blob;

  /** Render time in ms */
  renderTimeMs: number;

  /** Whether resources were cached */
  resourcesCached: boolean;
}
