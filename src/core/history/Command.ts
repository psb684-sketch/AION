/**
 * Command Pattern for Timeline Operations
 *
 * This is intent-based history, NOT snapshot-based.
 * Commands are semantic timeline operations that can be:
 * - Applied
 * - Inverted (for undo)
 * - Merged (for coalescing)
 * - Serialized (for collaboration/macros)
 */

import { generateId } from "@/lib/utils/id";

/**
 * Base command interface.
 * All timeline operations implement this.
 */
export interface Command {
  /** Unique command ID */
  readonly id: string;

  /** Human-readable label for UI */
  readonly label: string;

  /** Timestamp when command was created */
  readonly timestamp: number;

  /**
   * Apply this command to the timeline state.
   * Returns the new state (immutable).
   */
  apply(state: any): any;

  /**
   * Create the inverse command for undo.
   * The inverse, when applied, should restore the previous state.
   */
  invert(): Command;

  /**
   * Attempt to merge with the next command.
   * Returns merged command if possible, null otherwise.
   *
   * Used for coalescing (e.g., multiple text edits → single edit)
   */
  merge?(next: Command): Command | null;

  /**
   * Whether this command should enter history.
   * Some operations (playhead move, zoom) should not be undoable.
   */
  readonly undoable: boolean;
}

/**
 * Command that can be serialized for:
 * - Collaboration
 * - Macros
 * - Crash recovery
 * - Replay
 */
export interface SerializableCommand extends Command {
  /**
   * Serialize to JSON-compatible object.
   */
  toJSON(): Record<string, any>;

  /**
   * Deserialize from JSON.
   */
  fromJSON(data: Record<string, any>): Command;
}

/**
 * Generate unique command ID.
 */
export function generateCommandId(): string {
  return generateId("cmd");
}
