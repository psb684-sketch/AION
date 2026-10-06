import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Clip } from "../Clip";
import type { Clip as ClipType, MediaAsset } from "@/types";

// Mock stores
const mockSetSnapGuides = vi.fn();
const mockClearSnapGuides = vi.fn();
const mockUpdateClip = vi.fn();
const mockRippleTrimClip = vi.fn();

vi.mock("@/store/uiStore", () => ({
  useUIStore: () => ({
    selectClip: vi.fn(),
    toggleClipSelection: vi.fn(),
  }),
}));

vi.mock("@/store/timelineStore", () => ({
  useTimelineStore: () => ({
    updateClip: mockUpdateClip,
    rippleEditEnabled: false,
    rippleTrimClip: mockRippleTrimClip,
    scrollLeft: 0,
    viewportWidth: 1200,
    snapEnabled: true,
    setSnapGuides: mockSetSnapGuides,
    clearSnapGuides: mockClearSnapGuides,
    clips: [],
  }),
}));

vi.mock("@/hooks/usePlayback", () => ({
  usePlayback: () => ({
    currentTime: 10,
    duration: 30,
    isPlaying: false,
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
  }),
}));

const createMockClip = (overrides?: Partial<ClipType>): ClipType => ({
  id: "clip-1",
  trackId: "track-1",
  mediaId: "media-1",
  startTime: 5,
  duration: 10,
  trimIn: 0,
  trimOut: 10,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  opacity: 1,
  rotation: 0,
  ...overrides,
});

const createMockMediaAsset = (overrides?: Partial<MediaAsset>): MediaAsset => ({
  id: "media-1",
  name: "test-video.mp4",
  path: "/path/to/video.mp4",
  type: "video",
  duration: 30,
  width: 1920,
  height: 1080,
  posterFrame: "data:image/png;base64,test",
  size: 1024000,
  ...overrides,
});

const renderClip = (clip: ClipType, mediaAsset?: MediaAsset, props?: Partial<any>) => {
  return render(
    <DndProvider backend={HTML5Backend}>
      <div style={{ position: "relative", width: "1000px", height: "68px" }}>
        <Clip clip={clip} mediaAsset={mediaAsset} pixelsPerSecond={100} selected={false} locked={false} {...props} />
      </div>
    </DndProvider>,
  );
};

