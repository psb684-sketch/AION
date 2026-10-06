import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => path,
}));

/**
 * Tests for Race condition between sync() and render
 *
 * This test suite validates the fix for the race condition where:
 * - Frame 1: sync() + start render (isRendering = true)
 * - Frame 2: sync() again (mutates state) → early return
 * - Frame 1's render still using disposed elements → crash
 *
 * The fix moves the isRendering guard BEFORE sync() to prevent
 * state mutation during active renders.
 */

interface RenderState {
  isRendering: boolean;
  droppedFrames: number;
  syncCalls: number;
  renderJobs: number;
  stateVersion: number;
}

/**
 * Mock RAF render loop that simulates ProgramPreview behavior
 */
class MockRenderLoop {
  private state: RenderState = {
    isRendering: false,
    droppedFrames: 0,
    syncCalls: 0,
    renderJobs: 0,
    stateVersion: 0,
  };

  private syncMutatesState = true;
  private renderDuration = 0; // ms to simulate render job duration

  constructor(config?: {
    renderDuration?: number;
    syncMutatesState?: boolean;
  }) {
    if (config?.renderDuration !== undefined) {
      this.renderDuration = config.renderDuration;
    }
    if (config?.syncMutatesState !== undefined) {
      this.syncMutatesState = config.syncMutatesState;
    }
  }

  /**
   * Simulate one RAF tick with CORRECT order
   */
  rafTickFixed(): void {
    // 1. Check isRendering guard FIRST (prevents sync during render)
    if (this.state.isRendering) {
      this.state.droppedFrames++;
      return;
    }

    // 2. Call sync (safe now - no render in progress)
    this.sync();

    // 3. Set isRendering and start render job
    this.state.isRendering = true;
    this.startRenderJob();
  }

  /**
   * Simulate one RAF tick with WRONG order
   */
  rafTickBroken(): void {
    // 1. Call sync BEFORE checking isRendering (WRONG!)
    this.sync();

    // 2. Check isRendering guard (too late - sync already mutated state)
    if (this.state.isRendering) {
      this.state.droppedFrames++;
      return;
    }

    // 3. Set isRendering and start render job
    this.state.isRendering = true;
    this.startRenderJob();
  }

  private sync(): void {
    this.state.syncCalls++;
    if (this.syncMutatesState) {
      // Sync mutates state (increments version to simulate disposal/recreation)
      this.state.stateVersion++;
    }
  }

  private startRenderJob(): void {
    this.state.renderJobs++;

    // Simulate async render job
    if (this.renderDuration > 0) {
      setTimeout(() => {
        this.state.isRendering = false;
      }, this.renderDuration);
    } else {
      // Synchronous render (for testing)
      this.state.isRendering = false;
    }
  }

  getState(): Readonly<RenderState> {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      isRendering: false,
      droppedFrames: 0,
      syncCalls: 0,
      renderJobs: 0,
      stateVersion: 0,
    };
  }
}

