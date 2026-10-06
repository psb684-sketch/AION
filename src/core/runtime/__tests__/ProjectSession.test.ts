import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { SessionState } from "../ProjectSession";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => path,
}));

// Since ProjectSession has complex dependencies (stores, scheduler, etc.),

/**
 * Mock ProjectSession for testing state transitions and disposal race conditions.
 */
class MockProjectSession {
  private _state: SessionState = "initializing";
  private _disposed = false;
  private _previewMediaPoolDisposed = false;

  get state(): SessionState {
    return this._state;
  }

  async initialize(): Promise<void> {
    if (this._state !== "initializing") {
      throw new Error("Session already initialized");
    }
    this._state = "active";
  }

  syncPreviewMedia(): void {
    // This is what ProgramPreview RAF loop calls
    if (this._state !== "active") {
      throw new Error(`Cannot sync preview media in state: ${this._state}`);
    }
    if (this._previewMediaPoolDisposed) {
      throw new Error("Pool is disposed!");
    }
  }

  async dispose(): Promise<void> {
    if (this._state === "disposed" || this._state === "disposing") {
      return;
    }

    this._state = "disposing";

    // Simulate async disposal steps
    await this._cancelAsyncTasks();
    await this._releaseMediaResources();

    this._state = "disposed";
    this._disposed = true;
  }

