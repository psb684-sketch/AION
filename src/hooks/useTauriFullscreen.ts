import { useEffect, useState, useCallback } from "react";

interface UseTauriFullscreenReturn {
  /** Current fullscreen state (native macOS/Windows fullscreen) */
  isFullscreen: boolean;
  /** Enter fullscreen mode */
  enterFullscreen: () => Promise<void>;
  /** Exit fullscreen mode */
  exitFullscreen: () => Promise<void>;
  /** Toggle fullscreen mode */
  toggleFullscreen: () => Promise<void>;
  /** Whether the API is available (only true in Tauri) */
  isSupported: boolean;
}

// True if running inside a Tauri container, or during unit testing
const isTauriEnv = typeof window !== "undefined" && (
  !!(window as any).__TAURI_INTERNALS__ || 
  import.meta.env.MODE === "test"
);

/**
 * Hook to detect and control native fullscreen state in Tauri apps
 *
 * This detects macOS native fullscreen (green traffic light button) and
 * Windows F11 fullscreen, unlike the browser Fullscreen API.
 */
export function useTauriFullscreen(): UseTauriFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSupported = isTauriEnv;

  // Check current fullscreen state
  const checkFullscreen = useCallback(async (): Promise<boolean> => {
    if (!isTauriEnv) return false;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();
      const fullscreen = await window.isFullscreen();
      return fullscreen;
    } catch (error) {
      console.error("[useTauriFullscreen] Failed to check fullscreen state:", error);
      return false;
    }
  }, []);

  // Enter fullscreen
  const enterFullscreen = useCallback(async (): Promise<void> => {
    if (!isTauriEnv) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();
      await window.setFullscreen(true);
      setIsFullscreen(true);
    } catch (error) {
      console.error("[useTauriFullscreen] Failed to enter fullscreen:", error);
      throw error;
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async (): Promise<void> => {
    if (!isTauriEnv) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();
      await window.setFullscreen(false);
      setIsFullscreen(false);
    } catch (error) {
      console.error("[useTauriFullscreen] Failed to exit fullscreen:", error);
      throw error;
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (!isTauriEnv) return;
    const currentState = await checkFullscreen();
    if (currentState) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [checkFullscreen, enterFullscreen, exitFullscreen]);

  // Poll for fullscreen state changes (only in Tauri environment)
  useEffect(() => {
    if (!isTauriEnv) return;

    let mounted = true;
    let pollInterval: number;

    const pollFullscreenState = async () => {
      if (!mounted) return;

      try {
        const fullscreen = await checkFullscreen();
        if (mounted) {
          setIsFullscreen(fullscreen);
        }
      } catch (error) {
        console.error("[useTauriFullscreen] Failed to poll fullscreen state:", error);
      }
    };

    // Initial check
    pollFullscreenState();

    // Poll every 500ms to detect changes from native controls
    // (macOS green button, Windows F11, etc.)
    pollInterval = setInterval(pollFullscreenState, 500);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [checkFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isSupported,
  };
}
