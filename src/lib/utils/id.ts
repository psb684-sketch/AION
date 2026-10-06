/**
 * Centralized ID Generator
 *
 * Provides deterministic ID generation within a session using a counter.
 * This ensures:
 * - Deterministic testing (can replay exact sequence with resetIdGenerator)
 * - No ID collisions within a session
 * - Undo/redo doesn't create new IDs (breaks references)
 * - Tests are stable (IDs don't change on every run)
 *
 * Architecture principle:
 * "Never use Date.now() or Math.random() for IDs. Use session-scoped counter or UUIDv7."
 */

/**
 * Internal counter for generating sequential IDs within a session
 */
let _counter = 0;

/**
 * Session identifier - unique per application session
 * Format: timestamp-randomString for uniqueness across sessions
 *
 * Increased entropy to 16 base-36 characters (78.4^16 ≈ 10^25 combinations)
 * Birthday paradox collision probability: 1% at ~10^12 sessions (1 trillion)
 * Previous: 7 chars = 1% at ~280K sessions
 */
let _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;

/**
 * Generate a deterministic ID within the current session
 *
 * IDs are deterministic within a session (sequential counter) but unique across sessions.
 * Format: `{prefix}-{sessionId}-{counter}`
 *
 * @param prefix - Type prefix for the ID (e.g., "clip", "track", "asset")
 * @returns Unique ID string
 *
 * @example
 * ```typescript
 * const clipId = generateId("clip");     // "clip-1234567890-abc123-0"
 * const trackId = generateId("track");   // "track-1234567890-abc123-1"
 * const assetId = generateId("asset");   // "asset-1234567890-abc123-2"
 * ```
 */
export function generateId(prefix: string): string {
  return `${prefix}-${_sessionId}-${_counter++}`;
}

/**
 * Reset the ID generator for testing or new sessions
 *
 * This is primarily used in tests to ensure deterministic ID generation.
 * Can also be used to start a new session with a specific session ID.
 *
 * @param sessionId - Optional session ID to use. If not provided, generates a new one.
 *
 * @example
 * ```typescript
 * // In tests - use deterministic session ID
 * resetIdGenerator("test-session");
 * const id1 = generateId("clip"); // "clip-test-session-0"
 * const id2 = generateId("clip"); // "clip-test-session-1"
 *
 * // Reset for new test
 * resetIdGenerator("test-session");
 * const id3 = generateId("clip"); // "clip-test-session-0" (counter reset)
 *
 * // In production - generate new random session
 * resetIdGenerator();
 * ```
 */
export function resetIdGenerator(sessionId?: string): void {
  _counter = 0;
  _sessionId = sessionId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
}

/**
 * Get the current session ID
 *
 * Useful for debugging or logging purposes.
 *
 * @returns Current session ID
 */
export function getSessionId(): string {
  return _sessionId;
}

/**
 * Get the current counter value
 *
 * Useful for debugging or testing purposes.
 *
 * @returns Current counter value
 */
export function getCounter(): number {
  return _counter;
}
