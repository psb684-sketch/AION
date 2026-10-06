import { create } from "zustand";
import type { Clip } from "@/types";

/**
 * Action returned by commitDrop for the caller to execute.
 * This maintains store isolation - dragStateStore never mutates timelineStore directly.
 */
export interface ClipDropAction {
  type: "UPDATE_CLIP";
  clipId: string;
  trackId: string;
  startTime: number;
}

interface DragStateStore {
  // The clip being dragged (removed from timeline)
  draggingClip: Clip | null;
  originalTrackId: string | null;
  originalStartTime: number | null;

  // Where the clip would be inserted
  insertionTrackId: string | null;
  insertionTime: number | null;

  // Grab offset for accurate cursor positioning
  grabOffsetX: number;
  grabOffsetY: number;

  // Actions
  setDragging: (clip: Clip, trackId: string, startTime: number) => void;
  clearDragging: () => void;
  setInsertion: (trackId: string | null, time: number | null) => void;
  setGrabOffset: (x: number, y: number) => void;
  /**
   * Clears drag state and returns an action for the caller to execute.
   * This maintains store isolation - the caller is responsible for updating the timeline.
   *
   * @returns Action object describing the clip update to perform
   */
  commitDrop: (clipId: string, trackId: string, startTime: number) => ClipDropAction;
}

export const useDragStateStore = create<DragStateStore>((set) => ({
  draggingClip: null,
  originalTrackId: null,
  originalStartTime: null,
  insertionTrackId: null,
  insertionTime: null,
  grabOffsetX: 0,
  grabOffsetY: 0,

  setDragging: (clip, trackId, startTime) => {
    set({
      draggingClip: clip,
      originalTrackId: trackId,
      originalStartTime: startTime,
    });
  },

  clearDragging: () => {
    set({
      draggingClip: null,
      originalTrackId: null,
      originalStartTime: null,
      insertionTrackId: null,
      insertionTime: null,
      grabOffsetX: 0,
      grabOffsetY: 0,
    });
  },

  setInsertion: (trackId, time) => {
    set({
      insertionTrackId: trackId,
      insertionTime: time,
    });
  },

  setGrabOffset: (x, y) => {
    set({
      grabOffsetX: x,
      grabOffsetY: y,
    });
  },

  /**
   * Clears drag state and returns an action for the caller to execute.
   * This maintains store isolation - dragStateStore never mutates timelineStore.
   *
   * The caller is responsible for executing the returned action:
   * ```typescript
   * const action = commitDrop(clipId, trackId, startTime);
   * updateClip(action.clipId, { trackId: action.trackId, startTime: action.startTime });
   * ```
   */
  commitDrop: (clipId, trackId, startTime) => {
    // Clear drag state
    set({
      draggingClip: null,
      originalTrackId: null,
      originalStartTime: null,
      insertionTrackId: null,
      insertionTime: null,
      grabOffsetX: 0,
      grabOffsetY: 0,
    });

    // Return action for caller to execute
    return {
      type: "UPDATE_CLIP",
      clipId,
      trackId,
      startTime,
    };
  },
}));
