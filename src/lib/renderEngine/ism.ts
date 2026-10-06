/**
 * Interaction State Machine (ISM)
 *
 * Emits constraints to SRP + TSP — never selects tiers directly.
 * Emits: { velocityState, interactionState, epochTrigger }
 *
 * State machine: idle → zooming/scrubbing/scrolling → converging → idle
 *
 * Epoch triggers on (R3):
 *   - zoom level change
 *   - scroll >50% of visible width
 *   - clip modification
 *
 * Phase 1: event binding is stubbed. Real wiring happens in Phase 3 via
 * RenderRuntime.attach(timelineRef).
 */

import {
  InteractionState,
  VelocityState,
  classifyVelocity,
  type IsmUpdate,
  type ViewportBounds,
  VIEWPORT_CANCEL_FACTOR,
} from './types';

// ─── ISM Config ───────────────────────────────────────────────────────────────

const CONVERGE_TIMEOUT_MS = 200;   // no input for 200ms → converging state (R23)
const IDLE_TIMEOUT_MS = 200;       // no input after converging → idle

// ─── ISM ──────────────────────────────────────────────────────────────────────

export type IsmListener = (update: IsmUpdate) => void;

export class InteractionStateMachine {
  private _state: InteractionState = InteractionState.Idle;
  private _velocityState: VelocityState = VelocityState.Stable;
  private _zoomLevel = 1.0;
  private _viewportDensityHint = 80; // px/s
  private _viewportBounds: ViewportBounds = { x: 0, y: 0, width: 0, height: 0 };

  private _convergeTimer: ReturnType<typeof setTimeout> | null = null;
  private _idleTimer: ReturnType<typeof setTimeout> | null = null;

  private _lastScrollX = 0;
  private _listeners = new Set<IsmListener>();

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(listener: IsmListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(epochTrigger: boolean): void {
    const update: IsmUpdate = {
      zoomLevel: this._zoomLevel,
      viewportDensityHint: this._viewportDensityHint,
      velocityState: this._velocityState,
      interactionState: this._state,
      epochTrigger,
    };
    for (const listener of this._listeners) listener(update);
  }

  // ── State Transitions ─────────────────────────────────────────────────────

  private _transition(next: InteractionState, epochTrigger = false): void {
    if (this._state === next && !epochTrigger) return;
    this._state = next;
    this._emit(epochTrigger);
  }

  private _scheduleConverge(): void {
    this._clearTimers();
    this._convergeTimer = setTimeout(() => {
      this._transition(InteractionState.Converging);
      this._idleTimer = setTimeout(() => {
        this._transition(InteractionState.Idle);
      }, IDLE_TIMEOUT_MS);
    }, CONVERGE_TIMEOUT_MS);
  }

  private _clearTimers(): void {
    if (this._convergeTimer !== null) {
      clearTimeout(this._convergeTimer);
      this._convergeTimer = null;
    }
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  // ── Input Handlers (called by RenderRuntime.attach in Phase 3) ────────────

  onZoom(newZoomLevel: number, velocityPxPerS = 0): void {
    const prevZoom = this._zoomLevel;
    this._zoomLevel = newZoomLevel;
    this._velocityState = classifyVelocity(velocityPxPerS);

    const epochTrigger = prevZoom.toFixed(4) !== newZoomLevel.toFixed(4);
    this._transition(InteractionState.Zooming, epochTrigger);
    this._scheduleConverge();
  }

  onScroll(scrollX: number, viewportBounds: ViewportBounds, velocityPxPerS = 0): void {
    this._velocityState = classifyVelocity(velocityPxPerS);
    this._viewportBounds = viewportBounds;

    const shiftFraction = viewportBounds.width > 0
      ? Math.abs(scrollX - this._lastScrollX) / viewportBounds.width
      : 0;

    const epochTrigger = shiftFraction > 0.5; // R3: >50% visible width
    this._lastScrollX = scrollX;

    this._transition(InteractionState.Scrolling, epochTrigger);
    this._scheduleConverge();
  }

  onScrub(velocityPxPerS = 0): void {
    this._velocityState = classifyVelocity(velocityPxPerS);
    this._transition(InteractionState.Scrubbing);
    this._scheduleConverge();
  }

  onClipModified(): void {
    // Always triggers epoch validation (R3)
    this._transition(this._state, /* epochTrigger */ true);
  }

  onViewportUpdate(bounds: ViewportBounds, densityHint: number): void {
    this._viewportBounds = bounds;
    this._viewportDensityHint = densityHint;
    // Viewport update alone doesn't change interaction state
    this._emit(false);
  }

  // ── Attach / Detach (Phase 1: stubbed) ───────────────────────────────────

  /**
   * Phase 1 stub: event binding is wired in Phase 3 via RenderRuntime.attach().
   * Returns a cleanup function.
   */
  attach(_target: EventTarget): () => void {
    // Phase 3 implementation will add real scroll/zoom/pointer listeners here
    return () => {};
  }

  detach(): void {
    this._clearTimers();
    this._listeners.clear();
  }

  // ── Read State ────────────────────────────────────────────────────────────

  get currentState(): InteractionState { return this._state; }
  get currentVelocityState(): VelocityState { return this._velocityState; }
  get currentZoomLevel(): number { return this._zoomLevel; }
  get currentViewportDensity(): number { return this._viewportDensityHint; }
}
