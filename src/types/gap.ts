/**
 * Gap Data Model
 *
 * Gaps as first-class timeline entities (like Final Cut Pro X).
 * Gaps occupy space on timeline tracks and can be manipulated like clips.
 */

export type GapType =
  | "manual" // User explicitly created this gap
  | "auto" // System-created (e.g., from drag operation)
  | "protected"; // User marked this gap as protected from normalization

export type GapSource =
  | "user-insert" // User explicitly inserted gap
  | "clip-drag" // Created by dragging clip away
  | "clip-delete" // Created by deleting clip (non-ripple)
  | "imported" // From project file
  | "unknown"; // Legacy/migration

/**
 * Gap - A first-class timeline entity representing empty space
 */
export interface Gap {
  /** Unique identifier */
  id: string;

  /** Track this gap belongs to */
  trackId: string;

  /** Start time in seconds */
  startTime: number;

  /** Duration in seconds */
  duration: number;

  /** Gap classification */
  type: GapType;

  /** How this gap was created */
  source: GapSource;

  /** Whether this gap should be preserved during normalization */
  protected: boolean;

  /** Optional metadata */
  metadata?: {
    /** When the gap was created */
    createdAt?: number;

    /** User note/reason for the gap */
    note?: string;

    /** Original clip ID if gap was created by deletion */
    replacedClipId?: string;

    /** Whether this gap was explicitly created by user */
    userCreated?: boolean;
  };
}

/**
 * Timeline item that can be either a Clip or a Gap
 */
export type TimelineTrackItem = { type: "clip"; item: import("./index").Clip } | { type: "gap"; item: Gap };

/**
 * Gap operation result
 */
export interface GapOperationResult {
  success: boolean;
  gap?: Gap;
  error?: string;
  affectedClipIds?: string[];
}

/**
 * Gap validation result
 */
export interface GapValidation {
  valid: boolean;
  reason?: string;
  conflicts?: Array<{
    clipId: string;
    overlap: { start: number; end: number };
  }>;
}
