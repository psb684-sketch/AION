/**
 * Placement Preview (Layer 3: Render Model)
 *
 * Answers: "How should this be visualized?"
 *
 * Converts editorial intent into concrete visual preview.
 * Includes caching/memoization for performance with large track counts.
 */

import type { Clip } from "@/types";
import type { DropTarget, InsertPosition } from "./dropTarget";
import { calculateDisplayPositions, calculateGapStartTime } from "./clipPositions";

export type PlacementPreview =
  | {
      type: "insert";
      insertionIndex: number; // Converted from clip identity
      gapStartTime: number;
      gapDuration: number;
      affectedClipPositions: Map<string, number>;
    }
  | {
      type: "position";
      startTime: number;
    };

/**
 * Create cache key for preview memoization.
 * Preview only needs recalculation when this key changes.
 */
export function createPreviewKey(targetTrackId: string, dropTarget: DropTarget, draggedBlockDuration: number, trackClips: Clip[], draggedClipIds: string[]): string {
  const draggedSet = new Set(draggedClipIds);
  const rest = trackClips.filter((c) => !draggedSet.has(c.id));

  // Create stable hash of track state
  const trackClipsHash = rest.map((c) => `${c.id}:${c.startTime}`).join("|");

  // Serialize drop target
  let targetData = dropTarget.type;
  if (dropTarget.type === "insert") {
    const pos = dropTarget.target.position;
    targetData += `:${pos}`;
    if ("clipId" in dropTarget.target) {
      targetData += `:${dropTarget.target.clipId}`;
    }
  } else if ("startTime" in dropTarget) {
    targetData += `:${dropTarget.startTime}`;
  }

  return `${targetTrackId}|${targetData}|${draggedBlockDuration}|${trackClipsHash}`;
}

export interface BuildPreviewInput {
  dropTarget: DropTarget;
  trackClips: Clip[];
  draggedClipIds: string[];
  draggedBlockDuration: number;
}

export function buildPlacementPreview(input: BuildPreviewInput): PlacementPreview {
  const { dropTarget, trackClips, draggedClipIds, draggedBlockDuration } = input;

  const draggedSet = new Set(draggedClipIds);
  const rest = trackClips.filter((c) => !draggedSet.has(c.id));

  switch (dropTarget.type) {
    case "insert": {
      // Convert clip identity to insertion index
      const insertionIndex = resolveInsertionIndex(dropTarget.target, rest);

      // Calculate reshuffled positions
      const affectedClipPositions = calculateDisplayPositions({
        trackClips,
        draggedClipIds,
        draggedBlockDuration,
        insertionIndex,
      });

      const gapStartTime = calculateGapStartTime({
        trackClips,
        draggedClipIds,
        draggedBlockDuration,
        insertionIndex,
      });

      return {
        type: "insert",
        insertionIndex,
        gapStartTime,
        gapDuration: draggedBlockDuration,
        affectedClipPositions,
      };
    }

    case "gap":
    case "append":
      return {
        type: "position",
        startTime: dropTarget.startTime,
      };

    default:
      return { type: "position", startTime: 0 };
  }
}

/**
 * Helper: Convert InsertPosition (clip identity) to insertion index.
 * This is where clip references are resolved to array positions.
 */
function resolveInsertionIndex(target: InsertPosition, restClips: Clip[]): number {
  switch (target.position) {
    case "start":
      return 0;
    case "end":
      return restClips.length;
    case "before": {
      const index = restClips.findIndex((c) => c.id === target.clipId);
      return index >= 0 ? index : 0;
    }
    case "after": {
      const index = restClips.findIndex((c) => c.id === target.clipId);
      return index >= 0 ? index + 1 : restClips.length;
    }
  }
}
