/**
 * PreviewSurfaceCoordinator
 *
 * Formal state machine managing the dual-surface presentation lifecycle
 * between the HTML5 2D Canvas (WebView) and the Native OS Child Window (Tauri/wgpu).
 *
 * Invariants:
 * 1. Mode PAUSED / SCRUB / EDIT:
 *    - Presentation Mode: 'webview-canvas'
 *    - The Native Child Window is STRICTLY HIDDEN (window.hide()).
 *    - Viewport resizing runs with 0ms latency in CSS without any Tauri IPC calls.
 *    - Native surface geometry sync is debounced (100ms) in the background.
 *
 * 2. Mode PLAYING:
 *    - Presentation Mode: 'native-direct-surface'
 *    - The Native Child Window is positioned, sized, and shown (window.show()).
 *    - Renders directly on the GPU at vsync (60/120fps) without IPC readback overhead.
 *
 * 3. Transitions:
 *    - Paused -> Playing: Flushes pending geometry immediately, shows child window.
 *    - Playing -> Paused: Immediately hides child window, activates HTML5 Canvas.
 */

import {
  hideNativeSurface,
  isTauriRuntime,
} from "@/lib/platform/tauri";
import { configureNativeSurface } from "../runtime/nativeSurfaceLifecycle";
import type { NativeSurfaceGeometry } from "@/lib/platform/nativeCore";
import type { PreviewSurfaceState, SurfacePresentationMode } from "./types";

export interface SurfaceCoordinatorOptions {
  projectId: string;
  onPresentationModeChange?: (mode: SurfacePresentationMode) => void;
  onGeometrySettled?: () => void;
  debounceMs?: number;
}

export class PreviewSurfaceCoordinator {
  private projectId: string;
  private state: PreviewSurfaceState = "paused";
  private presentationMode: SurfacePresentationMode = "webview-canvas";
  private currentGeometry: NativeSurfaceGeometry | null = null;
  private appliedGeometryKey = "";
  private debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isDisposed = false;
  private syncInFlight = false;
  private pendingGeometry: NativeSurfaceGeometry | null = null;
  private onPresentationModeChange?: (mode: SurfacePresentationMode) => void;
  private onGeometrySettled?: () => void;

  constructor(options: SurfaceCoordinatorOptions) {
    this.projectId = options.projectId;
    this.debounceMs = options.debounceMs ?? 100;
    this.onPresentationModeChange = options.onPresentationModeChange;
    this.onGeometrySettled = options.onGeometrySettled;
  }

  public getState(): PreviewSurfaceState {
    return this.state;
  }

  public getPresentationMode(): SurfacePresentationMode {
    return this.presentationMode;
  }

  public setProjectId(id: string): void {
    if (this.projectId !== id) {
      this.projectId = id;
      this.appliedGeometryKey = "";
    }
  }

  /**
   * Request a geometry update for the native child surface.
   * When paused, updates are debounced to avoid freezing the UI on Windows resize dragging.
   * When playing or when immediate=true, updates are dispatched immediately.
   */
  public updateGeometry(
    geometry: NativeSurfaceGeometry,
    immediate = false,
  ): void {
    if (this.isDisposed) return;
    this.pendingGeometry = geometry;

    if (immediate || this.state === "playing") {
      this.cancelDebounce();
      void this.flushGeometry();
    } else {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        if (!this.isDisposed) {
          void this.flushGeometry();
        }
      }, this.debounceMs);
    }
  }

  /**
   * Called when playback begins.
   * Immediately flushes any pending geometry and prepares the native child window.
   */
  public async onPlayStart(canUseNativeSurface: boolean): Promise<void> {
    if (this.isDisposed) return;
    this.cancelDebounce();

    if (canUseNativeSurface && isTauriRuntime()) {
      this.state = "transitioning-to-play";
      // Flush geometry immediately before presentation begins
      await this.flushGeometry();
      this.state = "playing";
      this.setMode("native-direct-surface");
    } else {
      this.state = "playing";
      this.setMode("webview-canvas");
    }
  }

  /**
   * Called when playback pauses or stops.
   * Immediately hides the native child window so the HTML5 canvas is visible.
   */
  public async onPlayStop(): Promise<void> {
    if (this.isDisposed) return;
    this.cancelDebounce();

    this.state = "transitioning-to-pause";
    if (isTauriRuntime()) {
      await hideNativeSurface().catch(() => undefined);
    }
    this.state = "paused";
    this.setMode("webview-canvas");
  }

  /**
   * Flush pending geometry configuration to the native surface coordinator.
   */
  public async flushGeometry(): Promise<void> {
    if (this.isDisposed || !this.pendingGeometry || !isTauriRuntime()) return;
    if (this.syncInFlight) return;

    const geometry = this.pendingGeometry;
    const geometryKey = [
      geometry.xPhysical,
      geometry.yPhysical,
      geometry.widthPhysical,
      geometry.heightPhysical,
      geometry.devicePixelRatio,
    ].join(":");

    if (geometryKey === this.appliedGeometryKey) {
      return;
    }

    this.syncInFlight = true;
    try {
      await configureNativeSurface(this.projectId, geometry);
      if (this.isDisposed) return;
      this.currentGeometry = geometry;
      this.appliedGeometryKey = geometryKey;
      this.onGeometrySettled?.();
    } catch {
      // Ignore superseded errors
    } finally {
      this.syncInFlight = false;
      // If another geometry arrived while in flight, flush it now
      if (this.pendingGeometry && this.pendingGeometry !== geometry) {
        void this.flushGeometry();
      }
    }
  }

  /**
   * Disposes timers and hides the native surface.
   */
  public dispose(): void {
    this.isDisposed = true;
    this.cancelDebounce();
    if (isTauriRuntime()) {
      void hideNativeSurface().catch(() => undefined);
    }
  }

  private cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private setMode(mode: SurfacePresentationMode): void {
    if (this.presentationMode !== mode) {
      this.presentationMode = mode;
      this.onPresentationModeChange?.(mode);
    }
  }
}