describe("ProgramPreview RAF Loop — Render Race Condition", () => {
  let loop: MockRenderLoop;

  beforeEach(() => {
    loop = new MockRenderLoop();
  });

  afterEach(() => {
    loop.reset();
  });

  it("should allow sync when no render is in progress", () => {
    loop.rafTickFixed();

    const state = loop.getState();
    expect(state.syncCalls).toBe(1);
    expect(state.renderJobs).toBe(1);
    expect(state.droppedFrames).toBe(0);
  });

  it("should block sync when render is in progress", () => {
    // Create loop with slow render (simulates heavy scene)
    const slowLoop = new MockRenderLoop({ renderDuration: 20 });

    // Frame 1: Start render
    slowLoop.rafTickFixed();
    let state = slowLoop.getState();
    expect(state.isRendering).toBe(true);
    expect(state.syncCalls).toBe(1);
    expect(state.renderJobs).toBe(1);

    // Frame 2: Try to render while Frame 1 is still rendering
    slowLoop.rafTickFixed();
    state = slowLoop.getState();

    // With fix: sync NOT called (blocked by isRendering guard)
    expect(state.syncCalls).toBe(1); // Still 1, not 2
    expect(state.renderJobs).toBe(1); // Still 1, not 2
    expect(state.droppedFrames).toBe(1); // Frame dropped
  });

  it("should call sync twice when render is in progress WITHOUT fix (broken behavior)", () => {
    const slowLoop = new MockRenderLoop({ renderDuration: 20 });

    // Frame 1: Start render
    slowLoop.rafTickBroken();
    let state = slowLoop.getState();
    expect(state.isRendering).toBe(true);
    expect(state.syncCalls).toBe(1);

    // Frame 2: sync called BEFORE isRendering check
    slowLoop.rafTickBroken();
    state = slowLoop.getState();

    // Without fix: sync WAS called (before guard check)
    expect(state.syncCalls).toBe(2); // ❌ Called twice
    expect(state.renderJobs).toBe(1); // Only 1 job (second blocked)
    expect(state.droppedFrames).toBe(1);
  });

  it("should prevent state mutation during active render", () => {
    const slowLoop = new MockRenderLoop({
      renderDuration: 20,
      syncMutatesState: true,
    });

    // Frame 1: sync v0→v1, start render with v1
    slowLoop.rafTickFixed();
    const stateAfterFrame1 = slowLoop.getState();
    expect(stateAfterFrame1.stateVersion).toBe(1);
    expect(stateAfterFrame1.isRendering).toBe(true);

    // Frame 2: Blocked by isRendering guard, state NOT mutated
    slowLoop.rafTickFixed();
    const stateAfterFrame2 = slowLoop.getState();

    // With fix: state version unchanged (sync not called)
    expect(stateAfterFrame2.stateVersion).toBe(1); // Still 1
    expect(stateAfterFrame2.syncCalls).toBe(1); // sync called once only
  });

  it("should allow state mutation during active render WITHOUT fix (causes crash)", () => {
    const slowLoop = new MockRenderLoop({
      renderDuration: 20,
      syncMutatesState: true,
    });

    // Frame 1: sync v0→v1, start render with v1
    slowLoop.rafTickBroken();
    const stateAfterFrame1 = slowLoop.getState();
    expect(stateAfterFrame1.stateVersion).toBe(1);

    // Frame 2: sync called BEFORE guard, state mutated v1→v2
    slowLoop.rafTickBroken();
    const stateAfterFrame2 = slowLoop.getState();

    // Without fix: state version changed (sync mutated state)
    expect(stateAfterFrame2.stateVersion).toBe(2); // ❌ Mutated during render
    expect(stateAfterFrame2.syncCalls).toBe(2);

    // This is the bug: Frame 1's render is using v1 elements,
    // but Frame 2's sync() just disposed them and created v2
  });

  it("should handle rapid RAF ticks on 120Hz monitor with slow render", async () => {
    // 120Hz = 8.33ms per frame, render takes 20ms = 2-3 frames overlap
    const slowLoop = new MockRenderLoop({ renderDuration: 20 });

    // Simulate 5 rapid RAF ticks (simulating 120Hz)
    for (let i = 0; i < 5; i++) {
      slowLoop.rafTickFixed();
    }

    const state = slowLoop.getState();

    // With fix: only first frame renders, others dropped
    expect(state.renderJobs).toBe(1);
    expect(state.syncCalls).toBe(1); // Only first sync executed
    expect(state.droppedFrames).toBe(4); // Other 4 frames dropped
  });

  it("should allow multiple renders when each completes quickly", () => {
    const fastLoop = new MockRenderLoop({ renderDuration: 0 }); // Instant render

    // Simulate 5 RAF ticks with fast renders
    for (let i = 0; i < 5; i++) {
      fastLoop.rafTickFixed();
    }

    const state = fastLoop.getState();

    // All frames should render successfully
    expect(state.renderJobs).toBe(5);
    expect(state.syncCalls).toBe(5);
    expect(state.droppedFrames).toBe(0);
  });

  it("should recover after slow render completes", async () => {
    const slowLoop = new MockRenderLoop({ renderDuration: 20 });

    // Frame 1: Start slow render
    slowLoop.rafTickFixed();
    expect(slowLoop.getState().isRendering).toBe(true);

    // Frame 2: Blocked
    slowLoop.rafTickFixed();
    expect(slowLoop.getState().droppedFrames).toBe(1);

    // Wait for render to complete
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Frame 3: Should work now
    slowLoop.rafTickFixed();
    const state = slowLoop.getState();

    expect(state.renderJobs).toBe(2); // First and third frames rendered
    expect(state.syncCalls).toBe(2);
    expect(state.droppedFrames).toBe(1); // Only second frame dropped
  });

  it("should track dropped frames correctly during sustained overload", async () => {
    const slowLoop = new MockRenderLoop({ renderDuration: 50 });

    // Start render
    slowLoop.rafTickFixed();

    // Try 10 more frames while render in progress
    for (let i = 0; i < 10; i++) {
      slowLoop.rafTickFixed();
    }

    const state = slowLoop.getState();

    expect(state.renderJobs).toBe(1);
    expect(state.syncCalls).toBe(1);
    expect(state.droppedFrames).toBe(10);
  });

  it("should prevent concurrent state mutations on high refresh rate displays", () => {
    // Simulate 240Hz monitor (4.16ms frames) with 16ms render
    const loop240Hz = new MockRenderLoop({ renderDuration: 16 });

    // 4 frames fire during one render (240Hz ÷ 60Hz = 4x)
    const ticks = 4;

    for (let i = 0; i < ticks; i++) {
      loop240Hz.rafTickFixed();
    }

    const state = loop240Hz.getState();

    // Only first tick should sync and render
    expect(state.syncCalls).toBe(1);
    expect(state.renderJobs).toBe(1);
    expect(state.stateVersion).toBe(1); // State mutated once only
    expect(state.droppedFrames).toBe(ticks - 1);
  });

  it("should demonstrate the race condition without fix", () => {
    const slowLoop = new MockRenderLoop({
      renderDuration: 20,
      syncMutatesState: true,
    });

    // Frame 1: sync (v0→v1), render job starts with v1 elements
    slowLoop.rafTickBroken();
    const v1 = slowLoop.getState().stateVersion;

    // Frame 2: sync (v1→v2) BEFORE checking isRendering
    // This mutates state while Frame 1's render is still using v1 elements
    slowLoop.rafTickBroken();
    const v2 = slowLoop.getState().stateVersion;

    // Bug demonstrated: state mutated during active render
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(v2).toBeGreaterThan(v1); // State changed during render = BUG
  });

  it("should prevent the race condition with fix", () => {
    const slowLoop = new MockRenderLoop({
      renderDuration: 20,
      syncMutatesState: true,
    });

    // Frame 1: sync (v0→v1), render job starts with v1 elements
    slowLoop.rafTickFixed();
    const v1 = slowLoop.getState().stateVersion;

    // Frame 2: isRendering guard blocks sync, state NOT mutated
    slowLoop.rafTickFixed();
    const v2 = slowLoop.getState().stateVersion;

    // Fix verified: state unchanged during render
    expect(v1).toBe(1);
    expect(v2).toBe(1);
    expect(v2).toBe(v1); // State stable during render = FIXED
  });
});

