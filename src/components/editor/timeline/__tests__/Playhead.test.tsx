import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Playhead } from "../Playhead";
import { useTimelineStore } from "@/store/timelineStore";
import { useProjectStore } from "@/store/projectStore";

const beginScrubMock = vi.fn();
const updateScrubMock = vi.fn();
const endScrubMock = vi.fn();
const seekMock = vi.fn();

vi.mock("@/hooks/usePlaybackClock", () => ({
  usePlaybackClock: () => ({
    time: 2.5,
    duration: 30,
    state: "stopped",
    speed: 1,
    frameRate: 30,
  }),
  useTransportControls: () => ({
    seek: seekMock,
    beginScrub: beginScrubMock,
    updateScrub: updateScrubMock,
    endScrub: endScrubMock,
  }),
  getPlaybackClock: () => ({
    time: 2.5,
    duration: 30,
    state: "stopped",
    speed: 1,
    frameRate: 30,
  }),
}));

vi.mock("@/core/interactions", () => ({
  getPreviewInteractionCoordinator: () => ({
    begin: vi.fn().mockReturnValue("token-123"),
    update: vi.fn(),
    commit: vi.fn(),
    cancel: vi.fn(),
  }),
}));

describe("Playhead Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimelineStore.setState({ scrollLeft: 0 });
    useProjectStore.setState({
      project: {
        id: "test-proj",
        name: "Test",
        aspectRatio: "16:9",
        canvasWidth: 1920,
        canvasHeight: 1080,
        duration: 30,
        frameRate: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  });

  it("renders with default canonical rulerHeight of 24px and sticky handle dock", () => {
    const containerRef = {
      current: document.createElement("div"),
    };

    const { container } = render(
      <Playhead
        pixelsPerSecond={100}
        duration={30}
        containerRef={containerRef}
      />,
    );

    const playhead = container.querySelector(
      "[data-playhead='true']",
    ) as HTMLElement;
    expect(playhead).toBeDefined();

    // Check sticky handle dock
    const handleDock = playhead.querySelector(
      "[data-playhead-handle-dock='true']",
    ) as HTMLElement;
    expect(handleDock).toBeDefined();
    expect(handleDock.className).toContain("sticky");
    expect(handleDock.className).toContain("top-0");
    expect(handleDock.style.height).toBe("24px");

    // Check visual line starts at 24px and extends to bottom: 0
    const visualLine = playhead.querySelector(
      "[data-playhead-line='true']",
    ) as HTMLElement;
    expect(visualLine).toBeDefined();
    expect(visualLine.style.top).toBe("24px");
    expect(visualLine.style.bottom).toBe("0px");

    // Check handle circle is vertically centered inside 24px ruler
    const handle = playhead.querySelector(
      "[data-playhead-handle='true']",
    ) as HTMLElement;
    expect(handle).toBeDefined();
    expect(handle.style.top).toBe("6px"); // (24 - 12) / 2 = 6px
  });

  it("respects custom rulerHeight prop", () => {
    const containerRef = {
      current: document.createElement("div"),
    };

    const { container } = render(
      <Playhead
        pixelsPerSecond={100}
        duration={30}
        containerRef={containerRef}
        rulerHeight={32}
      />,
    );

    const playhead = container.querySelector(
      "[data-playhead='true']",
    ) as HTMLElement;

    const handleDock = playhead.querySelector(
      "[data-playhead-handle-dock='true']",
    ) as HTMLElement;
    expect(handleDock.style.height).toBe("32px");

    const visualLine = playhead.querySelector(
      "[data-playhead-line='true']",
    ) as HTMLElement;
    expect(visualLine.style.top).toBe("32px");

    const handle = playhead.querySelector(
      "[data-playhead-handle='true']",
    ) as HTMLElement;
    expect(handle.style.top).toBe("10px"); // (32 - 12) / 2 = 10px
  });

  it("initiates scrub on handle pointer down", () => {
    const mockContainer = document.createElement("div");
    mockContainer.scrollLeft = 0;
    mockContainer.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 1000,
        top: 0,
        bottom: 500,
        width: 1000,
        height: 500,
      }) as DOMRect;

    const containerRef = { current: mockContainer };

    const { container } = render(
      <Playhead
        pixelsPerSecond={100}
        duration={30}
        containerRef={containerRef}
        rulerHeight={24}
      />,
    );

    const handle = container.querySelector(
      "[data-playhead-handle='true']",
    ) as HTMLElement;

    fireEvent.pointerDown(handle, {
      clientX: 250,
      clientY: 10,
      pointerId: 1,
      button: 0,
    });

    expect(beginScrubMock).toHaveBeenCalledTimes(1);
  });
});
