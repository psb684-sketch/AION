/**
 * Drop Target Classification (Layer 2: Editorial Intent)
 *
 * Answers: "What editing operation should happen?"
 *
 * Uses clip identity (not indexes) for stable references.
 *
 * Behavior:
 * - Same track: Insert mode (ripple - create space and shift clips)
 * - Cross track: Gap mode (free positioning - no space creation)
 */

import type { Clip } from "@/types";
import type { TrackRegion } from "./trackRegion";
import type { SnapResult } from "./snapTargets";

export type InsertPosition =
  | { position: "before"; clipId: string }
  | { position: "after"; clipId: string }
  | { position: "start" } // Before first clip
  | { position: "end" }; // After last clip

export type DropTarget = { type: "gap"; startTime: number } | { type: "append"; startTime: number } | { type: "insert"; target: InsertPosition };

export interface ClassifyDropTargetInput {
  region: TrackRegion;
  trackClips: Clip[];
  draggedClipIds: string[];
  pointerTimeSeconds: number;
  snapResult: SnapResult;
  sourceTrackId: string; // Track where dragged clips came from
  targetTrackId: string; // Track where clips are being dropped
}

export function classifyDropTarget(input: ClassifyDropTargetInput): DropTarget {
  const { region, trackClips, draggedClipIds, pointerTimeSeconds, snapResult, sourceTrackId, targetTrackId } = input;

  const draggedSet = new Set(draggedClipIds);
  const rest = trackClips.filter((c) => !draggedSet.has(c.id));
  const effectiveTime = snapResult.snapped ? snapResult.snappedTime! : pointerTimeSeconds;

  const isSameTrack = sourceTrackId === targetTrackId;

  // Special case: If dragging all clips from a track (making it empty), use gap mode
  // This allows free positioning when the only clip(s) in a track are being dragged
  const isTrackEmptyAfterDrag = rest.length === 0;
  const shouldUseGapMode = isTrackEmptyAfterDrag || !isSameTrack;

  // Insert mode: Ripple editing (clips create space and shift)
  switch (region.type) {
    case "before-first":
      // Same track: insert (create space), Cross track: gap (free position)
      // Exception: If track is empty after dragging, use gap mode (allows repositioning single clip)
      if (isSameTrack && !isTrackEmptyAfterDrag) {
        return {
          type: "insert",
          target: { position: "start" },
        };
      } else {
        return { type: "gap", startTime: Math.max(0, effectiveTime) };
      }

    case "gap":
      return { type: "gap", startTime: Math.max(0, effectiveTime) };

    case "after-last":
      return {
        type: "append",
        startTime: Math.max(region.startTime, effectiveTime),
      };

    case "clip": {
      const clip = rest.find((c) => c.id === region.clipId);
      if (!clip) {
        return { type: "gap", startTime: effectiveTime };
      }

      // Same track: insert (create space), Cross track: gap (free position)
      // Exception: If track is empty after dragging, use gap mode
      if (isSameTrack && !isTrackEmptyAfterDrag) {
        // Use clip region (screen-space stable)
        switch (region.region) {
          case "left-edge":
            return {
              type: "insert",
              target: { position: "before", clipId: region.clipId },
            };
          case "right-edge":
            return {
              type: "insert",
              target: { position: "after", clipId: region.clipId },
            };
          case "body": {
            // Body: Determine based on time position within clip
            const clipMid = clip.startTime + clip.duration / 2;
            return {
              type: "insert",
              target: pointerTimeSeconds < clipMid ? { position: "before", clipId: region.clipId } : { position: "after", clipId: region.clipId },
            };
          }
        }
      } else {
        // Cross track or empty track: use gap positioning (no insert)
        return { type: "gap", startTime: effectiveTime };
      }
    }
  }
}
