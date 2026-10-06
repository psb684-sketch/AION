import { telemetryCollector } from "@/services/telemetryCollector";

export type SeekMode = "playback" | "scrub" | "seek" | "frameStep";
export type SeekQuality = "full" | "half" | "quarter" | "proxy";
export type SeekSource =
  | "timeline-click-seek"
  | "keyboard-seek"
  | "playhead"
  | "preview-transport"
  | "scrub"
  | string;

export interface SeekIntentInput {
  time: number;
  mode: SeekMode;
  source?: SeekSource;
  velocityPxPerSecond?: number;
  quality?: SeekQuality;
  targetFrame?: number;
  isScrubbing?: boolean;
  isSettling?: boolean;
  allowKeyframeApprox?: boolean;
  scrubSpanId?: string;
}

export interface SeekIntent extends SeekIntentInput {
  generation: number;
  requestId: string;
  issuedAtMs: number;
  source: SeekSource;
  velocityPxPerSecond: number;
  quality: SeekQuality;
  isScrubbing: boolean;
  isSettling: boolean;
  allowKeyframeApprox: boolean;
  scrubSpanId?: string;
}

export type SeekIntentListener = (intent: SeekIntent) => void;

export function qualityForScrubVelocity(velocityPxPerSecond: number): SeekQuality {
  const velocity = Math.abs(Number.isFinite(velocityPxPerSecond) ? velocityPxPerSecond : 0);
  if (velocity >= 2_400) return "quarter";
  if (velocity >= 900) return "half";
  return "full";
}

/**
 * Latest-request-wins controller shared by transport input and asynchronous
 * preview consumers. It deliberately contains no React or renderer state.
 */
export class SeekController {
  public static readonly SETTLE_DEBOUNCE_MS = 60;

  private generation = 0;
  private currentIntent: SeekIntent | null = null;
  private listeners = new Set<SeekIntentListener>();
  private disposed = false;
  private activeScrubSpanId: string | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  request(input: SeekIntentInput): SeekIntent {
    if (this.disposed) {
      throw new Error("SeekController is disposed");
    }

    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }

    if (this.currentIntent && this.activeScrubSpanId) {
      telemetryCollector.recordScrubSuperseded(this.activeScrubSpanId);
    }

    const velocity = Number.isFinite(input.velocityPxPerSecond)
      ? input.velocityPxPerSecond ?? 0
      : 0;
    const isScrubbing = input.isScrubbing ?? (input.mode === "scrub");
    const isSettling = input.isSettling ?? false;

    let allowKeyframeApprox: boolean;
    if (input.allowKeyframeApprox !== undefined) {
      allowKeyframeApprox = input.allowKeyframeApprox;
    } else if (isSettling || input.mode === "frameStep") {
      allowKeyframeApprox = false;
    } else if (input.mode === "scrub" || input.mode === "seek") {
      allowKeyframeApprox = true;
    } else {
      allowKeyframeApprox = false;
    }

    const quality = input.quality ?? (
      input.mode === "scrub"
        ? qualityForScrubVelocity(velocity)
        : allowKeyframeApprox
          ? "quarter"
          : "full"
    );
    const source = input.source ?? (input.mode === "scrub" ? "scrub" : "seek");

    const intent: SeekIntent = {
      ...input,
      generation: ++this.generation,
      requestId: `seek-${this.generation}`,
      issuedAtMs: performance.now(),
      source,
      velocityPxPerSecond: velocity,
      quality,
      isScrubbing,
      isSettling,
      allowKeyframeApprox,
      scrubSpanId: input.scrubSpanId ?? (this.activeScrubSpanId || undefined),
    };
    this.currentIntent = intent;
    this.listeners.forEach((listener) => listener(intent));

    // Two-Stage Coarse-to-Fine Pipeline:
    // When a coarse seek request is made outside of active scrubbing,
    // schedule a fine settling pass (allowKeyframeApprox: false, isSettling: true)
    // after SETTLE_DEBOUNCE_MS so the preview refines to the exact frame.
    if (
      !isSettling &&
      !isScrubbing &&
      allowKeyframeApprox &&
      input.mode === "seek"
    ) {
      this.settleTimer = setTimeout(() => {
        this.settleTimer = null;
        if (!this.disposed && this.currentIntent === intent) {
          this.request({
            ...input,
            mode: "seek",
            isSettling: true,
            allowKeyframeApprox: false,
            quality: "full",
            source: input.source ?? "seek",
          });
        }
      }, SeekController.SETTLE_DEBOUNCE_MS);
    }

    return intent;
  }

  beginScrub(input: { time: number; source?: SeekSource }): SeekIntent {
    this.activeScrubSpanId = telemetryCollector.beginScrubSpan(
      input.time,
      input.source ?? "playhead",
    );
    return this.request({
      time: input.time,
      mode: "scrub",
      source: input.source ?? "scrub",
      isScrubbing: true,
      isSettling: false,
      allowKeyframeApprox: true,
      quality: "proxy",
      scrubSpanId: this.activeScrubSpanId,
    });
  }

  updateScrub(input: { time: number; velocityPxPerSecond?: number }): SeekIntent {
    if (this.activeScrubSpanId) {
      telemetryCollector.recordScrubUpdate(this.activeScrubSpanId);
    }
    const velocity = input.velocityPxPerSecond ?? 0;
    return this.request({
      time: input.time,
      mode: "scrub",
      source: "scrub",
      velocityPxPerSecond: velocity,
      isScrubbing: true,
      isSettling: false,
      allowKeyframeApprox: true,
      quality: qualityForScrubVelocity(velocity),
      scrubSpanId: this.activeScrubSpanId ?? undefined,
    });
  }

  endScrub(input: { time: number }): SeekIntent {
    const scrubSpanId = this.activeScrubSpanId;
    this.activeScrubSpanId = null;
    return this.request({
      time: input.time,
      mode: "seek",
      source: "scrub",
      isScrubbing: false,
      isSettling: true,
      allowKeyframeApprox: false,
      quality: "full",
      scrubSpanId: scrubSpanId ?? undefined,
    });
  }

  getActiveScrubSpanId(): string | null {
    return this.activeScrubSpanId;
  }

  invalidate(): number {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.disposed) return this.generation;
    this.generation += 1;
    this.currentIntent = null;
    this.activeScrubSpanId = null;
    return this.generation;
  }

  getGeneration(): number {
    return this.generation;
  }

  getCurrent(): SeekIntent | null {
    return this.currentIntent;
  }

  isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  subscribe(listener: SeekIntentListener): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.disposed = true;
    this.generation += 1;
    this.currentIntent = null;
    this.activeScrubSpanId = null;
    this.listeners.clear();
  }
}