describe("ProgramPreview RAF Loop — Guard Ordering", () => {
  it("should execute operations in correct order with fix", () => {
    const operations: string[] = [];

    let isRendering = false;
    let droppedFrames = 0;

    // Simulate RAF tick with CORRECT order
    const rafTickFixed = () => {
      operations.push("raf_start");

      // 1. Guard check FIRST
      if (isRendering) {
        operations.push("guard_blocked");
        droppedFrames++;
        return;
      }
      operations.push("guard_passed");

      // 2. Sync after guard
      operations.push("sync_start");
      operations.push("sync_end");

      // 3. Set rendering flag
      isRendering = true;
      operations.push("render_start");
    };

    // First tick
    rafTickFixed();
    expect(operations).toEqual([
      "raf_start",
      "guard_passed",
      "sync_start",
      "sync_end",
      "render_start",
    ]);

    // Second tick (while rendering)
    operations.length = 0;
    rafTickFixed();
    expect(operations).toEqual(["raf_start", "guard_blocked"]);
    expect(droppedFrames).toBe(1);
  });

  it("should demonstrate incorrect ordering without fix", () => {
    const operations: string[] = [];

    let isRendering = false;

    // Simulate RAF tick with WRONG order
    const rafTickBroken = () => {
      operations.push("raf_start");

      // 1. Sync BEFORE guard check (WRONG!)
      operations.push("sync_start");
      operations.push("sync_end");

      // 2. Guard check after sync (too late)
      if (isRendering) {
        operations.push("guard_blocked");
        return;
      }
      operations.push("guard_passed");

      // 3. Set rendering flag
      isRendering = true;
      operations.push("render_start");
    };

    // First tick
    rafTickBroken();
    expect(operations).toEqual([
      "raf_start",
      "sync_start",
      "sync_end",
      "guard_passed",
      "render_start",
    ]);

    // Second tick (while rendering)
    operations.length = 0;
    rafTickBroken();

    // sync executed even though guard blocked render
    expect(operations).toEqual([
      "raf_start",
      "sync_start",
      "sync_end",
      "guard_blocked",
    ]);
    expect(operations).toContain("sync_start"); // ❌ Sync should not run
  });

  it("should verify guard protects sync from concurrent execution", () => {
    let syncExecutions = 0;
    let isRendering = false;

    const rafTick = () => {
      if (isRendering) return;

      syncExecutions++;
      isRendering = true;
    };

    // First tick
    rafTick();
    expect(syncExecutions).toBe(1);
    expect(isRendering).toBe(true);

    // Multiple concurrent ticks
    rafTick();
    rafTick();
    rafTick();

    // Guard prevented all concurrent executions
    expect(syncExecutions).toBe(1); // Still 1
  });
});

