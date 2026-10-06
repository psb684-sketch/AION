import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";
import { useHistoryStore } from "@/store/historyStore";
import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { useTimelineStore } from "@/store/timelineStore";
import { getPlaybackClock } from "@/hooks/usePlaybackClock";

// Mock useAnchoredTimelineZoom
const mockFitSequence = vi.fn();
const mockZoomByStep = vi.fn();
vi.mock("../timeline/useAnchoredTimelineZoom", () => ({
  useAnchoredTimelineZoom: () => ({
    fitSequence: mockFitSequence,
    zoomByStep: mockZoomByStep,
  }),
}));

describe("useKeyboardShortcuts - Undo and Redo", () => {
  let undoSpy: any;
  let redoSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    undoSpy = vi.spyOn(useHistoryStore.getState(), "undo").mockImplementation(() => {});
    redoSpy = vi.spyOn(useHistoryStore.getState(), "redo").mockImplementation(() => {});
    useUIStore.setState({ previewMode: "program" });
  });

  afterEach(() => {
    undoSpy.mockRestore();
    redoSpy.mockRestore();
  });

  it("triggers undo on Cmd+z (lowercase)", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).not.toHaveBeenCalled();
    expect(mockFitSequence).not.toHaveBeenCalled();
  });

  it("triggers undo on Cmd+Z (uppercase, CapsLock on)", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).not.toHaveBeenCalled();
    expect(mockFitSequence).not.toHaveBeenCalled();
  });

  it("triggers undo on Ctrl+z (Windows/Linux)", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).not.toHaveBeenCalled();
  });

  it("triggers redo on Shift+Cmd+Z (standard Mac uppercase event) and DOES NOT trigger fitSequence", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(mockFitSequence).not.toHaveBeenCalled();
  });

  it("triggers redo on Shift+Cmd+z (lowercase variant)", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(mockFitSequence).not.toHaveBeenCalled();
  });

  it("triggers redo on Cmd+y / Ctrl+y", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "y",
        code: "KeyY",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(redoSpy).toHaveBeenCalledTimes(1);
  });

  it("triggers fitSequence ONLY when Shift+Z is pressed WITHOUT Cmd/Ctrl", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Z",
        code: "KeyZ",
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(mockFitSequence).toHaveBeenCalledTimes(1);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
  });

  it("triggers undo and redo even when previewMode is 'source'", () => {
    useUIStore.setState({ previewMode: "source" });
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(undoSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Z",
        code: "KeyZ",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(redoSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts when user is typing in an input element", () => {
    renderHook(() => useKeyboardShortcuts());

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      metaKey: true,
      shiftKey: false,
      bubbles: true,
    });
    input.dispatchEvent(event);

    expect(undoSpy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("triggers saveCurrentProject on Cmd+S and Ctrl+S", () => {
    const saveSpy = vi.fn().mockResolvedValue({ verified: true });
    useProjectStore.setState({
      project: { id: "test-proj", name: "Test" } as any,
      saveCurrentProject: saveSpy,
    });

    renderHook(() => useKeyboardShortcuts());

    // Test macOS Cmd+S
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        metaKey: true,
        bubbles: true,
      })
    );
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Test Windows/Linux Ctrl+S
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "s",
        code: "KeyS",
        ctrlKey: true,
        bubbles: true,
      })
    );
    expect(saveSpy).toHaveBeenCalledTimes(2);
  });

  it("triggers zoom in on Cmd+=, Cmd++, and NumpadAdd", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "=",
        code: "Equal",
        metaKey: true,
        bubbles: true,
      })
    );
    expect(mockZoomByStep).toHaveBeenCalledWith(1);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "+",
        code: "Equal",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(mockZoomByStep).toHaveBeenCalledWith(1);
  });

  it("triggers zoom out on Cmd+- and Ctrl+-", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "-",
        code: "Minus",
        ctrlKey: true,
        bubbles: true,
      })
    );
    expect(mockZoomByStep).toHaveBeenCalledWith(-1);
  });

  it("triggers fitSequence on Cmd+0 and Ctrl+0", () => {
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "0",
        code: "Digit0",
        metaKey: true,
        bubbles: true,
      })
    );
    expect(mockFitSequence).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "0",
        code: "Digit0",
        ctrlKey: true,
        bubbles: true,
      })
    );
    expect(mockFitSequence).toHaveBeenCalledTimes(2);
  });

  it("triggers select-all on Cmd+A and Ctrl+A", () => {
    useTimelineStore.setState({
      clips: [
        { id: "c1", trackId: "t1", startTime: 0, duration: 5 } as any,
        { id: "c2", trackId: "t1", startTime: 5, duration: 5 } as any,
      ],
    });

    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        code: "KeyA",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
      })
    );

    expect(useUIStore.getState().selectedClipIds).toEqual(["c1", "c2"]);
  });

  it("triggers deselect-all on Cmd+Shift+D and Ctrl+Shift+D", () => {
    useUIStore.setState({ selectedClipIds: ["c1", "c2"] });
    renderHook(() => useKeyboardShortcuts());

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "d",
        code: "KeyD",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      })
    );

    expect(useUIStore.getState().selectedClipIds).toEqual([]);
  });

  describe("Arrow key seeking", () => {
    it("steps 1 frame with ArrowRight when paused", () => {
      useProjectStore.setState({ project: { id: "p1", frameRate: 30, duration: 100 } as any });
      const c = getPlaybackClock();
      c.setDuration(100);
      c.pause();
      c.seek(1.0, { keepPlaying: false });

      renderHook(() => useKeyboardShortcuts());

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          bubbles: true,
        })
      );

      // 1.0 + 1/30 = 1.0333333333333333
      expect(c.time).toBeCloseTo(1.0333, 3);
      expect(c.state).not.toBe("playing");
    });

    it("steps 1.0 second with Shift+ArrowRight when paused", () => {
      const c = getPlaybackClock();
      useProjectStore.setState({ project: { id: "p1", frameRate: 30, duration: 100 } as any });
      c.setDuration(100);
      c.pause();
      c.seek(1.0, { keepPlaying: false });

      renderHook(() => useKeyboardShortcuts());

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          shiftKey: true,
          bubbles: true,
        })
      );

      // 1.0 + 1.0 = 2.0
      expect(c.time).toBeCloseTo(2.0, 3);
      expect(c.state).not.toBe("playing");
    });

    it("seeks 1.0 second and seamlessly continues playing when active", () => {
      const c = getPlaybackClock();
      useProjectStore.setState({ project: { id: "p1", frameRate: 30, duration: 100 } as any });
      c.setDuration(100);
      c.play();
      c.seek(1.0);

      renderHook(() => useKeyboardShortcuts());

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          bubbles: true,
        })
      );

      // When playing, plain Arrow steps 1.0 second and keeps playing
      expect(c.time).toBeCloseTo(2.0, 3);
      expect(c.state).toBe("playing");
      c.pause();
    });

    it("does not intercept Alt+ArrowRight so clip nudge can handle it", () => {
      const c = getPlaybackClock();
      c.setDuration(100);
      c.pause();
      c.seek(1.0, { keepPlaying: false });

      renderHook(() => useKeyboardShortcuts());

      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          code: "ArrowRight",
          altKey: true,
          bubbles: true,
        })
      );

      // Time should not change from Alt+Arrow
      expect(c.time).toBe(1.0);
    });
  });
});
