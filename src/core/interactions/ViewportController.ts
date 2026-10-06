/**
 * Viewport Controller - Imperative Viewport State Management
 *
 * ARCHITECTURE: Signal Plane
 * - Viewport updates at 60fps during wheel/pan (>4Hz)
 * - RAF loop reads imperatively (no React re-renders)
 * - UI subscribes for throttled updates (10fps max)
 *
 * This is NOT React state. This is an imperative viewport engine.
 *
 * Key principles:
 * - Viewport is a continuous signal during pan/zoom, not discrete state
 * - Consumers read imperatively via getViewport()
 * - No React re-renders on every wheel/pan event
 * - High-frequency updates (60fps) without React overhead
 *
 * Architecture:
 *   ViewportController (signal source)
 *       ↓
 *   Imperative consumers (render loop, transform overlay)
 *       ↓
 *   UI snapshots (throttled to 10fps)
 *
 * This prevents:
 * - React render storms during wheel zoom
 * - Pan lag (mousemove → setState → re-render → canvas update)
 * - Effect cancellation loops
 */

export interface Viewport {
  zoom: number; // 0.1 to 5.0 (10% to 500%)
  panX: number; // Screen space offset (pixels)
  panY: number; // Screen space offset (pixels)
}

export type ViewportListener = (viewport: Viewport) => void;

const VIEWPORT_ZOOM_MIN = 0.1;
const VIEWPORT_ZOOM_MAX = 5.0;
const VIEWPORT_ZOOM_SNAP_EPSILON = 0.005; // Magnetic snap band around snap targets

/**
 * Viewport Controller - Imperative viewport state.
 *
 * This is the SINGLE SOURCE OF TRUTH for viewport zoom/pan.
 * It is NOT React state. It is a continuous signal during interaction.
 */
export class ViewportController {
  private _zoom: number = 1.0;
  private _panX: number = 0;
  private _panY: number = 0;

  // Dynamic fit-zoom target — updated when canvas/container dimensions change.
  // This is the zoom level at which the canvas fits perfectly inside the container.
  // Used for magnetic snap during wheel zoom (e.g., 0.56 for 9:16 in a wide container).
  private _fitZoomTarget: number = 1.0;

  // Listeners (for UI snapshots only, not every frame)
  private _listeners = new Set<ViewportListener>();
  private _lastNotifyTime: number = 0;
  private _notifyThrottleMs: number = 100; // Notify UI max 10fps

  constructor() {
    // Bind methods for stable references
    this.setZoom = this.setZoom.bind(this);
    this.setPan = this.setPan.bind(this);
    this.reset = this.reset.bind(this);
  }

  // ─── Getters (Imperative reads) ────────────────────────────────────────────

  /**
   * Get viewport (imperative read).
   * This is how consumers should read viewport - NOT via React state.
   */
  getViewport(): Viewport {
    return {
      zoom: this._zoom,
      panX: this._panX,
      panY: this._panY,
    };
  }

  get zoom(): number {
    return this._zoom;
  }

  get panX(): number {
    return this._panX;
  }

  get panY(): number {
    return this._panY;
  }

  // ─── Viewport Control ──────────────────────────────────────────────────────

  /**
   * Set zoom level.
   * Clamps to valid range and applies magnetic snap around both:
   * - 1.0 (100% / actual pixels)
   * - fitZoomTarget (the "fit" level where canvas fills container)
   */
  setZoom(zoom: number): void {
    const prevZoom = this._zoom;
    let clamped = Math.max(VIEWPORT_ZOOM_MIN, Math.min(VIEWPORT_ZOOM_MAX, zoom));

    // Magnetic snap targets: 1.0 (100%) and the dynamic fit-zoom level.
    // We snap to whichever target the zoom is crossing through.
    const snapTargets = [1.0];
    // Only add fit target if it's meaningfully different from 1.0
    if (Math.abs(this._fitZoomTarget - 1.0) > VIEWPORT_ZOOM_SNAP_EPSILON * 2) {
      snapTargets.push(this._fitZoomTarget);
    }

    for (const target of snapTargets) {
      const prevNear = Math.abs(prevZoom - target) <= VIEWPORT_ZOOM_SNAP_EPSILON;
      const nextNear = Math.abs(clamped - target) <= VIEWPORT_ZOOM_SNAP_EPSILON;
      const crossed = (prevZoom < target && clamped > target) || (prevZoom > target && clamped < target);

      if (nextNear && (crossed || !prevNear)) {
        clamped = target;
        break; // Only snap to one target per zoom step
      }
    }

    this._zoom = clamped;
    this._throttledNotify();
  }

  /**
   * Set the dynamic fit-zoom target.
   * Call this whenever canvas or container dimensions change so that
   * magnetic snap targets the actual "fit" level instead of just 1.0.
   */
  setFitZoomTarget(fitZoom: number): void {
    this._fitZoomTarget = Math.max(VIEWPORT_ZOOM_MIN, Math.min(VIEWPORT_ZOOM_MAX, fitZoom));
  }

  /**
   * Set pan offset.
   */
  setPan(panX: number, panY: number): void {
    this._panX = panX;
    this._panY = panY;
    this._throttledNotify();
  }

  /**
   * Reset viewport to default (zoom 1.0, no pan).
   */
  reset(): void {
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
    this._notifyListeners();
  }

  /**
   * Zoom to fit canvas within viewport.
   */
  zoomToFit(canvasWidth: number, canvasHeight: number, viewportWidth: number, viewportHeight: number): void {
    const scaleX = viewportWidth / canvasWidth;
    const scaleY = viewportHeight / canvasHeight;
    const zoom = Math.min(scaleX, scaleY, 1.0); // Never zoom in beyond 100%

    this._fitZoomTarget = zoom;
    this._zoom = zoom;
    this._panX = 0;
    this._panY = 0;
    this._notifyListeners();
  }

  // ─── Subscription (For UI snapshots only) ──────────────────────────────────

  /**
   * Subscribe to viewport changes.
   * NOTE: This is for UI updates only (throttled to 10fps).
   * Render loops should read getViewport() imperatively, not via subscription.
   */
  subscribe(listener: ViewportListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify listeners (throttled).
   */
  private _throttledNotify(): void {
    const now = Date.now();
    if (now - this._lastNotifyTime > this._notifyThrottleMs) {
      this._notifyListeners();
      this._lastNotifyTime = now;
    }
  }

  /**
   * Notify listeners immediately.
   */
  private _notifyListeners(): void {
    const viewport = this.getViewport();
    this._listeners.forEach((listener) => listener(viewport));
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Dispose controller (cleanup).
   */
  dispose(): void {
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
    this._listeners.clear();
  }
}

/**
 * Global viewport controller instance.
 */
let globalController: ViewportController | null = null;

/**
 * Get or create global viewport controller.
 */
export function getViewportController(): ViewportController {
  if (!globalController) {
    globalController = new ViewportController();
  }
  return globalController;
}

/**
 * Reset global viewport controller (for testing).
 */
export function resetViewportController(): void {
  if (globalController) {
    globalController.dispose();
  }
  globalController = null;
}
