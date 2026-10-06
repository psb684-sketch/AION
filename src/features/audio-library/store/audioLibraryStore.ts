/**
 * Audio Library Store
 * Manages download state and cached audio files from the library
 */

import { create } from "zustand";
import type { AudioLibraryItem } from "../api/audioLibraryApi";
import { audioCacheManager, type CachedAudioFile, type DownloadProgress } from "@/features/audio-library/cache/audioCache";

export type DownloadStatus = "idle" | "downloading" | "completed" | "error";

export interface DownloadState {
  itemId: string;
  status: DownloadStatus;
  progress: number; // 0-100
  localPath?: string;
  error?: string;
  cachedFile?: CachedAudioFile;
}

interface AudioLibraryStore {
  // Download states by item ID
  downloads: Record<string, DownloadState>;

  // Initialize store with cached files
  initializeCache: () => Promise<void>;

  // Start downloading an audio file
  startDownload: (item: AudioLibraryItem) => Promise<CachedAudioFile>;

  // Get download state for an item
  getDownloadState: (itemId: string) => DownloadState | null;

  // Check if an item is downloaded
  isDownloaded: (itemId: string) => boolean;

  // Get local path for a downloaded item
  getLocalPath: (itemId: string) => string | null;

  // Get cached file info
  getCachedFile: (itemId: string) => CachedAudioFile | null;

  // Clear download state (after completion/error)
  clearDownloadState: (itemId: string) => void;

  // Clear specific cached file
  clearCache: (itemId: string) => Promise<void>;

  // Clear all cached audio
  clearAllCache: () => Promise<void>;

  // Get cache statistics
  getCacheStats: () => { count: number; totalSize: number; items: CachedAudioFile[] };

  // Internal: Update download progress
  _updateDownloadProgress: (itemId: string, progress: number) => void;

  // Internal: Set download completed
  _setDownloadCompleted: (itemId: string, cachedFile: CachedAudioFile) => void;

  // Internal: Set download error
  _setDownloadError: (itemId: string, error: string) => void;
}

export const useAudioLibraryStore = create<AudioLibraryStore>((set, get) => ({
  downloads: {},

  initializeCache: async () => {
    try {
      await audioCacheManager.initialize();
      const cached = audioCacheManager.getAllCached();

      // Populate download states with completed items
      const downloads: Record<string, DownloadState> = {};
      cached.forEach((file) => {
        downloads[file.id] = {
          itemId: file.id,
          status: "completed",
          progress: 100,
          localPath: file.localPath,
          cachedFile: file,
        };
      });

      set({ downloads });
    } catch (error) {
      console.error("[AudioLibraryStore] Failed to initialize cache:", error);
    }
  },

  startDownload: async (item: AudioLibraryItem) => {
    const { downloads } = get();

    // Check if already downloaded
    if (downloads[item.id]?.status === "completed" && downloads[item.id].cachedFile) {
      return downloads[item.id].cachedFile!;
    }

    // Check if already downloading
    if (downloads[item.id]?.status === "downloading") {
      throw new Error("Download already in progress");
    }

    // Set downloading state
    set({
      downloads: {
        ...downloads,
        [item.id]: {
          itemId: item.id,
          status: "downloading",
          progress: 0,
        },
      },
    });

    try {
      // Download with progress callback
      const cachedFile = await audioCacheManager.downloadAudio(item, (progress: DownloadProgress) => {
        get()._updateDownloadProgress(item.id, progress.percentage);
      });

      // Set completed state
      get()._setDownloadCompleted(item.id, cachedFile);

      return cachedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Download failed";
      get()._setDownloadError(item.id, errorMessage);
      throw error;
    }
  },

  getDownloadState: (itemId: string) => {
    return get().downloads[itemId] || null;
  },

  isDownloaded: (itemId: string) => {
    const state = get().downloads[itemId];
    return state?.status === "completed" && !!state.cachedFile;
  },

  getLocalPath: (itemId: string) => {
    const state = get().downloads[itemId];
    return state?.localPath || null;
  },

  getCachedFile: (itemId: string) => {
    const state = get().downloads[itemId];
    return state?.cachedFile || null;
  },

  clearDownloadState: (itemId: string) => {
    const { downloads } = get();
    const updated = { ...downloads };
    delete updated[itemId];
    set({ downloads: updated });
  },

  clearCache: async (itemId: string) => {
    await audioCacheManager.clearCache(itemId);

    // Remove from store
    const { downloads } = get();
    const updated = { ...downloads };
    delete updated[itemId];
    set({ downloads: updated });
  },

  clearAllCache: async () => {
    await audioCacheManager.clearAllCache();

    // Clear all download states
    set({ downloads: {} });
  },

  getCacheStats: () => {
    return audioCacheManager.getCacheStats();
  },

  _updateDownloadProgress: (itemId: string, progress: number) => {
    const { downloads } = get();
    const current = downloads[itemId];

    if (current) {
      set({
        downloads: {
          ...downloads,
          [itemId]: {
            ...current,
            progress,
          },
        },
      });
    }
  },

  _setDownloadCompleted: (itemId: string, cachedFile: CachedAudioFile) => {
    const { downloads } = get();

    set({
      downloads: {
        ...downloads,
        [itemId]: {
          itemId,
          status: "completed",
          progress: 100,
          localPath: cachedFile.localPath,
          cachedFile,
        },
      },
    });
  },

  _setDownloadError: (itemId: string, error: string) => {
    const { downloads } = get();
    const current = downloads[itemId];

    if (current) {
      set({
        downloads: {
          ...downloads,
          [itemId]: {
            ...current,
            status: "error",
            error,
          },
        },
      });
    }
  },
}));

// Initialize cache on store creation
useAudioLibraryStore.getState().initializeCache();
