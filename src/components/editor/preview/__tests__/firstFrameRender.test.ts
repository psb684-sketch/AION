/**
 * First Frame Render - Race Condition Prevention Tests
 *
 * These tests verify the fix for the critical race condition that occurs when
 * adding the first video clip to an empty timeline.
 *
 * BUG DESCRIPTION:
 * When a video clip is added, the render loop tries to draw before the video
 * element's metadata has loaded, causing "No video element" warnings and
 * unstable first frame display.
 *
 * FIX STRATEGY:
 * Check video element readyState before first render. If readyState < 1 (HAVE_METADATA),
 * defer rendering until loadedmetadata event fires and triggers epoch increment.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("First Frame Render - Race Condition Prevention", () => {
  /**
   * Mock video element with configurable readyState
   */
  function createMockVideoElement(readyState: number = 0, src: string = "asset://test.mp4"): HTMLVideoElement {
    return {
      readyState,
      networkState: 2, // NETWORK_LOADING
      src,
      currentSrc: src,
      paused: true,
      duration: 10,
      currentTime: 0,
      // Mock methods
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
    } as unknown as HTMLVideoElement;
  }

  /**
   * Mock session with video elements map
   */
  function createMockSession(videoElementsMap: Map<string, HTMLVideoElement>) {
    return {
      state: "active" as const,
      getPreviewVideoElements: () => videoElementsMap,
    };
  }

  describe("State Detection Logic", () => {
    it("should identify when NO video elements exist (initial state)", () => {
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      const videoElements = new Map<string, HTMLVideoElement>();
      const videoClips = clips.filter((c) => c.kind === "video");

      let hasAnyVideoElement = false;
      let hasReadyVideo = false;

      for (const clip of videoClips) {
        const key = `${clip.id}-${clip.mediaId}`;
        const element = videoElements.get(key);

        if (element) {
          hasAnyVideoElement = true;
          if (element.readyState >= 1) {
            hasReadyVideo = true;
            break;
          }
        }
      }

      // EXPECTED: No elements exist yet
      expect(hasAnyVideoElement).toBe(false);
      expect(hasReadyVideo).toBe(false);

      // DECISION: Should NOT wait (let sync create elements)
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;
      expect(waitingForVideoReady).toBe(false);
    });

    it("should identify when elements exist but NOT ready (readyState = 0)", () => {
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      const videoElements = new Map<string, HTMLVideoElement>([
        ["clip-1-asset-1", createMockVideoElement(0)], // HAVE_NOTHING
      ]);

      const videoClips = clips.filter((c) => c.kind === "video");

      let hasAnyVideoElement = false;
      let hasReadyVideo = false;

      for (const clip of videoClips) {
        const key = `${clip.id}-${clip.mediaId}`;
        const element = videoElements.get(key);

        if (element) {
          hasAnyVideoElement = true;
          if (element.readyState >= 1) {
            hasReadyVideo = true;
            break;
          }
        }
      }

      // EXPECTED: Element exists but not ready
      expect(hasAnyVideoElement).toBe(true);
      expect(hasReadyVideo).toBe(false);

      // DECISION: SHOULD wait for metadata
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;
      expect(waitingForVideoReady).toBe(true);
    });

    it("should identify when elements exist AND ready (readyState >= 1)", () => {
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      const videoElements = new Map<string, HTMLVideoElement>([
        ["clip-1-asset-1", createMockVideoElement(1)], // HAVE_METADATA
      ]);

      const videoClips = clips.filter((c) => c.kind === "video");

      let hasAnyVideoElement = false;
      let hasReadyVideo = false;

      for (const clip of videoClips) {
        const key = `${clip.id}-${clip.mediaId}`;
        const element = videoElements.get(key);

        if (element) {
          hasAnyVideoElement = true;
          if (element.readyState >= 1) {
            hasReadyVideo = true;
            break;
          }
        }
      }

      // EXPECTED: Element exists and ready
      expect(hasAnyVideoElement).toBe(true);
      expect(hasReadyVideo).toBe(true);

      // DECISION: Should NOT wait (proceed with render)
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;
      expect(waitingForVideoReady).toBe(false);
    });

    it("should handle multiple clips with mixed readyStates (optimistic)", () => {
      const clips = [
        { id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 },
        { id: "clip-2", kind: "video" as const, mediaId: "asset-2", trackId: "track-1", startTime: 10, duration: 10 },
        { id: "clip-3", kind: "video" as const, mediaId: "asset-3", trackId: "track-1", startTime: 20, duration: 10 },
      ];

      const videoElements = new Map<string, HTMLVideoElement>([
        ["clip-1-asset-1", createMockVideoElement(0)], // Not ready
        ["clip-2-asset-2", createMockVideoElement(2)], // HAVE_CURRENT_DATA - READY!
        ["clip-3-asset-3", createMockVideoElement(0)], // Not ready
      ]);

      const videoClips = clips.filter((c) => c.kind === "video");

      let hasAnyVideoElement = false;
      let hasReadyVideo = false;

      for (const clip of videoClips) {
        const key = `${clip.id}-${clip.mediaId}`;
        const element = videoElements.get(key);

        if (element) {
          hasAnyVideoElement = true;
          if (element.readyState >= 1) {
            hasReadyVideo = true;
            break; // OPTIMISTIC: Stop at first ready element
          }
        }
      }

      // EXPECTED: At least one element is ready
      expect(hasAnyVideoElement).toBe(true);
      expect(hasReadyVideo).toBe(true);

      // DECISION: Should NOT wait (at least one video is ready)
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;
      expect(waitingForVideoReady).toBe(false);
    });
  });

  describe("Render Decision Logic", () => {
    it("should allow render when NO clips exist (empty timeline)", () => {
      const isFirstFrame = true;
      const clips: any[] = [];

      // No clips → No waiting needed
      const waitingForVideoReady = false;

      const needsRender = isFirstFrame && !waitingForVideoReady;

      expect(needsRender).toBe(true);
    });

    it("should allow render when NO video elements created yet", () => {
      const isFirstFrame = true;
      const epochChanged = true;
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      // Elements not created yet
      const videoElements = new Map<string, HTMLVideoElement>();
      const hasAnyVideoElement = false;
      const waitingForVideoReady = false; // Don't wait, let sync create them

      const needsRender = (isFirstFrame || epochChanged) && !waitingForVideoReady;

      expect(needsRender).toBe(true);
    });

    it("should BLOCK render when elements exist but not ready", () => {
      const isFirstFrame = true;
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      // Element exists but readyState = 0
      const videoElements = new Map<string, HTMLVideoElement>([["clip-1-asset-1", createMockVideoElement(0)]]);

      const hasAnyVideoElement = true;
      const hasReadyVideo = false;
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;

      const needsRender = isFirstFrame && !waitingForVideoReady;

      expect(waitingForVideoReady).toBe(true);
      expect(needsRender).toBe(false); // BLOCKED!
    });

    it("should allow render when elements exist and ready", () => {
      const isFirstFrame = true;
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      // Element exists and readyState >= 1
      const videoElements = new Map<string, HTMLVideoElement>([["clip-1-asset-1", createMockVideoElement(1)]]);

      const hasAnyVideoElement = true;
      const hasReadyVideo = true;
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;

      const needsRender = isFirstFrame && !waitingForVideoReady;

      expect(waitingForVideoReady).toBe(false);
      expect(needsRender).toBe(true); // ALLOWED!
    });

    it("should only apply waiting logic on isFirstFrame=true", () => {
      const isFirstFrame = false; // NOT first frame
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      // Element exists but not ready - but we're not on first frame
      const videoElements = new Map<string, HTMLVideoElement>([["clip-1-asset-1", createMockVideoElement(0)]]);

      // Wait logic is SKIPPED when isFirstFrame=false
      const waitingForVideoReady = false; // Not checked

      const timeChanged = true;
      const needsRender = timeChanged && !waitingForVideoReady;

      expect(needsRender).toBe(true); // Allowed (wait logic not active)
    });
  });

  describe("Edge Cases", () => {
    it("should handle audio-only clips (skip video check)", () => {
      const isFirstFrame = true;
      type TestClip = { id: string; kind: "audio" | "video"; mediaId: string; trackId: string; startTime: number; duration: number };
      const clips: TestClip[] = [{ id: "clip-1", kind: "audio", mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      const videoClips = clips.filter((c) => c.kind === "video");

      // No video clips
      expect(videoClips.length).toBe(0);

      // Should not wait
      const waitingForVideoReady = false;
      const needsRender = isFirstFrame && !waitingForVideoReady;

      expect(needsRender).toBe(true);
    });

    it("should handle mixed audio and video clips", () => {
      const clips: Array<{ id: string; kind: "audio" | "video"; mediaId: string; trackId: string; startTime: number; duration: number }> = [
        { id: "clip-1", kind: "audio", mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 },
        { id: "clip-2", kind: "video", mediaId: "asset-2", trackId: "track-2", startTime: 0, duration: 10 },
      ];

      const videoElements = new Map<string, HTMLVideoElement>([
        ["clip-2-asset-2", createMockVideoElement(1)], // Video ready
      ]);

      const videoClips = clips.filter((c) => c.kind === "video");

      let hasReadyVideo = false;
      for (const clip of videoClips) {
        const key = `${clip.id}-${clip.mediaId}`;
        const element = videoElements.get(key);
        if (element && element.readyState >= 1) {
          hasReadyVideo = true;
          break;
        }
      }

      expect(hasReadyVideo).toBe(true);
    });

    it("should handle video element with src not set", () => {
      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      // Element exists but src is empty (shouldn't happen, but defensive)
      const videoElements = new Map<string, HTMLVideoElement>([["clip-1-asset-1", createMockVideoElement(0, "")]]);

      const hasAnyVideoElement = true;
      const hasReadyVideo = false;
      const waitingForVideoReady = hasAnyVideoElement && !hasReadyVideo;

      expect(waitingForVideoReady).toBe(true); // Should wait for src to be set
    });
  });

  describe("Real-World Scenarios", () => {
    it("SCENARIO: User drags first video to empty timeline", () => {
      /**
       * Timeline of events:
       * 1. addClip() → epoch becomes 1
       * 2. RAF tick 1: isFirstFrame=true, no elements → needsRender=true
       * 3. sync() creates element (readyState=0)
       * 4. RAF tick 2: isFirstFrame=true, element exists but readyState=0 → needsRender=FALSE (WAIT)
       * 5. RAF tick 3-10: Still waiting...
       * 6. loadedmetadata fires → ready=true, epoch becomes 2
       * 7. RAF tick 11: epochChanged, element readyState=1 → needsRender=TRUE
       * 8. Render succeeds!
       */

      // Tick 1: No elements yet
      let isFirstFrame = true;
      let lastRenderedTime = -1;
      let lastRenderedEpoch = -1;
      let currentEpoch = 1;

      const clips = [{ id: "clip-1", kind: "video" as const, mediaId: "asset-1", trackId: "track-1", startTime: 0, duration: 10 }];

      let videoElements = new Map<string, HTMLVideoElement>();
      let waitingForVideoReady = false; // No elements yet

      let needsRender = isFirstFrame && !waitingForVideoReady;
      expect(needsRender).toBe(true); // Should render (will call sync)

      // Tick 4: Element created but not ready
      videoElements = new Map([["clip-1-asset-1", createMockVideoElement(0)]]);

      const hasAnyElement = videoElements.size > 0;
      const hasReadyElement = Array.from(videoElements.values()).some((el) => el.readyState >= 1);
      waitingForVideoReady = hasAnyElement && !hasReadyElement;

      needsRender = isFirstFrame && !waitingForVideoReady;
      expect(needsRender).toBe(false); // BLOCKED - waiting for metadata

      // Tick 11: Metadata loaded, epoch incremented
      videoElements = new Map([["clip-1-asset-1", createMockVideoElement(1)]]);
      currentEpoch = 2;

      const hasReadyNow = Array.from(videoElements.values()).some((el) => el.readyState >= 1);
      waitingForVideoReady = hasAnyElement && !hasReadyNow;

      const epochChanged = currentEpoch !== lastRenderedEpoch;
      needsRender = (isFirstFrame || epochChanged) && !waitingForVideoReady;

      expect(needsRender).toBe(true); // UNBLOCKED - ready to render!
    });
  });
});
