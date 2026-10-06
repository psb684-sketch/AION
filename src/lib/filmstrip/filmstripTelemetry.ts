/**
 * Filmstrip Performance & Latency Telemetry
 *
 * Instruments and dissects the end-to-end filmstrip pipeline latency:
 *   cacheLookupMs -> ipcTransferMs -> decodeMs -> bitmapCreationMs -> rasterPaintMs -> totalTimeToVisibleMs
 */

export type FilmstripSourceType =
  | "memory_tier"
  | "disk_atlas"
  | "fresh_decode"
  | "pyramid_fallback";

export interface FilmstripTileTelemetry {
  tileKey: string;
  source: FilmstripSourceType;
  cacheLookupMs: number;
  ipcTransferMs: number;
  decodeMs: number;
  bitmapCreationMs: number;
  rasterPaintMs: number;
  totalTimeToVisibleMs: number;
  /** Whether this tile was requested after a spatial-tier change. */
  requestReason?: "viewport" | "zoom";
  recordedAt: number;
}

export interface FilmstripSessionSummary {
  totalTilesRequested: number;
  memoryHits: number;
  diskAtlasHits: number;
  freshDecodes: number;
  pyramidFallbacks: number;
  hitRatePercentage: number;
  avgLookupMs: number;
  avgIpcMs: number;
  avgBitmapMs: number;
  avgPaintMs: number;
  avgTimeToVisibleMs: number;
  p95TimeToVisibleMs: number;
  zoomTiles: number;
  zoomGestures: number;
  zoomInputEvents: number;
  zoomDurationMs: number;
  zoomTierTransitions: number;
  dominantBottleneck: "native-request" | "bitmap" | "paint" | "cache-lookup" | "none";
}

import { workerPerfCollector } from "@/core/monitoring/WorkerPerfCollector";

export class FilmstripTelemetryRecorder {
  private records: FilmstripTileTelemetry[] = [];
  private paintTimesMs: number[] = [];
  private completedZoomGestures: Array<{
    durationMs: number;
    inputEvents: number;
  }> = [];
  private activeZoomGesture: { startedAt: number; inputEvents: number } | null = null;
  private zoomTierTransitions = 0;
  private readonly maxRecords: number;

  constructor(maxRecords = 1000) {
    this.maxRecords = maxRecords;
  }

  /**
   * Record a completed tile presentation lifecycle.
   */
  record(telemetry: Omit<FilmstripTileTelemetry, "recordedAt">): void {
    if (this.records.length >= this.maxRecords) {
      this.records.shift(); // Evict oldest telemetry item
    }
    this.records.push({
      ...telemetry,
      recordedAt: performance.now(),
    });
    workerPerfCollector.record({
      domain: "filmstrip:tile",
      operation: telemetry.source,
      durationMs: telemetry.totalTimeToVisibleMs,
      workerDurationMs: telemetry.decodeMs,
      overBudget: telemetry.totalTimeToVisibleMs > 16.67,
      metadata: {
        source: telemetry.source,
        cacheLookupMs: telemetry.cacheLookupMs,
        ipcTransferMs: telemetry.ipcTransferMs,
        rasterPaintMs: telemetry.rasterPaintMs,
      },
    });
  }

  /**
   * Get total count of recorded tile events.
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /** Records a batched canvas/WebGL filmstrip presentation commit. */
  recordPaintCommit(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    if (this.paintTimesMs.length >= this.maxRecords) this.paintTimesMs.shift();
    this.paintTimesMs.push(durationMs);
  }

  /** Starts or extends one wheel/trackpad zoom gesture; never records raw wheel events. */
  beginZoomGesture(): void {
    if (this.activeZoomGesture) {
      this.activeZoomGesture.inputEvents++;
      return;
    }
    this.activeZoomGesture = { startedAt: performance.now(), inputEvents: 1 };
  }

  /** Completes the compact gesture summary once input and spring motion settle. */
  endZoomGesture(): void {
    const gesture = this.activeZoomGesture;
    if (!gesture) return;
    this.activeZoomGesture = null;
    if (this.completedZoomGestures.length >= this.maxRecords) {
      this.completedZoomGestures.shift();
    }
    this.completedZoomGestures.push({
      durationMs: Math.max(0, performance.now() - gesture.startedAt),
      inputEvents: gesture.inputEvents,
    });
  }

  isZoomGestureActive(): boolean {
    return this.activeZoomGesture !== null;
  }

  recordZoomTierTransition(): void {
    if (this.activeZoomGesture) this.zoomTierTransitions++;
  }

  /**
   * Clear all recorded telemetry records.
   */
  clear(): void {
    this.records = [];
    this.paintTimesMs = [];
    this.completedZoomGestures = [];
    this.activeZoomGesture = null;
    this.zoomTierTransitions = 0;
  }