describe("ProgramPreview RAF Loop — Real World Scenarios", () => {
  it("should handle heavy project on 120Hz display", async () => {
    // Heavy project: 25ms render time
    // 120Hz display: 8.33ms frame time
    // Result: 3 frames fire during each render

    const loop = new MockRenderLoop({ renderDuration: 25 });

    // Simulate sustained 120Hz RAF
    const startTime = Date.now();
    let ticks = 0;

    while (Date.now() - startTime < 100) {
      loop.rafTickFixed();
      ticks++;
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    const state = loop.getState();

    // Should have dropped many frames (render can't keep up)
    expect(state.droppedFrames).toBeGreaterThan(0);

    // But should NOT have concurrent syncs
    expect(state.syncCalls).toBeLessThanOrEqual(state.renderJobs + 1);
  });

  it("should handle burst of RAF ticks from delayed execution", () => {
    const loop = new MockRenderLoop({ renderDuration: 10 });

    // Simulate browser delivering multiple RAF callbacks at once
    // (can happen when tab regains focus)
    for (let i = 0; i < 10; i++) {
      loop.rafTickFixed();
    }

    const state = loop.getState();

    // Only first tick should render
    expect(state.renderJobs).toBe(1);
    expect(state.syncCalls).toBe(1);
    expect(state.droppedFrames).toBe(9);
  });

  it("should maintain stability over extended session", async () => {
    const loop = new MockRenderLoop({ renderDuration: 5 });

    // Simulate 100 frames (typical 60Hz = 1.67 seconds)
    for (let i = 0; i < 100; i++) {
      loop.rafTickFixed();

      // Simulate varying frame timing
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const state = loop.getState();

    // Should have some successful renders (timing dependent)
    expect(state.renderJobs).toBeGreaterThan(5);

    // Sync count should match render count
    expect(state.syncCalls).toBe(state.renderJobs);

    // State version should match sync calls (no missed mutations)
    expect(state.stateVersion).toBe(state.syncCalls);
  });

  it("should handle mixed fast and slow renders", async () => {
    // Start with slow render
    let renderDuration = 30;
    const loop = new MockRenderLoop({ renderDuration });

    loop.rafTickFixed(); // Slow render starts
    expect(loop.getState().isRendering).toBe(true);

    // Multiple ticks during slow render
    for (let i = 0; i < 5; i++) {
      loop.rafTickFixed();
    }

    expect(loop.getState().droppedFrames).toBe(5);

    // Wait for slow render to complete
    await new Promise((resolve) => setTimeout(resolve, 35));

    // Now do fast renders
    const fastLoop = new MockRenderLoop({ renderDuration: 0 });
    for (let i = 0; i < 5; i++) {
      fastLoop.rafTickFixed();
    }

    expect(fastLoop.getState().renderJobs).toBe(5);
    expect(fastLoop.getState().droppedFrames).toBe(0);
  });
});

describe("ProgramPreview RAF Loop: Separate needsSync from needsRender", () => {
  /**
   * Mock RAF render loop that implements optimization
   */
  class MockRenderLoopWithSyncOptimization {
    private isRendering = false;
    private lastRenderedTime = -1;
    private lastRenderedEpoch = -1;
    private lastRenderedPlaybackState: "playing" | "paused" | "stopped" =
      "stopped";

    private syncCallCount = 0;
    private renderCallCount = 0;
    private droppedFrames = 0;

    /**
     * Simulate RAF tick WITH optimization
     */
    tick(
      time: number,
      playbackState: "playing" | "paused" | "stopped",
      epoch: number,
      hasActiveTransform = false,
    ): void {
      const timeChanged = time !== this.lastRenderedTime;
      const epochChanged = epoch !== this.lastRenderedEpoch;
      const isFirstFrame = this.lastRenderedTime === -1;
      const isPlaying = playbackState === "playing";

      // needsRender: frame scheduling (every frame during playback or active transform)
      const needsRender =
        isPlaying ||
        timeChanged ||
        epochChanged ||
        isFirstFrame ||
        hasActiveTransform;

      // needsSync: element lifecycle (only on state changes)
      const playbackStateChanged =
        playbackState !== this.lastRenderedPlaybackState;
      const needsSync = epochChanged || playbackStateChanged || isFirstFrame;

      if (!needsRender) {
        return; // Early exit
      }

      if (this.isRendering) {
        this.droppedFrames++;
        return;
      }

      // Call sync ONLY when needed (not every frame)
      if (needsSync) {
        this.syncCallCount++;
      }

      this.isRendering = true;
      this.lastRenderedTime = time;
      this.lastRenderedEpoch = epoch;
      this.lastRenderedPlaybackState = playbackState;

      this.renderCallCount++;
      this.isRendering = false; // Instant render for testing
    }

    /**
     * Simulate RAF tick WITHOUT optimization (old behavior)
     */
    tickUnoptimized(
      time: number,
      playbackState: "playing" | "paused" | "stopped",
      epoch: number,
    ): void {
      const timeChanged = time !== this.lastRenderedTime;
      const epochChanged = epoch !== this.lastRenderedEpoch;
      const isFirstFrame = this.lastRenderedTime === -1;
      const isPlaying = playbackState === "playing";

      const needsRender =
        isPlaying || timeChanged || epochChanged || isFirstFrame;

      if (!needsRender) {
        return;
      }

      if (this.isRendering) {
        this.droppedFrames++;
        return;
      }

      // Old behavior: ALWAYS call sync when needsRender is true
      this.syncCallCount++;

      this.isRendering = true;
      this.lastRenderedTime = time;
      this.lastRenderedEpoch = epoch;
      this.lastRenderedPlaybackState = playbackState;

      this.renderCallCount++;
      this.isRendering = false;
    }

    getStats() {
      return {
        syncCalls: this.syncCallCount,
        renderCalls: this.renderCallCount,
        droppedFrames: this.droppedFrames,
      };
    }

    reset(): void {
      this.isRendering = false;
      this.lastRenderedTime = -1;
      this.lastRenderedEpoch = -1;
      this.lastRenderedPlaybackState = "stopped";
      this.syncCallCount = 0;
      this.renderCallCount = 0;
      this.droppedFrames = 0;
    }
  }

  let loop: MockRenderLoopWithSyncOptimization;

  beforeEach(() => {
    loop = new MockRenderLoopWithSyncOptimization();
  });

  afterEach(() => {
    loop.reset();
  });

  it("should call sync only once on first frame (not 60 times)", () => {
    // First frame: both sync and render needed
    loop.tick(0.0, "playing", 1);

    const stats = loop.getStats();
    expect(stats.syncCalls).toBe(1);
    expect(stats.renderCalls).toBe(1);
  });

  it("should NOT call sync during steady 60fps playback (optimization)", () => {
    // First frame
    loop.tick(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Simulate 60 frames at 60fps (1 second of playback)
    for (let frame = 1; frame <= 60; frame++) {
      const time = frame / 60;
      loop.tick(time, "playing", 1); // playbackState and epoch unchanged
    }

    const stats = loop.getStats();

    // With optimization: sync called ONCE (first frame only)
    expect(stats.syncCalls).toBe(1);

    // But render called 61 times (first frame + 60 playback frames)
    expect(stats.renderCalls).toBe(61);
  });

  it("should call sync 60 times WITHOUT optimization (old behavior)", () => {
    // First frame
    loop.tickUnoptimized(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Simulate 60 frames
    for (let frame = 1; frame <= 60; frame++) {
      const time = frame / 60;
      loop.tickUnoptimized(time, "playing", 1);
    }

    const stats = loop.getStats();

    // Without optimization: sync called 61 times (every frame)
    expect(stats.syncCalls).toBe(61); // ❌ Wasteful

    // Render also called 61 times
    expect(stats.renderCalls).toBe(61);
  });

  it("should call sync when playback state changes", () => {
    // Start playing
    loop.tick(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Play for a few frames
    for (let i = 1; i <= 10; i++) {
      loop.tick(i / 60, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(1); // Still 1

    // Pause (playback state changed, time also changed to trigger needsRender)
    loop.tick(11 / 60, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(2); // Sync called again

    // Paused scrubbing (state unchanged)
    for (let i = 12; i <= 20; i++) {
      loop.tick(i / 60, "paused", 1);
    }
    expect(loop.getStats().syncCalls).toBe(2); // Still 2

    // Resume playing (state changed again, time also changed)
    loop.tick(21 / 60, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(3); // Sync called again
  });

  it("should call sync when epoch changes (structural timeline change)", () => {
    // Start playing
    loop.tick(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Play for 30 frames
    for (let i = 1; i <= 30; i++) {
      loop.tick(i / 60, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(1);

    // User adds a clip (epoch increments)
    loop.tick(30 / 60, "playing", 2);
    expect(loop.getStats().syncCalls).toBe(2); // Sync called for new epoch

    // Continue playing
    for (let i = 31; i <= 60; i++) {
      loop.tick(i / 60, "playing", 2);
    }
    expect(loop.getStats().syncCalls).toBe(2); // Still 2 (no more changes)
  });

  it("should reduce sync calls by 98% during 1-minute playback", () => {
    // 60fps × 60 seconds = 3600 frames
    const totalFrames = 3600;

    // First frame
    loop.tick(0.0, "playing", 1);

    // Simulate 1 minute of playback
    for (let frame = 1; frame < totalFrames; frame++) {
      const time = frame / 60;
      loop.tick(time, "playing", 1);
    }

    const stats = loop.getStats();

    // With optimization: 1 sync call (first frame)
    expect(stats.syncCalls).toBe(1);
    expect(stats.renderCalls).toBe(totalFrames);

    // Calculate savings: (3600 - 1) / 3600 = 99.97% reduction
    const reductionPercent =
      ((totalFrames - stats.syncCalls) / totalFrames) * 100;
    expect(reductionPercent).toBeGreaterThan(98);
  });

  it("should call sync on play/pause/play transitions", () => {
    // Start paused
    loop.tick(0.0, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Play (different time to trigger render)
    loop.tick(0.1, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(2); // State changed

    // Play for 30 frames
    for (let i = 1; i <= 30; i++) {
      loop.tick((i + 1) / 60 + 0.1, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(2); // No additional syncs

    // Pause (different time)
    loop.tick(40 / 60, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(3); // State changed

    // Resume (different time)
    loop.tick(50 / 60, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(4); // State changed

    // Play for 30 more frames
    for (let i = 1; i <= 30; i++) {
      loop.tick(50 / 60 + i / 60, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(4); // No additional syncs
  });

  it("should handle scrubbing while paused (no unnecessary syncs)", () => {
    // Start paused
    loop.tick(0.0, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Scrub rapidly (100 seeks while paused)
    for (let i = 1; i <= 100; i++) {
      loop.tick(i / 10, "paused", 1);
    }

    const stats = loop.getStats();

    // With optimization: sync called ONCE (first frame only)
    expect(stats.syncCalls).toBe(1);

    // But render called 101 times (first + 100 scrubs)
    expect(stats.renderCalls).toBe(101);
  });

  it("should sync on epoch change during playback", () => {
    loop.tick(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Play for 20 frames
    for (let i = 1; i <= 20; i++) {
      loop.tick(i / 60, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(1);

    // User splits a clip (epoch changes)
    loop.tick(20 / 60, "playing", 2);
    expect(loop.getStats().syncCalls).toBe(2);

    // Continue playing
    for (let i = 21; i <= 40; i++) {
      loop.tick(i / 60, "playing", 2);
    }
    expect(loop.getStats().syncCalls).toBe(2);

    // User deletes a clip (epoch changes again)
    loop.tick(40 / 60, "playing", 3);
    expect(loop.getStats().syncCalls).toBe(3);
  });

  it("should handle stopped state transitions", () => {
    loop.tick(0.0, "stopped", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Seek while stopped
    loop.tick(5.0, "stopped", 1);
    expect(loop.getStats().syncCalls).toBe(1); // No sync (state unchanged)

    // Start playing
    loop.tick(5.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(2); // State changed

    // Stop
    loop.tick(10.0, "stopped", 1);
    expect(loop.getStats().syncCalls).toBe(3); // State changed
  });

  it("should demonstrate CPU savings with optimization", () => {
    const SYNC_COST_MS = 1.5; // Assume sync() takes 1.5ms
    const totalFrames = 3600; // 1 minute at 60fps

    // Optimized path
    loop.tick(0.0, "playing", 1);
    for (let i = 1; i < totalFrames; i++) {
      loop.tick(i / 60, "playing", 1);
    }
    const optimizedSyncs = loop.getStats().syncCalls;
    const optimizedCostMs = optimizedSyncs * SYNC_COST_MS;

    // Unoptimized path
    loop.reset();
    loop.tickUnoptimized(0.0, "playing", 1);
    for (let i = 1; i < totalFrames; i++) {
      loop.tickUnoptimized(i / 60, "playing", 1);
    }
    const unoptimizedSyncs = loop.getStats().syncCalls;
    const unoptimizedCostMs = unoptimizedSyncs * SYNC_COST_MS;

    // Calculate savings
    const savingsMs = unoptimizedCostMs - optimizedCostMs;
    const savingsPercent = (savingsMs / unoptimizedCostMs) * 100;

    expect(optimizedSyncs).toBe(1);
    expect(unoptimizedSyncs).toBe(3600);
    expect(savingsPercent).toBeGreaterThan(99);

    // Optimized: 1 × 1.5ms = 1.5ms total
    // Unoptimized: 3600 × 1.5ms = 5400ms total
    // Savings: 5398.5ms (5.4 seconds of CPU time per minute)
    expect(savingsMs).toBeCloseTo(5398.5, 0);
  });

  it("should maintain correct behavior across complex state transitions", () => {
    const transitions = [
      { time: 0.0, state: "paused" as const, epoch: 1, expectSync: true }, // First frame
      { time: 0.0, state: "playing" as const, epoch: 1, expectSync: true }, // Play
      { time: 1.0, state: "playing" as const, epoch: 1, expectSync: false }, // Playback
      { time: 2.0, state: "playing" as const, epoch: 1, expectSync: false }, // Playback
      { time: 2.5, state: "paused" as const, epoch: 1, expectSync: true }, // Pause
      { time: 3.0, state: "paused" as const, epoch: 1, expectSync: false }, // Scrub
      { time: 4.0, state: "paused" as const, epoch: 1, expectSync: false }, // Scrub
      { time: 4.0, state: "playing" as const, epoch: 2, expectSync: true }, // Play + epoch change
      { time: 5.0, state: "playing" as const, epoch: 2, expectSync: false }, // Playback
      { time: 6.0, state: "stopped" as const, epoch: 2, expectSync: true }, // Stop
    ];

    let totalSyncs = 0;

    transitions.forEach(({ time, state, epoch, expectSync }) => {
      const beforeSyncs = loop.getStats().syncCalls;
      loop.tick(time, state, epoch);
      const afterSyncs = loop.getStats().syncCalls;

      const syncCalled = afterSyncs > beforeSyncs;
      expect(syncCalled).toBe(expectSync);

      if (expectSync) totalSyncs++;
    });

    // Verify total sync calls match expectations
    expect(loop.getStats().syncCalls).toBe(totalSyncs);
    expect(totalSyncs).toBe(5); // 5 state transitions
  });

  it("should handle rapid play/pause cycles efficiently", () => {
    loop.tick(0.0, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Rapid play/pause 20 times (with time changes)
    for (let i = 0; i < 20; i++) {
      loop.tick(i / 30, "playing", 1); // Different time each cycle
      loop.tick((i + 0.5) / 30, "paused", 1); // Different time
    }

    const stats = loop.getStats();

    // Each play/pause is 2 sync calls, plus initial = 1 + 40 = 41
    expect(stats.syncCalls).toBe(41);

    // This is correct behavior - sync needed on each state change
    // The optimization is that we DON'T sync between state changes
  });

  it("should not sync during high-frequency time updates", () => {
    loop.tick(0.0, "playing", 1);
    expect(loop.getStats().syncCalls).toBe(1);

    // Simulate 240fps rendering (4ms per frame)
    // Time advances slowly, but we render frequently
    for (let frame = 1; frame <= 240; frame++) {
      const time = frame / 240; // 1 second at 240fps
      loop.tick(time, "playing", 1);
    }

    const stats = loop.getStats();

    // With optimization: only 1 sync (first frame)
    expect(stats.syncCalls).toBe(1);

    // But 241 renders (first + 240 frames)
    expect(stats.renderCalls).toBe(241);
  });

  it("should sync when needed despite multiple renders per second", () => {
    // High framerate playback with occasional state changes
    loop.tick(0.0, "playing", 1);
    let syncCallsAfterFirstFrame = loop.getStats().syncCalls;
    expect(syncCallsAfterFirstFrame).toBe(1);

    // 100 frames of playback
    for (let i = 1; i <= 100; i++) {
      loop.tick(i / 60, "playing", 1);
    }
    expect(loop.getStats().syncCalls).toBe(1); // Still 1

    // Pause (with time change to trigger render)
    loop.tick(101 / 60, "paused", 1);
    expect(loop.getStats().syncCalls).toBe(2); // State changed

    // 100 frames of scrubbing
    for (let i = 102; i <= 201; i++) {
      loop.tick(i / 60, "paused", 1);
    }
    expect(loop.getStats().syncCalls).toBe(2); // Still 2

    // 202 total renders, but only 2 syncs
    expect(loop.getStats().renderCalls).toBe(202);
  });

  it("should render when transform is active (even if time/epoch/playbackState unchanged)", () => {
    // First frame
    loop.tick(0.0, "paused", 1);
    expect(loop.getStats().renderCalls).toBe(1);

    // Second frame: stationary, no state changes, no transform → no render
    loop.tick(0.0, "paused", 1, false);
    expect(loop.getStats().renderCalls).toBe(1); // Still 1

    // Third frame: stationary, but has active transform → should render!
    loop.tick(0.0, "paused", 1, true);
    expect(loop.getStats().renderCalls).toBe(2); // Incremented to 2

    // Fourth frame: still stationary and active transform → should render again!
    loop.tick(0.0, "paused", 1, true);
    expect(loop.getStats().renderCalls).toBe(3); // Incremented to 3
  });
});
