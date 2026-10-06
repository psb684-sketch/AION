/**
 * PreviewLayoutManager
 *
 * Professional layout management engine for the Clypra Program Preview.
 *
 * Responsibilities:
 * 1. Aspect ratio preservation across all standard sequence formats (16:9, 9:16, 1:1, 4:3, 21:9).
 * 2. Even-integer pixel quantization: All CSS dimensions and physical swapchain dimensions
 *    are strictly snapped to even integers, eradicating DWM fractional subpixel jitter on Windows
 *    under 125%, 150%, and 175% DPI scaling.
 * 3. Safe viewport insets: Reserves configurable edge breathing room so video never scrapes against
 *    panel borders or transport controls.
 * 4. Cross-platform DPI parity: Generates aligned CSS and physical coordinates for both
 *    the WebView canvas and native OS child window.
 */

import type { PreviewLayoutInput, PreviewLayoutResult } from "./types";

export class PreviewLayoutManager {
  /**
   * Compute the pixel-snapped display layout for a given preview sequence and container.
   */
  public static compute(input: PreviewLayoutInput): PreviewLayoutResult {
    const {
      canvasWidth,
      canvasHeight,
      containerWidth,
      containerHeight,
      mode = "fit",
      padding = 0,
      zoom = 1.0,
      panX = 0,
      panY = 0,
      devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    } = input;

    // Guard against zero / invalid sequence dimensions
    const cWidth = Math.max(1, canvasWidth);
    const cHeight = Math.max(1, canvasHeight);
    const contWidth = Math.max(1, containerWidth);
    const contHeight = Math.max(1, containerHeight);
    const safePadding = Math.max(0, padding);

    // 1. Available safe container area
    const availableWidth = Math.max(1, contWidth - safePadding * 2);
    const availableHeight = Math.max(1, contHeight - safePadding * 2);

    // 2. Base scale (zoom-exclusive mapping from sequence canvas to safe container)
    const scaleX = availableWidth / cWidth;
    const scaleY = availableHeight / cHeight;

    let baseScale: number;
    switch (mode) {
      case "fill":
        baseScale = Math.max(scaleX, scaleY);
        break;
      case "100%":
        baseScale = 1.0;
        break;
      case "fit":
      case "custom":
      default:
        baseScale = Math.min(scaleX, scaleY);
        break;
    }

    // 3. Compute CSS display dimensions with zoom applied
    const rawDisplayWidth = cWidth * baseScale * zoom;
    const rawDisplayHeight = cHeight * baseScale * zoom;

    // Snap to even integers to prevent sub-pixel blurring and DWM window seams
    const displayWidth = Math.max(2, Math.round(rawDisplayWidth / 2) * 2);
    const displayHeight = Math.max(2, Math.round(rawDisplayHeight / 2) * 2);

    // 4. Centering offsets within container (includes pan)
    const offsetX = Math.round((contWidth - displayWidth) / 2 + panX);
    const offsetY = Math.round((contHeight - displayHeight) / 2 + panY);

    // 5. Physical swapchain coordinates (snapped to even integers for GPU texture parity)
    const physicalWidth = Math.max(2, Math.round((displayWidth * devicePixelRatio) / 2) * 2);
    const physicalHeight = Math.max(2, Math.round((displayHeight * devicePixelRatio) / 2) * 2);

    return {
      scale: baseScale,
      offsetX,
      offsetY,
      displayWidth,
      displayHeight,
      physicalWidth,
      physicalHeight,
      aspectRatio: cWidth / cHeight,
    };
  }

  /**
   * Calculate zoom factor required to fit canvas within the specified container.
   */
  public static calculateZoomToFit(
    canvasWidth: number,
    canvasHeight: number,
    containerWidth: number,
    containerHeight: number,
    padding = 0,
  ): number {
    const safeWidth = Math.max(1, containerWidth - padding * 2);
    const safeHeight = Math.max(1, containerHeight - padding * 2);
    const scaleX = safeWidth / Math.max(1, canvasWidth);
    const scaleY = safeHeight / Math.max(1, canvasHeight);
    return Math.min(scaleX, scaleY, 1.0);
  }

  /**
   * Clamp zoom to supported boundaries [min, max].
   */
  public static clampZoom(zoom: number, min = 0.1, max = 5.0): number {
    return Math.max(min, Math.min(max, zoom));
  }
}
