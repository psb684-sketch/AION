import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineKeyframeLane } from "../InlineKeyframeLane";
import { useUIStore } from "@/store/uiStore";
import { useTimelineStore } from "@/store/timelineStore";
import type { Clip } from "@/types";

const mockSeek = vi.fn();
vi.mock("@/hooks/usePlaybackClock", () => ({
  usePlaybackClock: () => ({ time: 1.0, isPlaying: false, duration: 10 }),
  usePlaybackControls: () => ({ seek: mockSeek, play: vi.fn(), pause: vi.fn() }),
  getPlaybackClock: () => ({ time: 1.0, isPlaying: false, duration: 10, seek: mockSeek }),
}));

describe("InlineKeyframeLane", () => {
  const clipWithKeyframes: Clip = {
    id: "clip-kf-1",
    trackId: "track-1",
    mediaId: "media-1",
    startTime: 2,
    duration: 6,
    trimIn: 0,
    trimOut: 6,
    x: 100,
    y: 200,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    visualKeyframes: {
      rotation: [
        { id: "kf-rot-1", time: 0, value: 0, easing: "linear" },
        { id: "kf-rot-2", time: 3, value: 45, easing: "easeOut" },
      ],
      opacity: [
        { id: "kf-op-1", time: 1, value: 0, easing: "easeIn" },
        { id: "kf-op-2", time: 4, value: 1, easing: "easeOut" },
      ],
    },
  };

  beforeEach(() => {
    mockSeek.mockClear();
    useTimelineStore.setState({
      clips: [clipWithKeyframes],
    });
    useUIStore.setState({
      expandedKeyframeClipIds: [],
      activeCurveEditor: null,
    });
  });

  it("renders compact mode with diamond keyframe markers", () => {
    render(
      <InlineKeyframeLane
        clip={clipWithKeyframes}
        clipWidthPx={600}
        pixelsPerSecond={100}
        isExpanded={false}
      />,
    );

    const diamonds = screen.getAllByRole("button");
    expect(diamonds.length).toBeGreaterThan(0);
  });

  it("seeks playhead when a keyframe diamond is clicked", () => {
    render(
      <InlineKeyframeLane
        clip={clipWithKeyframes}
        clipWidthPx={600}
        pixelsPerSecond={100}
        isExpanded={false}
      />,
    );

    const diamonds = screen.getAllByRole("button");
    fireEvent.click(diamonds[0]);
    expect(mockSeek).toHaveBeenCalledWith(clipWithKeyframes.startTime + 0);
  });

  it("renders expanded sub-lanes with property labels when isExpanded is true", () => {
    render(
      <InlineKeyframeLane
        clip={clipWithKeyframes}
        clipWidthPx={600}
        pixelsPerSecond={100}
        isExpanded={true}
      />,
    );

    expect(screen.getByText(/Keyframe Animation Lanes/i)).toBeInTheDocument();
    expect(screen.getByText("Rotation")).toBeInTheDocument();
    expect(screen.getByText("Opacity")).toBeInTheDocument();
  });

  it("opens Curve Editor when segment curve is clicked in expanded mode", () => {
    render(
      <InlineKeyframeLane
        clip={clipWithKeyframes}
        clipWidthPx={600}
        pixelsPerSecond={100}
        isExpanded={true}
      />,
    );

    const curveSegments = screen.getAllByTitle(/Click to Edit Curve/i);
    fireEvent.click(curveSegments[0]);

    expect(useUIStore.getState().activeCurveEditor).toEqual({
      clipId: "clip-kf-1",
      property: "rotation",
      keyframeIndex: 0,
    });
  });
});