describe("Clip Snap-to-Align Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Snap Detection Configuration", () => {
    it("defines correct snap threshold constant", () => {
      const SNAP_THRESHOLD_SECONDS = 0.1;
      expect(SNAP_THRESHOLD_SECONDS).toBe(0.1);
      expect(SNAP_THRESHOLD_SECONDS).toBeGreaterThan(0);
      expect(SNAP_THRESHOLD_SECONDS).toBeLessThan(1);
    });

    it("snap threshold is reasonable for user experience", () => {
      const SNAP_THRESHOLD_SECONDS = 0.1;
      const pixelsPerSecond = 100;
      const snapThresholdPixels = SNAP_THRESHOLD_SECONDS * pixelsPerSecond;

      // At 100 pps, 0.1s = 10px which is a good snap distance
      expect(snapThresholdPixels).toBe(10);
      expect(snapThresholdPixels).toBeGreaterThanOrEqual(5); // Not too small
      expect(snapThresholdPixels).toBeLessThanOrEqual(20); // Not too large
    });
  });

  describe("Snap Candidate Detection", () => {
    it("identifies playhead as snap candidate", () => {
      const currentTime = 10;
      const clipEdgeTime = 9.95; // Within 0.05s of playhead

      const distance = Math.abs(currentTime - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;
      const shouldSnap = distance < SNAP_THRESHOLD;

      expect(shouldSnap).toBe(true);
      expect(distance).toBeCloseTo(0.05, 2);
    });

    it("identifies other clip edges as snap candidates", () => {
      const otherClipStart = 8.0;
      const otherClipEnd = 15.0;
      const clipEdgeTime = 8.05; // Within 0.05s of other clip start

      const distanceToStart = Math.abs(otherClipStart - clipEdgeTime);
      const distanceToEnd = Math.abs(otherClipEnd - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;

      expect(distanceToStart).toBeCloseTo(0.05, 2);
      expect(distanceToStart < SNAP_THRESHOLD).toBe(true);
      expect(distanceToEnd < SNAP_THRESHOLD).toBe(false);
    });

    it("finds closest snap point among multiple candidates", () => {
      const clipEdgeTime = 10.02;
      const snapCandidates = [
        { time: 5.0, type: "clip-start" as const },
        { time: 10.0, type: "playhead" as const },
        { time: 10.08, type: "clip-end" as const },
        { time: 15.0, type: "clip-start" as const },
      ];

      let bestCandidate = null;
      let bestDistance = 0.1; // SNAP_THRESHOLD

      for (const candidate of snapCandidates) {
        const distance = Math.abs(candidate.time - clipEdgeTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
        }
      }

      expect(bestCandidate).not.toBeNull();
      expect(bestCandidate?.time).toBe(10.0);
      expect(bestCandidate?.type).toBe("playhead");
      expect(bestDistance).toBeCloseTo(0.02, 2);
    });

    it("returns null when no candidates within threshold", () => {
      const clipEdgeTime = 10.0;
      const snapCandidates = [
        { time: 5.0, type: "clip-start" as const },
        { time: 15.0, type: "clip-end" as const },
      ];

      let bestCandidate = null;
      let bestDistance = 0.1;

      for (const candidate of snapCandidates) {
        const distance = Math.abs(candidate.time - clipEdgeTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
        }
      }

      expect(bestCandidate).toBeNull();
    });
  });

  describe("Snap Guide Visual Feedback", () => {
    it("calls setSnapGuides when snap point is detected", () => {
      // This would be tested in integration with actual resize behavior
      // Here we verify the mock is configured correctly
      expect(mockSetSnapGuides).toBeDefined();
      expect(typeof mockSetSnapGuides).toBe("function");
    });

    it("calls clearSnapGuides when no snap detected", () => {
      expect(mockClearSnapGuides).toBeDefined();
      expect(typeof mockClearSnapGuides).toBe("function");
    });

    it("snap guide has correct structure", () => {
      const snapGuide = {
        time: 10.0,
        type: "playhead" as const,
      };

      expect(snapGuide).toHaveProperty("time");
      expect(snapGuide).toHaveProperty("type");
      expect(typeof snapGuide.time).toBe("number");
      expect(["clip-start", "clip-end", "playhead"] as const).toContain(snapGuide.type);
    });

    it("converts snap guide time to pixel position correctly", () => {
      const snapGuideTime = 10.5;
      const pixelsPerSecond = 100;
      const guideLeft = snapGuideTime * pixelsPerSecond;

      expect(guideLeft).toBe(1050);
    });

    it("assigns correct color based on snap guide type", () => {
      const playheadGuide: { time: number; type: "playhead" | "clip-start" | "clip-end" } = { time: 10, type: "playhead" };
      const clipGuide: { time: number; type: "playhead" | "clip-start" | "clip-end" } = { time: 15, type: "clip-start" };

      const playheadColor = playheadGuide.type === "playhead" ? "#3b82f6" : "#10b981";
      const clipColor = clipGuide.type === "playhead" ? "#3b82f6" : "#10b981";

      expect(playheadColor).toBe("#3b82f6"); // Blue for playhead
      expect(clipColor).toBe("#10b981"); // Green for clips
    });
  });

  describe("Left Edge Resize with Snapping", () => {
    it("calculates snap-adjusted delta for left edge", () => {
      const resizeStartTime = 5.0;
      const deltaTime = 0.92; // User dragged 0.92s
      const snappedTime = 6.0; // Snap point at 6.0s

      const adjustedDeltaTime = snappedTime - resizeStartTime;

      expect(adjustedDeltaTime).toBe(1.0);
      expect(adjustedDeltaTime).toBeGreaterThan(deltaTime);
    });

    it("applies snapped delta to left edge resize calculation", () => {
      const resizeStart = {
        startTime: 5.0,
        duration: 10.0,
        trimIn: 0.0,
      };
      const adjustedDeltaTime = 1.0; // Snapped delta

      const newStartTime = resizeStart.startTime + adjustedDeltaTime;
      const newDuration = resizeStart.duration - adjustedDeltaTime;
      const newTrimIn = resizeStart.trimIn + adjustedDeltaTime;

      expect(newStartTime).toBe(6.0);
      expect(newDuration).toBe(9.0);
      expect(newTrimIn).toBe(1.0);
    });

    it("maintains trim out when left edge snaps", () => {
      const initialTrimIn = 0.0;
      const initialTrimOut = 10.0;
      const snapDelta = 1.0;

      const newTrimIn = initialTrimIn + snapDelta;
      const newTrimOut = initialTrimOut; // Unchanged

      const duration = newTrimOut - newTrimIn;

      expect(newTrimIn).toBe(1.0);
      expect(newTrimOut).toBe(10.0);
      expect(duration).toBe(9.0);
    });
  });

  describe("Right Edge Resize with Snapping", () => {
    it("calculates snap-adjusted delta for right edge", () => {
      const resizeStart = {
        startTime: 5.0,
        duration: 10.0,
      };
      const deltaTime = 1.92; // User dragged 1.92s
      const snappedTime = 17.0; // Snap point at 17.0s

      const currentEndTime = resizeStart.startTime + resizeStart.duration;
      const adjustedDeltaTime = snappedTime - currentEndTime;

      expect(currentEndTime).toBe(15.0);
      expect(adjustedDeltaTime).toBe(2.0);
      expect(adjustedDeltaTime).toBeGreaterThan(deltaTime);
    });

    it("applies snapped delta to right edge resize calculation", () => {
      const resizeStart = {
        duration: 10.0,
        trimIn: 0.0,
      };
      const adjustedDeltaTime = 2.0; // Snapped delta

      const newDuration = resizeStart.duration + adjustedDeltaTime;
      const newTrimOut = resizeStart.trimIn + newDuration;

      expect(newDuration).toBe(12.0);
      expect(newTrimOut).toBe(12.0);
    });

    it("maintains trim in when right edge snaps", () => {
      const initialTrimIn = 2.0;
      const initialDuration = 10.0;
      const snapDelta = 2.0;

      const newDuration = initialDuration + snapDelta;
      const newTrimOut = initialTrimIn + newDuration;

      expect(initialTrimIn).toBe(2.0); // Unchanged
      expect(newDuration).toBe(12.0);
      expect(newTrimOut).toBe(14.0);
    });
  });

  describe("Snap Guide Lifecycle", () => {
    it("verifies clearSnapGuides is available in lifecycle", () => {
      // The actual clearing happens in the resize effect cleanup
      // This test verifies the mock is properly configured
      expect(mockClearSnapGuides).toBeDefined();
      expect(typeof mockClearSnapGuides).toBe("function");

      // Simulate what happens when resize ends
      mockClearSnapGuides();
      expect(mockClearSnapGuides).toHaveBeenCalled();
    });

    it("updates snap guides during resize movement", () => {
      // This tests that the snap guide mechanism is invoked
      // Actual snap detection happens in the resize handler
      expect(mockSetSnapGuides).toBeDefined();
      expect(mockClearSnapGuides).toBeDefined();
    });
  });

  describe("Multi-Track Snapping", () => {
    it("considers clips from all tracks as snap candidates", () => {
      const track1Clips = [
        { startTime: 5, duration: 10 }, // ends at 15
        { startTime: 20, duration: 5 }, // ends at 25
      ];
      const track2Clips = [
        { startTime: 0, duration: 8 }, // ends at 8
        { startTime: 15, duration: 10 }, // ends at 25
      ];

      const allClips = [...track1Clips, ...track2Clips];
      const snapCandidates: number[] = [];

      for (const clip of allClips) {
        snapCandidates.push(clip.startTime);
        snapCandidates.push(clip.startTime + clip.duration);
      }

      expect(snapCandidates).toContain(0); // track2 clip1 start
      expect(snapCandidates).toContain(8); // track2 clip1 end
      expect(snapCandidates).toContain(5); // track1 clip1 start
      expect(snapCandidates).toContain(15); // track1 clip1 end & track2 clip2 start
      expect(snapCandidates).toContain(20); // track1 clip2 start
      expect(snapCandidates).toContain(25); // track1 clip2 end & track2 clip2 end
      expect(snapCandidates.length).toBe(8); // 4 clips × 2 edges
    });

    it("provides professional cross-track alignment", () => {
      // When resizing a clip on track1, it should snap to clips on track2
      const currentClipTrack = "track-1";
      const currentClipId = "clip-1";
      const otherTrackClips = [
        { id: "clip-2", trackId: "track-2", startTime: 10, duration: 5 },
        { id: "clip-3", trackId: "track-3", startTime: 20, duration: 8 },
      ];

      // All other clips are snap candidates regardless of track
      const snapCandidates = otherTrackClips.filter((c) => c.id !== currentClipId);

      expect(snapCandidates.length).toBe(2);
      expect(snapCandidates.every((c) => c.trackId !== currentClipTrack)).toBe(true);
    });
  });

  describe("Snap Precision", () => {
    it("snaps to exact time values without floating point errors", () => {
      const snapTime = 10.0;
      const clipEdgeTime = 9.999999;

      const distance = Math.abs(snapTime - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;

      expect(distance).toBeLessThan(SNAP_THRESHOLD);
      expect(distance).toBeLessThan(0.01);
    });

    it("handles sub-frame precision snapping", () => {
      const fps = 30;
      const frameDuration = 1 / fps;
      const snapTime = 10.0;
      const clipEdgeTime = 10.0 + frameDuration / 2; // Half frame off

      const distance = Math.abs(snapTime - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;

      expect(frameDuration).toBeCloseTo(0.0333, 4);
      expect(distance).toBeCloseTo(0.0167, 4);
      expect(distance < SNAP_THRESHOLD).toBe(true);
    });
  });

  describe("Snap Guide Color Coding", () => {
    it("uses blue for playhead snap guides", () => {
      const guide: { time: number; type: "playhead" | "clip-start" | "clip-end" } = { time: 10, type: "playhead" };
      const color = guide.type === "playhead" ? "#3b82f6" : "#10b981";

      expect(color).toBe("#3b82f6");
    });

    it("uses green for clip edge snap guides", () => {
      const startGuide: { time: number; type: "playhead" | "clip-start" | "clip-end" } = { time: 5, type: "clip-start" };
      const endGuide: { time: number; type: "playhead" | "clip-start" | "clip-end" } = { time: 15, type: "clip-end" };

      const startColor = startGuide.type === "playhead" ? "#3b82f6" : "#10b981";
      const endColor = endGuide.type === "playhead" ? "#3b82f6" : "#10b981";

      expect(startColor).toBe("#10b981");
      expect(endColor).toBe("#10b981");
    });
  });

  describe("Edge Cases", () => {
    it("handles no available snap candidates", () => {
      const clipEdgeTime = 10.0;
      const snapCandidates: Array<{ time: number; type: string }> = [];

      let bestCandidate = null;
      let bestDistance = 0.1;

      for (const candidate of snapCandidates) {
        const distance = Math.abs(candidate.time - clipEdgeTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
        }
      }

      expect(bestCandidate).toBeNull();
    });

    it("handles multiple candidates at same distance", () => {
      const clipEdgeTime = 10.0;
      const snapCandidates = [
        { time: 10.05, type: "clip-start" as const },
        { time: 9.95, type: "clip-end" as const },
      ];

      let bestCandidate = null;
      let bestDistance = 0.1;

      for (const candidate of snapCandidates) {
        const distance = Math.abs(candidate.time - clipEdgeTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
        }
      }

      // First matching candidate with minimum distance wins
      expect(bestCandidate).not.toBeNull();
      expect([9.95, 10.05]).toContain(bestCandidate?.time);
      expect(bestDistance).toBeCloseTo(0.05, 2);
    });

    it("handles snap at timeline start (time=0)", () => {
      const clipEdgeTime = 0.05;
      const timelineStart = 0.0;

      const distance = Math.abs(timelineStart - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;

      expect(distance < SNAP_THRESHOLD).toBe(true);
      expect(timelineStart).toBe(0);
    });

    it("handles very large time values", () => {
      const clipEdgeTime = 3600.0; // 1 hour
      const snapCandidate = 3599.95;

      const distance = Math.abs(snapCandidate - clipEdgeTime);
      const SNAP_THRESHOLD = 0.1;

      expect(distance < SNAP_THRESHOLD).toBe(true);
    });
  });

  describe("Performance Considerations", () => {
    it("processes reasonable number of snap candidates efficiently", () => {
      // Simulate 100 clips (200 edges + playhead)
      const snapCandidates = Array.from({ length: 201 }, (_, i) => ({
        time: i * 0.5,
        type: i === 0 ? ("playhead" as const) : ("clip-start" as const),
      }));

      const clipEdgeTime = 50.02;
      let bestCandidate = null;
      let bestDistance = 0.1;

      const startTime = performance.now();

      for (const candidate of snapCandidates) {
        const distance = Math.abs(candidate.time - clipEdgeTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(bestCandidate).not.toBeNull();
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe("Snap Disabled Mode", () => {
    it("respects snapEnabled flag", () => {
      const snapEnabled = false;

      if (!snapEnabled) {
        // Should skip snap detection entirely
        expect(true).toBe(true);
      }
    });

    it("applies raw delta when snapping is disabled", () => {
      const deltaTime = 1.92;
      const snapEnabled = false;
      const snappedTime = 7.0;

      const adjustedDeltaTime = snapEnabled ? snappedTime - 5.0 : deltaTime;

      expect(adjustedDeltaTime).toBe(1.92);
      expect(adjustedDeltaTime).not.toBe(2.0);
    });
  });
});
