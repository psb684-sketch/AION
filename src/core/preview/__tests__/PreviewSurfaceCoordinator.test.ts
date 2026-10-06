import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PreviewSurfaceCoordinator } from "../PreviewSurfaceCoordinator";

// Mock Tauri platform APIs
vi.mock("@/lib/platform/tauri", () => ({
  hideNativeSurface: vi.fn().mockResolvedValue(undefined),
  isTauriRuntime: vi.fn().mockReturnValue(true),
}));

vi.mock("@/core/runtime/nativeSurfaceLifecycle", () => ({
  configureNativeSurface: vi.fn().mockResolvedValue({
    ownerProjectId: "test-proj",
    revision: 1,
    geometryKey: "1:2:3:4:1",
    probe: {},
  }),
}));

describe("PreviewSurfaceCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes in paused state with webview-canvas mode", () => {
    const coordinator = new PreviewSurfaceCoordinator({
      projectId: "test-proj",
    });

    expect(coordinator.getState()).toBe("paused");
    expect(coordinator.getPresentationMode()).toBe("webview-canvas");
    coordinator.dispose();
  });

  it("transitions to native-direct-surface on play start", async () => {
    const onModeChange = vi.fn();
    const coordinator = new PreviewSurfaceCoordinator({
      projectId: "test-proj",
      onPresentationModeChange: onModeChange,
    });

    await coordinator.onPlayStart(true);

    expect(coordinator.getState()).toBe("playing");
    expect(coordinator.getPresentationMode()).toBe("native-direct-surface");
    expect(onModeChange).toHaveBeenCalledWith("native-direct-surface");
    coordinator.dispose();
  });

  it("transitions back to webview-canvas and hides surface on play stop", async () => {
    const { hideNativeSurface } = await import("@/lib/platform/tauri");
    const onModeChange = vi.fn();
    const coordinator = new PreviewSurfaceCoordinator({
      projectId: "test-proj",
      onPresentationModeChange: onModeChange,
    });

    await coordinator.onPlayStart(true);
    await coordinator.onPlayStop();

    expect(coordinator.getState()).toBe("paused");
    expect(coordinator.getPresentationMode()).toBe("webview-canvas");
    expect(hideNativeSurface).toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith("webview-canvas");
    coordinator.dispose();
  });

  it("debounces geometry updates when paused", async () => {
    const { configureNativeSurface } = await import(
      "@/core/runtime/nativeSurfaceLifecycle"
    );
    const coordinator = new PreviewSurfaceCoordinator({
      projectId: "test-proj",
      debounceMs: 100,
    });

    const mockGeo = {
      xPhysical: 100,
      yPhysical: 200,
      widthPhysical: 800,
      heightPhysical: 600,
      devicePixelRatio: 1,
    };

    coordinator.updateGeometry(mockGeo, false);
    expect(configureNativeSurface).not.toHaveBeenCalled();

    // Advance timers past debounce threshold
    vi.advanceTimersByTime(110);
    expect(configureNativeSurface).toHaveBeenCalledWith("test-proj", mockGeo);
    coordinator.dispose();
  });

  it("flushes geometry immediately when playing", async () => {
    const { configureNativeSurface } = await import(
      "@/core/runtime/nativeSurfaceLifecycle"
    );
    const coordinator = new PreviewSurfaceCoordinator({
      projectId: "test-proj",
    });

    await coordinator.onPlayStart(true);

    const mockGeo = {
      xPhysical: 100,
      yPhysical: 200,
      widthPhysical: 800,
      heightPhysical: 600,
      devicePixelRatio: 1,
    };

    coordinator.updateGeometry(mockGeo, false);
    expect(configureNativeSurface).toHaveBeenCalledWith("test-proj", mockGeo);
    coordinator.dispose();
  });
});