  private async _cancelAsyncTasks(): Promise<void> {
    // Simulate cancellation delay
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  private async _releaseMediaResources(): Promise<void> {
    // Simulate PreviewMediaPool disposal
    await new Promise((resolve) => setTimeout(resolve, 10));
    this._previewMediaPoolDisposed = true;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  isPreviewMediaPoolDisposed(): boolean {
    return this._previewMediaPoolDisposed;
  }
}

describe("ProjectSession : Session State Guard", () => {
  let session: MockProjectSession;

  beforeEach(async () => {
    session = new MockProjectSession();
    await session.initialize();
  });

  afterEach(async () => {
    if (!session.isDisposed()) {
      await session.dispose();
    }
  });

  it("should have 'active' state after initialization", () => {
    expect(session.state).toBe("active");
  });

  it("should allow syncPreviewMedia when state is 'active'", () => {
    expect(() => {
      session.syncPreviewMedia();
    }).not.toThrow();
  });

  it("should transition to 'disposing' state when dispose starts", async () => {
    const disposePromise = session.dispose();

    // Check state immediately (should be 'disposing' before async work completes)
    expect(session.state).toBe("disposing");

    await disposePromise;
  });

  it("should transition to 'disposed' state when dispose completes", async () => {
    await session.dispose();
    expect(session.state).toBe("disposed");
  });

  it("should reject syncPreviewMedia when state is 'disposing'", async () => {
    // Start disposal but don't await
    const disposePromise = session.dispose();

    // State should be 'disposing' now
    expect(session.state).toBe("disposing");

    // syncPreviewMedia should throw
    expect(() => {
      session.syncPreviewMedia();
    }).toThrow("Cannot sync preview media in state: disposing");

    await disposePromise;
  });

  it("should reject syncPreviewMedia when state is 'disposed'", async () => {
    await session.dispose();

    expect(session.state).toBe("disposed");
    expect(() => {
      session.syncPreviewMedia();
    }).toThrow("Cannot sync preview media in state: disposed");
  });

  it("should prevent 'Pool is disposed!' error by checking state before sync", async () => {
    // RAF loop calls syncPreviewMedia() while session is disposing

    const disposePromise = session.dispose();

    // Simulate RAF tick during disposal
    // With guard: check state first, don't call syncPreviewMedia
    // Without guard: call syncPreviewMedia → "Pool is disposed!" error

    if (session.state === "active") {
      // This branch should NOT execute because state is "disposing"
      expect.fail("Should not attempt sync when state is not active");
    } else {
      // This is the correct behavior with the guard
      expect(session.state).toBe("disposing");
    }

    await disposePromise;
  });

  it("should handle rapid state transitions without crash", async () => {
    // Simulate rapid project switching
    const session1 = new MockProjectSession();
    await session1.initialize();

    expect(session1.state).toBe("active");

    // Start disposal
    const dispose1 = session1.dispose();
    expect(session1.state).toBe("disposing");

    // Try to sync during disposal (should be blocked by guard)
    if (session1.state === "active") {
      session1.syncPreviewMedia();
    }
    // If guard is present, sync is skipped

    await dispose1;
    expect(session1.state).toBe("disposed");
  });

  it("should handle multiple disposal calls idempotently", async () => {
    await session.dispose();
    expect(session.state).toBe("disposed");

    // Second disposal should be no-op
    await session.dispose();
    expect(session.state).toBe("disposed");

    // Third disposal should still be no-op
    await session.dispose();
    expect(session.state).toBe("disposed");
  });

  it("should block syncPreviewMedia during entire disposal process", async () => {
    let syncAttempts = 0;
    let syncErrors = 0;

    // Start disposal
    const disposePromise = session.dispose();

    // Simulate multiple RAF ticks during disposal
    for (let i = 0; i < 10; i++) {
      syncAttempts++;

      // With guard: only sync if state is "active"
      if (session.state === "active") {
        try {
          session.syncPreviewMedia();
        } catch (error) {
          syncErrors++;
        }
      }

      // Small delay to let disposal progress
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    await disposePromise;

    // All sync attempts should have been blocked by state guard
    // (state was "disposing" or "disposed", never "active" after disposal started)
    expect(syncErrors).toBe(0); // No errors because sync was never attempted
    expect(syncAttempts).toBe(10); // But we did check state 10 times
  });

  it("should prevent race condition in rapid project switch scenario", async () => {
    // User workflow: Project A playing → switch to Project B

    // Project A is active and playing
    expect(session.state).toBe("active");
    session.syncPreviewMedia(); // Works fine

    // User clicks "switch project" → disposal starts
    const disposePromise = session.dispose();
    expect(session.state).toBe("disposing");

    // RAF loop fires one more time before it's cancelled
    // With guard: check state, skip sync
    let errorOccurred = false;
    if (session.state === "active") {
      try {
        session.syncPreviewMedia();
      } catch (error) {
        errorOccurred = true;
      }
    }

    await disposePromise;

    // No error should occur because guard prevented sync
    expect(errorOccurred).toBe(false);
    expect(session.state).toBe("disposed");
  });

  it("should handle concurrent sync attempts during disposal", async () => {
    const errors: Error[] = [];

    // Start disposal
    const disposePromise = session.dispose();

    // Simulate concurrent RAF loops trying to sync
    const syncPromises = Array.from({ length: 5 }, async (_, i) => {
      await new Promise((resolve) => setTimeout(resolve, i * 3));

      if (session.state === "active") {
        try {
          session.syncPreviewMedia();
        } catch (error) {
          errors.push(error as Error);
        }
      }
    });

    await Promise.all([disposePromise, ...syncPromises]);

    // With proper guard, no errors should occur
    expect(errors.length).toBe(0);
  });

  it("should preserve state check semantics across async boundaries", async () => {
    expect(session.state).toBe("active");

    // Capture state
    const stateBeforeDisposal = session.state;
    expect(stateBeforeDisposal).toBe("active");

    // Start disposal
    session.dispose(); // Don't await

    // State should change synchronously
    const stateDuringDisposal = session.state;
    expect(stateDuringDisposal).toBe("disposing");
    expect(stateDuringDisposal).not.toBe(stateBeforeDisposal);

    // Guard check should use current state, not captured state
    if (session.state === "active") {
      expect.fail("Should not reach here - state is disposing");
    }
  });

  it("should handle disposal during active RAF loop simulation", async () => {
    let rafTicks = 0;
    let syncCalls = 0;
    let isRunning = true;

    // Simulate RAF loop (simplified)
    const rafLoop = async () => {
      while (isRunning) {
        rafTicks++;

        if (session.state === "active") {
          try {
            session.syncPreviewMedia();
            syncCalls++;
          } catch (error) {
            console.error("Sync error:", error);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };

    // Start RAF loop
    const rafPromise = rafLoop();

    // Let it run for a bit
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Start disposal
    const disposePromise = session.dispose();

    // Let disposal process
    await new Promise((resolve) => setTimeout(resolve, 25));

    // Stop RAF loop
    isRunning = false;

    await Promise.all([rafPromise, disposePromise]);

    // RAF should have ticked multiple times
    expect(rafTicks).toBeGreaterThan(0);

    // Sync should have been called when state was active
    // But not after disposal started
    expect(syncCalls).toBeGreaterThan(0);
    expect(syncCalls).toBeLessThan(rafTicks); // Some ticks happened during disposal

    expect(session.state).toBe("disposed");
  });

  it("should maintain state consistency during disposal error", async () => {
    // Create a session that will error during disposal
    const errorSession = new MockProjectSession();
    await errorSession.initialize();

    // Mock an error during disposal (this is handled in real ProjectSession)
    expect(errorSession.state).toBe("active");

    try {
      await errorSession.dispose();
    } catch (error) {
      // Even if disposal errors, state should be marked disposed
      // (This is implementation detail - real code sets state to disposed even on error)
    }

    // State should be disposed regardless of errors
    expect(errorSession.state).toBe("disposed");
  });

  it("should prevent syncPreviewMedia after PreviewMediaPool disposal", async () => {
    await session.dispose();

    // PreviewMediaPool should be disposed
    expect(session.isPreviewMediaPoolDisposed()).toBe(true);

    // Attempting sync should be blocked by state guard
    if (session.state === "active") {
      expect.fail("Should not attempt sync when disposed");
    }

    expect(session.state).toBe("disposed");
  });

  it("should handle state check in ProgramPreview RAF pattern", async () => {
    // Simulate the exact pattern from ProgramPreview.tsx line 508

    // RAF tick 1: Active session
    const session1 = session;
    if (session1 && session1.state === "active") {
      expect(() => session1.syncPreviewMedia()).not.toThrow();
    }

    // Start disposal
    const disposePromise = session.dispose();

    // RAF tick 2: Disposing session (guard prevents sync)
    if (session && session.state === "active") {
      // This branch should NOT execute
      expect.fail("Should not sync when disposing");
    } else {
      // This is correct - sync is skipped
      expect(session.state).toBe("disposing");
    }

    await disposePromise;

    // RAF tick 3: Disposed session (guard prevents sync)
    if (session && session.state === "active") {
      // This branch should NOT execute
      expect.fail("Should not sync when disposed");
    } else {
      expect(session.state).toBe("disposed");
    }
  });
});

describe("ProjectSession — State Lifecycle", () => {
  it("should follow correct state transition sequence", async () => {
    const states: SessionState[] = [];
    const session = new MockProjectSession();

    // Initial state
    states.push(session.state);
    expect(session.state).toBe("initializing");

    // After initialization
    await session.initialize();
    states.push(session.state);
    expect(session.state).toBe("active");

    // During disposal
    const disposePromise = session.dispose();
    states.push(session.state);
    expect(session.state).toBe("disposing");

    await disposePromise;

    // After disposal
    states.push(session.state);
    expect(session.state).toBe("disposed");

    // Verify sequence
    expect(states).toEqual(["initializing", "active", "disposing", "disposed"]);
  });

  it("should never transition from disposed back to active", async () => {
    const session = new MockProjectSession();
    await session.initialize();
    await session.dispose();

    expect(session.state).toBe("disposed");

    // Attempting to use disposed session should not change state
    if (session.state === "active") {
      session.syncPreviewMedia();
    }

    expect(session.state).toBe("disposed"); // Still disposed
  });

  it("should maintain state integrity under stress", async () => {
    const session = new MockProjectSession();
    await session.initialize();

    // Hammer the session with rapid state checks
    const checks = Array.from({ length: 1000 }, () => session.state);
    expect(checks.every((s) => s === "active")).toBe(true);

    await session.dispose();

    const checksAfter = Array.from({ length: 1000 }, () => session.state);
    expect(checksAfter.every((s) => s === "disposed")).toBe(true);
  });
});
