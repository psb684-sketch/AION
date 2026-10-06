/**
 * Hook to access RenderEngine from active ProjectSession
 *
 * ARCHITECTURE: RenderEngine is now owned by ProjectSession, not Zustand.
 * This hook provides React components access to the session's render engine.
 *
 * Returns null if no session is active (e.g., on launch screen).
 */

import { useSyncExternalStore } from "react";
import { getActiveSessionOrNull, subscribeToSessionChanges } from "@/core/runtime/ProjectSession";
import type { RenderEngine } from "../lib/renderEngine/renderEngine";

/**
 * Get current render engine from active session.
 * Returns null if no session is active.
 */
export function useRenderRuntime(): RenderEngine | null {
  // Subscribe to session changes
  const runtime = useSyncExternalStore(
    subscribeToSessionChanges,
    () => {
      const session = getActiveSessionOrNull();
      if (!session || session.state !== "active") {
        return null;
      }
      try {
        return session.renderRuntime;
      } catch {
        return null;
      }
    },
    () => null, // Server-side snapshot
  );

  return runtime;
}
