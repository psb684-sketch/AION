import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurveEditorModal } from "../CurveEditorModal";
import { useUIStore } from "@/store/uiStore";
import { useTimelineStore } from "@/store/timelineStore";
import type { Clip } from "@/types";

vi.mock("@/hooks/usePlaybackClock", () => ({
  usePlaybackClock: () => ({ time: 0.5, isPlaying: false, duration: 5 }),
  usePlaybackControls: () => ({ seek: vi.fn(), play: vi.fn(), pause: vi.fn() }),
  getPlaybackClock: () => ({ time: 0.5, isPlaying: false, duration: 5, seek: vi.fn() }),
}));

describe("CurveEditorModal", () => {
  const mockClip: Clip = {
    id: "clip-test-1",
    name: "Test Video",
    trackId: "track-1",
    mediaId: "media-1",
    startTime: 0,
    duration: 5,
    trimIn: 0,
    trimOut: 5,
    x: 960,
    y: 540,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    visualKeyframes: {
      rotation: [
        { id: "kf-1", time: 0, value: 0, easing: "linear" },
        { id: "kf-2", time: 2, value: 90, easing: "easeOut" },
      ],
    },
  };

  beforeEach(() => {
    useTimelineStore.setState({
      clips: [mockClip],
      tracks: [{ id: "track-1", type: "video", name: "V1", locked: false, visible: true, muted: false, height: 60 }],
    });
    useUIStore.setState({
      activeCurveEditor: {
        clipId: "clip-test-1",
        property: "rotation",
        keyframeIndex: 0,
      },
    });
  });

  it("renders when activeCurveEditor is set", () => {
    render(<CurveEditorModal />);
    expect(screen.getByText(/Speed & Curve Editor/i)).toBeInTheDocument();
    expect(screen.getByText(/ROTATION/i)).toBeInTheDocument();
  });

  it("renders the SVG canvas and tangent information", () => {
    render(<CurveEditorModal />);
    expect(screen.getByText(/P1:/i)).toBeInTheDocument();
    expect(screen.getByText(/P2:/i)).toBeInTheDocument();
  });

  it("allows switching between Value Curve and Speed Profile", () => {
    render(<CurveEditorModal />);
    const speedBtn = screen.getByText(/Speed Profile/i);
    fireEvent.click(speedBtn);
    expect(speedBtn).toBeInTheDocument();

    const valueBtn = screen.getByText(/Value Curve/i);
    fireEvent.click(valueBtn);
    expect(valueBtn).toBeInTheDocument();
  });

  it("selects a curve preset when clicked", () => {
    render(<CurveEditorModal />);
    const overshootPreset = screen.getByText("Overshoot (Back)");
    fireEvent.click(overshootPreset);

    // Should reflect in the manual adjustments readout
    expect(screen.getByText(/Manual Tangent Micro-Adjustments/i)).toBeInTheDocument();
  });

  it("closes modal on cancel", () => {
    render(<CurveEditorModal />);
    const cancelBtn = screen.getByRole("button", { name: /^Cancel$/i });
    fireEvent.click(cancelBtn);
    expect(useUIStore.getState().activeCurveEditor).toBeNull();
  });
});
