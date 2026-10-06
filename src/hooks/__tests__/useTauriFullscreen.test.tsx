import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTauriFullscreen } from "../useTauriFullscreen";

// Mock the Tauri window API
let mockIsFullscreen = false;

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isFullscreen: vi.fn(async () => mockIsFullscreen),
    setFullscreen: vi.fn(async (value: boolean) => {
      mockIsFullscreen = value;
    }),
  }),
}));

describe("useTauriFullscreen", () => {
  beforeEach(() => {
    mockIsFullscreen = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should initialize with isFullscreen false", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    // Let the initial poll resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.isSupported).toBe(true);
  });

  it("should enter fullscreen", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);
  });

  it("should exit fullscreen", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Enter fullscreen first
    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);

    // Exit fullscreen
    await act(async () => {
      await result.current.exitFullscreen();
    });

    expect(result.current.isFullscreen).toBe(false);
  });

  it("should toggle fullscreen", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Toggle to enter
    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);

    // Toggle to exit
    await act(async () => {
      await result.current.toggleFullscreen();
    });

    expect(result.current.isFullscreen).toBe(false);
  });

  it("should detect external fullscreen changes via polling", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isFullscreen).toBe(false);

    // Simulate external fullscreen change (e.g. macOS green button)
    mockIsFullscreen = true;

    // Advance past the 500ms poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.isFullscreen).toBe(true);
  });

  it("should always report isSupported as true in Tauri", async () => {
    const { result } = renderHook(() => useTauriFullscreen());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // isSupported is hardcoded to true since Tauri always supports fullscreen
    expect(result.current.isSupported).toBe(true);
  });
});
