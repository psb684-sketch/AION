/**
 * Core NLE engine - evaluation, compositor, timeline, and render modules.
 *
 * This is the foundation of the editor, separate from React/UI.
 * All rendering, validation, and timeline logic flows through here.
 *
 * Architecture:
 *
 *   Timeline State
 *        ↓
 *   Evaluation (canonical scene evaluation)
 *        ↓
 *   EvaluatedScene (universal currency)
 *        ↓
 *   Render Engine
 *
 * One source of truth for:
 * - Preview rendering
 * - Export rendering
 * - Thumbnail generation
 * - Proxy rendering
 * - Timeline validation
 */

// Evaluation (PRIORITY: Use this for all rendering)
export * from "./evaluation";

// History (Command-based undo/redo)
export * from "./history";

// Compositor (semantic layer)
export * from "./compositor";

// Timeline (adapter layer)
export * from "./timeline";

// Render (fallback strategies)
export * from "./render";

// Fonts (deterministic font loading)
export * from "./fonts";