  /**
   * Generate an aggregated performance summary for the current session.
   */
  getSummary(): FilmstripSessionSummary {
    const total = this.records.length;
    if (total === 0) {
      return {
        totalTilesRequested: 0,
        memoryHits: 0,
        diskAtlasHits: 0,
        freshDecodes: 0,
        pyramidFallbacks: 0,
        hitRatePercentage: 0,
        avgLookupMs: 0,
        avgIpcMs: 0,
        avgBitmapMs: 0,
        avgPaintMs: 0,
        avgTimeToVisibleMs: 0,
        p95TimeToVisibleMs: 0,
        zoomTiles: 0,
        zoomGestures: 0,
        zoomInputEvents: 0,
        zoomDurationMs: 0,
        zoomTierTransitions: 0,
        dominantBottleneck: "none",
      };
    }

    let memoryHits = 0;
    let diskAtlasHits = 0;
    let freshDecodes = 0;
    let pyramidFallbacks = 0;

    let sumLookup = 0;
    let sumIpc = 0;
    let sumBitmap = 0;
    let sumPaint = 0;
    let sumTotal = 0;
    let zoomTiles = 0;
    const totals: number[] = [];
    const stages = { nativeRequest: 0, bitmap: 0, paint: 0, cacheLookup: 0 };

    for (const r of this.records) {
      switch (r.source) {
        case "memory_tier":
          memoryHits++;
          break;
        case "disk_atlas":
          diskAtlasHits++;
          break;
        case "fresh_decode":
          freshDecodes++;
          break;
        case "pyramid_fallback":
          pyramidFallbacks++;
          break;
      }
      sumLookup += r.cacheLookupMs;
      sumIpc += r.ipcTransferMs;
      sumBitmap += r.bitmapCreationMs;
      sumPaint += r.rasterPaintMs;
      sumTotal += r.totalTimeToVisibleMs;
      totals.push(r.totalTimeToVisibleMs);
      if (r.requestReason === "zoom") zoomTiles++;
      stages.nativeRequest += r.ipcTransferMs + r.decodeMs;
      stages.bitmap += r.bitmapCreationMs;
      stages.paint += r.rasterPaintMs;
      stages.cacheLookup += r.cacheLookupMs;
    }

    const paintTotal = this.paintTimesMs.reduce((total, value) => total + value, 0);
    const zoomGestures = this.completedZoomGestures.length;
    const zoomInputEvents = this.completedZoomGestures.reduce(
      (total, gesture) => total + gesture.inputEvents,
      0,
    );
    const zoomDurationMs = this.completedZoomGestures.reduce(
      (total, gesture) => total + gesture.durationMs,
      0,
    );
    const cacheHits = memoryHits + diskAtlasHits;
    const hitRatePercentage = total > 0 ? (cacheHits / total) * 100 : 0;

    return {
      totalTilesRequested: total,
      memoryHits,
      diskAtlasHits,
      freshDecodes,
      pyramidFallbacks,
      hitRatePercentage: Math.round(hitRatePercentage * 10) / 10,
      avgLookupMs: Math.round((sumLookup / total) * 100) / 100,
      avgIpcMs: Math.round((sumIpc / total) * 100) / 100,
      avgBitmapMs: Math.round((sumBitmap / total) * 100) / 100,
      avgPaintMs: Math.round(((paintTotal / Math.max(1, this.paintTimesMs.length)) || (sumPaint / total)) * 100) / 100,
      avgTimeToVisibleMs: Math.round((sumTotal / total) * 100) / 100,
      p95TimeToVisibleMs: Math.round(percentile(totals, 0.95) * 100) / 100,
      zoomTiles,
      zoomGestures,
      zoomInputEvents,
      zoomDurationMs: Math.round(zoomDurationMs),
      zoomTierTransitions: this.zoomTierTransitions,
      dominantBottleneck: dominantStage({ ...stages, paint: stages.paint + paintTotal }),
    };
  }
}

function percentile(values: readonly number[], fraction: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered.length === 0 ? 0 : ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function dominantStage(stages: Record<"nativeRequest" | "bitmap" | "paint" | "cacheLookup", number>): FilmstripSessionSummary["dominantBottleneck"] {
  const winner = (Object.entries(stages) as Array<[keyof typeof stages, number]>).sort(([, a], [, b]) => b - a)[0];
  if (!winner || winner[1] <= 0) return "none";
  const labels: Record<keyof typeof stages, FilmstripSessionSummary["dominantBottleneck"]> = {
    nativeRequest: "native-request",
    bitmap: "bitmap",
    paint: "paint",
    cacheLookup: "cache-lookup",
  };
  return labels[winner[0]];
}

/** Global singleton telemetry instance for filmstrip pipeline */
export const filmstripTelemetry = new FilmstripTelemetryRecorder();
