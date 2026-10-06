/**
 * End-to-end diagnostics and tracing for Clypra's "Text Behind Person" (Subject Cutout) pipeline.
 *
 * Tracks every stage of the cutout lifecycle across frontend and backend:
 * 1. Scene Evaluation (`eval`): Synthesizing cutout layers at `zIndex = text.zIndex + 0.5`
 * 2. Source Resolution (`source`): Finding and querying `<video>` elements in `PreviewMediaPool`
 * 3. AI Segmentation (`segment`): Worker inference time, subject coverage %, runtime model
 * 4. Raster Bridge (`bridge`): GPU texture registration and memory allocation
 * 5. Request Assembly (`request`): Stacking order validation [background -> text -> cutout]
 * 6. Native Compositor (`backend`): Rust WGPU mask binding (exact vs prefix vs missing fallback)
 */

import { perfLogService } from "@/services/perfLogService";

export type CutoutPipelineStage =
  | "eval"
  | "source"
  | "segment"
  | "bridge"
  | "request"
  | "backend";

export interface CutoutTraceEvent {
  stage: CutoutPipelineStage;
  timestampEpochMs: number;
  timeMs: number;
  message: string;
  details: Record<string, unknown>;
  level: "info" | "warn" | "error";
}

const MAX_TRACE_HISTORY = 200;
const traceHistory: CutoutTraceEvent[] = [];

/** Check if verbose cutout debugging is enabled. */
export function isCutoutDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const globalWithFlag = globalThis as typeof globalThis & {
    __CLYPRA_DEBUG_CUTOUT__?: boolean;
  };
  if (globalWithFlag.__CLYPRA_DEBUG_CUTOUT__ === true) return true;
  try {
    return (
      localStorage.getItem("clypra:debug:cutout") === "1" ||
      localStorage.getItem("clypra:debug:playback") === "1"
    );
  } catch {
    return false;
  }
}

/** Rate limiter to avoid flooding the console for repeated high-frequency events. */
const lastLogTimeByStage = new Map<string, number>();

export function traceCutoutEvent(
  stage: CutoutPipelineStage,
  message: string,
  details: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
): void {
  const now = performance.now();
  const event: CutoutTraceEvent = {
    stage,
    timestampEpochMs: Date.now(),
    timeMs: Number(now.toFixed(2)),
    message,
    details,
    level,
  };

  // Add to circular buffer
  traceHistory.push(event);
  if (traceHistory.length > MAX_TRACE_HISTORY) {
    traceHistory.splice(0, traceHistory.length - MAX_TRACE_HISTORY);
  }

  // Forward to NDJSON session perf log
  perfLogService.enqueue({
    kind: "ai-inference",
    sessionId: perfLogService.getSessionId() ?? "unknown",
    timestampEpochMs: event.timestampEpochMs,
    payload: {
      category: "cutout-pipeline",
      stage,
      message,
      level,
      ...details,
    },
  });

  const debugEnabled = isCutoutDebugEnabled();
  const isDev = Boolean(import.meta.env.DEV);

  // Rate-limit high frequency successful 'request' and 'source' logs to at most 1 every 500ms
  // unless an issue (warn/error) is detected.
  const rateLimitKey = `${stage}:${level}`;
  const lastLogMs = lastLogTimeByStage.get(rateLimitKey) ?? 0;
  const shouldThrottle = level === "info" && (stage === "request" || stage === "source");

  if (!shouldThrottle || now - lastLogMs >= 500) {
    lastLogTimeByStage.set(rateLimitKey, now);

    if (debugEnabled || isDev || level !== "info") {
      const icon =
        level === "error"
          ? "🚨"
          : level === "warn"
            ? "⚠️"
            : stage === "eval"
              ? "🎨"
              : stage === "source"
                ? "🎥"
                : stage === "segment"
                  ? "🧠"
                  : stage === "bridge"
                    ? "📦"
                    : stage === "request"
                      ? "📐"
                      : "🦀";

      const prefix = `${icon} [Cutout:${stage.toUpperCase()}]`;
      if (level === "error") {
        console.error(prefix, message, details);
      } else if (level === "warn") {
        console.warn(prefix, message, details);
      } else if (debugEnabled) {
        console.log(
          `%c${prefix} ${message}`,
          "color: #38bdf8; font-weight: 500;",
          details,
        );
      }
    }
  }
}

/** Returns the in-memory trace history for diagnostics. */
export function getCutoutPipelineHistory(): readonly CutoutTraceEvent[] {
  return traceHistory;
}

/** Prints a clean ASCII summary table of recent cutout pipeline events to the console. */
export function dumpCutoutPipelineTrace(): void {
  if (traceHistory.length === 0) {
    console.info(
      "%c[CutoutPipeline] No cutout pipeline events recorded yet. Enable 'Behind Subject' on a text layer to start tracing.",
      "color: #f59e0b; font-weight: bold;",
    );
    return;
  }

  const tableData = traceHistory.slice(-30).map((evt) => ({
    Stage: evt.stage.toUpperCase(),
    Level: evt.level,
    Message: evt.message,
    Time: `${(evt.timeMs / 1000).toFixed(2)}s`,
    Details: JSON.stringify(evt.details),
  }));

  console.group("%c=== Clypra Subject Cutout Pipeline Trace ===", "color: #38bdf8; font-weight: bold; font-size: 13px;");
  console.table(tableData);
  console.info("Total buffered trace events:", traceHistory.length);
  console.groupEnd();
}

// Attach to window for easy developer access in DevTools
if (typeof window !== "undefined") {
  (window as any).__CLYPRA_CUTOUT_PIPELINE__ = {
    dump: dumpCutoutPipelineTrace,
    getHistory: getCutoutPipelineHistory,
    enableDebug: () => {
      try {
        localStorage.setItem("clypra:debug:cutout", "1");
      } catch {}
      (window as any).__CLYPRA_DEBUG_CUTOUT__ = true;
      console.log("%c[CutoutPipeline] Real-time cutout logging ENABLED.", "color: #10b981; font-weight: bold;");
    },
    disableDebug: () => {
      try {
        localStorage.removeItem("clypra:debug:cutout");
      } catch {}
      (window as any).__CLYPRA_DEBUG_CUTOUT__ = false;
      console.log("%c[CutoutPipeline] Real-time cutout logging DISABLED.", "color: #f59e0b; font-weight: bold;");
    },
  };
  (window as any).dumpCutoutPipelineTrace = dumpCutoutPipelineTrace;
}
