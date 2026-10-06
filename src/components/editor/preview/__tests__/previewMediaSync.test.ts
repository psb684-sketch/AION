import { describe, expect, it } from "vitest";
import { getPreviewMediaSyncClips } from "../previewMediaSync";
import type { Clip } from "@/types";

const makeClip = (id: string, startTime: number, duration = 5): Clip => ({
  id,
  trackId: "track-1",
  mediaId: `media-${id}`,
  startTime,
  duration,
  trimIn: startTime,
  trimOut: startTime + duration,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  opacity: 1,
  rotation: 0,
});

describe("preview media sync window", () => {
  it("keeps the outgoing split clip briefly while prewarming the incoming clip at a cut", () => {
    const left = makeClip("left", 0, 5);
    const right = makeClip("right", 5, 5);

    expect(getPreviewMediaSyncClips([left, right], 5).map((clip) => clip.id)).toEqual(["left", "right"]);
  });

  it("prewarms an upcoming clip before the playhead reaches it", () => {
    const left = makeClip("left", 0, 5);
    const right = makeClip("right", 5, 5);

    expect(getPreviewMediaSyncClips([left, right], 4.5).map((clip) => clip.id)).toEqual(["left", "right"]);
  });

  it("drops clips outside the active, lookahead, and retention windows", () => {
    const stale = makeClip("stale", 0, 5);
    const current = makeClip("current", 10, 5);
    const future = makeClip("future", 20, 5);

    expect(getPreviewMediaSyncClips([stale, current, future], 12).map((clip) => clip.id)).toEqual(["current"]);
  });

  it("invalidates cache when clip properties are modified (Scenario A/B cache invalidation)", () => {
    const clip1 = makeClip("clip-1", 0, 10);
    const clips = [clip1];

    // First call: caches result
    const result1 = getPreviewMediaSyncClips(clips, 4.0);
    expect(result1.map((c) => c.id)).toEqual(["clip-1"]);

    // Move clip-1 so that it starts at 6.0 and no longer overlaps 4.0
    const movedClips = [
      {
        ...clip1,
        startTime: 6.0,
        trimIn: 6.0,
        trimOut: 11.0,
      },
    ];

    // Second call at same time: must bypass/invalidate cache because computeClipVersion changed
    const result2 = getPreviewMediaSyncClips(movedClips, 4.0);
    expect(result2.map((c) => c.id)).toEqual([]);
  });

  it("includes transition-active clips in synced clips list (Scenario C transition window)", () => {
    const left = makeClip("left", 0, 5);
    const right = makeClip("right", 5, 5);

    // Left ended at 5.0, so at 5.5 it is outside active/retention bounds
    const transitions = [
      {
        id: "transition-1",
        type: "cross-dissolve",
        fromItemId: "left",
        toItemId: "right",
        easing: "linear",
        placement: {
          trackId: "track-1",
          startTime: 4.5,
          duration: 1.5, // 4.5 to 6.0
        },
      } as any,
    ];

    // At 5.5, 'left' is within the transition window (4.5 to 6.0)
    const synced = getPreviewMediaSyncClips([left, right], 5.5, transitions);
    expect(synced.map((c) => c.id)).toContain("left");
    expect(synced.map((c) => c.id)).toContain("right");
  });
});
