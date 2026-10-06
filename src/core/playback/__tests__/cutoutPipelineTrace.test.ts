import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  traceCutoutEvent,
  getCutoutPipelineHistory,
  dumpCutoutPipelineTrace,
  isCutoutDebugEnabled,
} from "../cutoutPipelineTrace";
import { perfLogService } from "@/services/perfLogService";

vi.mock("@/services/perfLogService", () => ({
  perfLogService: {
    enqueue: vi.fn(),
    getSessionId: vi.fn(() => "test-session-123"),
  },
}));

describe("cutoutPipelineTrace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records cutout events across different stages", () => {
    traceCutoutEvent("eval", "Synthesized layer video-1:subject-cutout", {
      behindClipId: "text-1",
      cutoutLayerId: "video-1:subject-cutout",
      cutoutZIndex: 2.5,
    });

    const history = getCutoutPipelineHistory();
    expect(history.length).toBeGreaterThan(0);
    const last = history[history.length - 1];
    expect(last.stage).toBe("eval");
    expect(last.message).toContain("Synthesized layer video-1:subject-cutout");
    expect(last.details.cutoutZIndex).toBe(2.5);
    expect(last.level).toBe("info");

    expect(perfLogService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ai-inference",
        sessionId: "test-session-123",
        payload: expect.objectContaining({
          category: "cutout-pipeline",
          stage: "eval",
          message: "Synthesized layer video-1:subject-cutout",
        }),
      }),
    );
  });

  it("handles warning and error levels properly", () => {
    traceCutoutEvent(
      "source",
      "No video element found for clip clip-1",
      { clipId: "clip-1" },
      "warn",
    );

    const history = getCutoutPipelineHistory();
    const last = history[history.length - 1];
    expect(last.stage).toBe("source");
    expect(last.level).toBe("warn");
  });

  it("dumps pipeline summary without throwing", () => {
    const consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
    const consoleTableSpy = vi.spyOn(console, "table").mockImplementation(() => {});
    const consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});

    expect(() => dumpCutoutPipelineTrace()).not.toThrow();
    expect(consoleGroupSpy).toHaveBeenCalled();
    expect(consoleTableSpy).toHaveBeenCalled();
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    consoleGroupSpy.mockRestore();
    consoleTableSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  it("respects debug flag settings", () => {
    expect(typeof isCutoutDebugEnabled()).toBe("boolean");
  });
});
