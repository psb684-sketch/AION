/**
 * Render Scheduler
 *
 * Explicit imperative cross-clip resource manager.
 *
 * Required for three things that CANNOT be emergently coordinated:
 *   1. Global GPU upload throttle (R21): max 16 MB/frame across ALL clips
 *   2. Cross-clip cancellation (R18): clip removal must cancel jobs across the entire queue
 *   3. Concurrent epoch arbitration (R3): atomic comparison across simultaneous renders
 *
 * Scheduling signals (not epoch identity):
 *   - memoryPressureState → suspend()/resume()
 *   - preloadInterferenceFlag → priority demotion
 */

import { Priority, type RenderJob, type IdleTask } from "./types";

// ─── GPU Upload Throttle ──────────────────────────────────────────────────────

const GPU_UPLOAD_BUDGET_PER_FRAME_BYTES = 16 * 1024 * 1024; // 16 MB/frame (R21)
const FRONTEND_MEMORY_SUSPEND_THRESHOLD_MB = 400; // R10

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class RenderScheduler {
  // Priority queues: Critical (0), High (1), Normal (2)
  private _queues: Map<Priority, RenderJob[]> = new Map([
    [Priority.Critical, []],
    [Priority.High, []],
    [Priority.Normal, []],
  ]);

  private _idleTasks: IdleTask[] = [];
  private _suspended = false;
  private _idleHandle: ReturnType<typeof setTimeout> | null = null;

  // GPU upload budget tracking (resets each animation frame)
  private _uploadedThisFrame = 0;
  private _uploadWaiters: Array<() => void> = [];

  constructor() {
    // Reset upload budget each animation frame
    this._scheduleFrameReset();
  }

  private _scheduleFrameReset(): void {
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        this._uploadedThisFrame = 0;
        // Flush any waiters that were blocked by budget
        const waiters = this._uploadWaiters.splice(0);
        for (const resolve of waiters) resolve();
        this._scheduleFrameReset();
      });
    }
  }

  // ── Job Queue ─────────────────────────────────────────────────────────────

  enqueue(job: RenderJob): void {
    if (this._suspended) return;
    const queue = this._queues.get(job.priority)!;
    // Deduplicate by jobId
    if (!queue.some((j) => j.jobId === job.jobId)) {
      queue.push(job);
    }
  }

  /**
   * Dequeue the highest-priority pending job.
   * Returns null if all queues are empty or scheduler is suspended.
   */
  dequeue(): RenderJob | null {
    if (this._suspended) return null;
    for (const priority of [Priority.Critical, Priority.High, Priority.Normal]) {
      const queue = this._queues.get(priority)!;
      if (queue.length > 0) return queue.shift()!;
    }
    return null;
  }

  // ── Cancellation (R18) ────────────────────────────────────────────────────

  /** Cancel all jobs matching predicate. */
  cancel(predicate: (job: RenderJob) => boolean): number {
    let cancelled = 0;
    for (const queue of this._queues.values()) {
      const before = queue.length;
      const remaining = queue.filter((j) => !predicate(j));
      queue.length = 0;
      queue.push(...remaining);
      cancelled += before - queue.length;
    }
    return cancelled;
  }

  /** R18: Clip removed → cancel all in-progress extractions immediately. */
  cancelClip(clipId: string): number {
    return this.cancel((j) => j.clipId === clipId);
  }

  /** R18: Trim changed → cancel all tier extractions for that clip. */
  cancelTrim(clipId: string): number {
    return this.cancelClip(clipId);
  }

  /** R18: Tier inactive >5s → cancel in-progress extractions for that tier. */
  cancelInactiveTier(clipId: string, tier: import("./types").SpatialTier): number {
    return this.cancel((j) => j.clipId === clipId && j.spatialTier === tier);
  }

  pendingCount(): number {
    let total = 0;
    for (const queue of this._queues.values()) total += queue.length;
    return total;
  }

  hasPending(clipId: string): boolean {
    for (const queue of this._queues.values()) {
      if (queue.some((j) => j.clipId === clipId)) return true;
    }
    return false;
  }

  // ── GPU Upload Throttle (R21) ─────────────────────────────────────────────

  /**
   * Request GPU upload budget.
   * If the per-frame budget is exhausted, waits until the next animation frame.
   * Visible viewport jobs always get priority — callers should enqueue with Priority.Critical.
   */
  async throttleGPUUpload(bytes: number): Promise<void> {
    // If this upload fits in the current frame budget, proceed immediately
    if (this._uploadedThisFrame + bytes <= GPU_UPLOAD_BUDGET_PER_FRAME_BYTES) {
      this._uploadedThisFrame += bytes;
      return;
    }

    // Otherwise wait for the next frame reset
    await new Promise<void>((resolve) => {
      this._uploadWaiters.push(resolve);
    });
    this._uploadedThisFrame += bytes;
  }

  // ── Idle Tasks (R10) ──────────────────────────────────────────────────────

  private readonly IDLE_DELAY_MS = 500;

  /** Schedule a task to run after 500ms of idle (R10). */
  scheduleIdle(task: IdleTask): void {
    // Deduplicate by task id
    if (this._idleTasks.some((t) => t.id === task.id)) return;
    this._idleTasks.push(task);
    this._armIdleTimer();
  }

  cancelIdle(taskId: string): void {
    this._idleTasks = this._idleTasks.filter((t) => t.id !== taskId);
  }

  /** Call this whenever user interaction occurs to reset the idle timer (R10). */
  resetIdleTimer(): void {
    if (this._idleHandle !== null) {
      clearTimeout(this._idleHandle);
      this._idleHandle = null;
    }
    this._armIdleTimer();
  }

  private _armIdleTimer(): void {
    if (this._idleTasks.length === 0 || this._idleHandle !== null) return;
    this._idleHandle = setTimeout(() => {
      this._idleHandle = null;
      this._runIdleTasks();
    }, this.IDLE_DELAY_MS);
  }

  private _runIdleTasks(): void {
    if (this._suspended) return;
    // Sort by priority, run sequentially
    const sorted = [...this._idleTasks].sort((a, b) => a.priority - b.priority);
    this._idleTasks = [];

    const runNext = async (index: number) => {
      if (index >= sorted.length || this._suspended) return;
      try {
        await sorted[index].execute();
      } catch (err) {
        console.warn("[RenderScheduler] Idle task failed:", err);
      }
      runNext(index + 1);
    };
    runNext(0);
  }

  // ── Suspension (memory pressure) ──────────────────────────────────────────

  /** Suspend when frontend memory >400MB (R10). */
  suspend(): void {
    if (this._suspended) return;
    this._suspended = true;
    if (this._idleHandle !== null) {
      clearTimeout(this._idleHandle);
      this._idleHandle = null;
    }
    if (import.meta.env.DEV) console.warn("[RenderScheduler] Suspended — memory pressure.");
  }

  resume(): void {
    if (!this._suspended) return;
    this._suspended = false;
    this._armIdleTimer();
  }

  get isSuspended(): boolean {
    return this._suspended;
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  getStats() {
    return {
      pending: this.pendingCount(),
      idleTasks: this._idleTasks.length,
      suspended: this._suspended,
      uploadedThisFrameKB: Math.round(this._uploadedThisFrame / 1024),
      budgetKB: Math.round(GPU_UPLOAD_BUDGET_PER_FRAME_BYTES / 1024),
    };
  }

  dispose(): void {
    this._suspended = true;
    if (this._idleHandle !== null) clearTimeout(this._idleHandle);
    for (const queue of this._queues.values()) queue.length = 0;
    this._idleTasks = [];
    this._uploadWaiters = [];
  }
}
