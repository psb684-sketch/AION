import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CacheManager } from "../cache/cacheManager";
import { globalGPUCache } from "../cache/globalGPUCache";

// Mock Tauri plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  remove: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
  BaseDirectory: {
    AppCache: "AppCache",
    AppLocalData: "AppLocalData",
  },
}));

describe("CacheManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Stub indexedDB if missing in the testing environment
    if (typeof window !== "undefined" && !window.indexedDB) {
      const mockIDB = {
        databases: vi.fn().mockResolvedValue([]),
        deleteDatabase: vi.fn(),
      };
      Object.defineProperty(window, "indexedDB", {
        value: mockIDB,
        writable: true,
        configurable: true,
      });
      (globalThis as any).indexedDB = mockIDB;
    }

    // Reset global state mocks
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Non-Tauri Environment Tests ──────────────────────────────────────────
  describe("Non-Tauri environment behavior", () => {
    it("should skip app cache clear in non-Tauri environment and return success", async () => {
      const result = await CacheManager.clearAppCache();
      expect(result).toEqual({ success: true });
      // Non-Tauri environment silently skips without logging
    });

    it("should skip webview cache clear in non-Tauri environment and return success", async () => {
      const result = await CacheManager.clearWebViewCache();
      expect(result).toEqual({ success: true });
      // Non-Tauri environment silently skips without logging
    });
  });

  // ─── Browser Caches (localStorage, sessionStorage, IndexedDB) ───────────────
  describe("Browser caches clearing", () => {
    it("should clear localStorage successfully", () => {
      const clearSpy = vi.spyOn(Storage.prototype, "clear");
      const result = CacheManager.clearLocalStorage();
      expect(result).toEqual({ success: true });
      expect(clearSpy).toHaveBeenCalled();
    });

    it("should clear sessionStorage successfully", () => {
      const clearSpy = vi.spyOn(Storage.prototype, "clear");
      const result = CacheManager.clearSessionStorage();
      expect(result).toEqual({ success: true });
      expect(clearSpy).toHaveBeenCalled();
    });

    it("should clear IndexedDB databases successfully", async () => {
      const mockDatabases = [{ name: "db1" }, { name: "db2" }];

      // Mock indexedDB.databases
      vi.spyOn(indexedDB, "databases").mockResolvedValue(mockDatabases);

      // Mock indexedDB.deleteDatabase
      const deleteDatabaseSpy = vi.spyOn(indexedDB, "deleteDatabase").mockImplementation((name) => {
        const req = {} as IDBOpenDBRequest;
        setTimeout(() => {
          if (req.onsuccess) {
            req.onsuccess({} as Event);
          }
        }, 0);
        return req;
      });

      const result = await CacheManager.clearIndexedDB();
      expect(result).toEqual({ success: true });
      expect(deleteDatabaseSpy).toHaveBeenCalledWith("db1");
      expect(deleteDatabaseSpy).toHaveBeenCalledWith("db2");
    });
  });

  // ─── GPU Cache Tests ────────────────────────────────────────────────────────
  describe("GPU Cache clearing", () => {
    it("should clear GPU Cache successfully if initialized", () => {
      vi.spyOn(globalGPUCache, "isInitialized").mockReturnValue(true);
      const disposeSpy = vi.spyOn(globalGPUCache, "dispose").mockImplementation(() => {});
      vi.spyOn(globalGPUCache, "getStats").mockReturnValue({ textures: 5, memoryMB: "12" } as any);

      const result = CacheManager.clearGPUCache();
      expect(result).toEqual({ success: true });
      expect(disposeSpy).toHaveBeenCalled();
    });

    it("should skip GPU Cache clearing if not initialized", () => {
      vi.spyOn(globalGPUCache, "isInitialized").mockReturnValue(false);
      const disposeSpy = vi.spyOn(globalGPUCache, "dispose");

      const result = CacheManager.clearGPUCache();
      expect(result).toEqual({ success: true });
      expect(disposeSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Simulated Tauri Environment Tests ──────────────────────────────────────
  describe("Simulated Tauri environment", () => {
    beforeEach(() => {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {},
        writable: true,
        configurable: true,
      });
    });

    it("should call Tauri fs exists and remove for app cache", async () => {
      const { exists, remove } = await import("@tauri-apps/plugin-fs");
      vi.mocked(exists).mockResolvedValueOnce(true);
      vi.mocked(remove).mockResolvedValueOnce(undefined);

      const result = await CacheManager.clearAppCache();
      expect(result).toEqual({ success: true });
      expect(exists).toHaveBeenCalled();
      expect(remove).toHaveBeenCalled();
    });

    it("should return error if Tauri app cache exists or remove fails", async () => {
      const { exists } = await import("@tauri-apps/plugin-fs");
      vi.mocked(exists).mockRejectedValueOnce(new Error("FS Error"));

      const result = await CacheManager.clearAppCache();
      expect(result.success).toBe(false);
      expect(result.error).toBe("FS Error");
    });
  });

  // ─── Comprehensive clearAllCaches and getCacheInfo ───────────────────────────
  describe("clearAllCaches and getCacheInfo", () => {
    it("should call individual clearers in clearAllCaches", async () => {
      const clearAppSpy = vi.spyOn(CacheManager, "clearAppCache").mockResolvedValue({ success: true });
      const clearWebSpy = vi.spyOn(CacheManager, "clearWebViewCache").mockResolvedValue({ success: true });
      const clearGPUSpy = vi.spyOn(CacheManager, "clearGPUCache").mockReturnValue({ success: true });
      const clearLSSpy = vi.spyOn(CacheManager, "clearLocalStorage").mockReturnValue({ success: true });
      const clearSSSpy = vi.spyOn(CacheManager, "clearSessionStorage").mockReturnValue({ success: true });
      const clearIDBSpy = vi.spyOn(CacheManager, "clearIndexedDB").mockResolvedValue({ success: true });

      const stats = await CacheManager.clearAllCaches();

      expect(stats.errors).toEqual([]);
      expect(clearAppSpy).toHaveBeenCalled();
      expect(clearWebSpy).toHaveBeenCalled();
      expect(clearGPUSpy).toHaveBeenCalled();
      expect(clearLSSpy).toHaveBeenCalled();
      expect(clearSSSpy).toHaveBeenCalled();
      expect(clearIDBSpy).toHaveBeenCalled();
    });

    it("should respect options to exclude caches in clearAllCaches", async () => {
      const clearAppSpy = vi.spyOn(CacheManager, "clearAppCache");
      const clearGPUSpy = vi.spyOn(CacheManager, "clearGPUCache");
      const clearLSSpy = vi.spyOn(CacheManager, "clearLocalStorage");

      await CacheManager.clearAllCaches({
        appCache: false,
        localStorage: false,
      });

      expect(clearAppSpy).not.toHaveBeenCalled();
      expect(clearLSSpy).not.toHaveBeenCalled();
      expect(clearGPUSpy).toHaveBeenCalled();
    });

    it("should return correct cache sizes in getCacheInfo", async () => {
      vi.spyOn(globalGPUCache, "isInitialized").mockReturnValue(true);
      vi.spyOn(globalGPUCache, "getStats").mockReturnValue({ textures: 10, memoryMB: "5" } as any);

      const info = await CacheManager.getCacheInfo();
      expect(info.localStorage).toBeDefined();
      expect(info.sessionStorage).toBeDefined();
      expect(info.gpuCache).toEqual({ textures: 10, memoryMB: "5" });
    });
  });
});
