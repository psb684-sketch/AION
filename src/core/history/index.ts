/**
 * History Module - Command-Based Undo/Redo System
 *
 * This is intent-based history, NOT snapshot-based.
 *
 * Architecture:
 *   User Action → Command → CommandJournal → Timeline State → Epoch++
 *
 * Features:
 * - Command pattern (semantic operations)
 * - Transaction support (group commands)
 * - Coalescing (merge similar commands)
 * - Epoch integration (cache invalidation)
 * - Serializable (for collaboration/macros)
 */

// Core types
export type { Command, SerializableCommand } from "./Command";
export { generateCommandId } from "./Command";

// Transaction system
export { Transaction, TransactionState, CompositeCommand } from "./Transaction";

// Command journal
export { CommandJournal } from "./CommandJournal";
export type { CommandJournalConfig, CommandJournalState } from "./CommandJournal";

// Commands
export * from "./commands";
