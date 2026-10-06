import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveSnapshot, getSnapshot, clearSnapshot, hasSnapshot, type RecoverySnapshot } from "../CrashRecoveryService";
import type { Project } from "@/types";

// Mock IndexedDB
const mockDBStorage = new Map<any, any>();

class MockIDBRequest {
  result: any;
  error: any = null;
  onsuccess: ((event?: any) => void) | null = null;
  onerror: ((event?: any) => void) | null = null;
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: any) => void) | null = null;
}

const mockStore = {
  put: vi.fn((value, key) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      mockDBStorage.set(key, value);
      req.result = key;
      req.onsuccess?.();
    }, 0);
    return req as any;
  }),
  get: vi.fn((key) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = mockDBStorage.get(key);
      req.onsuccess?.();
    }, 0);
    return req as any;
  }),
  delete: vi.fn((key) => {
    const req = new MockIDBRequest();
    setTimeout(() => {
      mockDBStorage.delete(key);
      req.result = undefined;
      req.onsuccess?.();
    }, 0);
    return req as any;
  }),
};

const mockTransaction = {
  objectStore: () => mockStore,
  oncomplete: null as any,
  onerror: null as any,
};

const mockDB = {
  objectStoreNames: {
    contains: () => true,
  },
  transaction: () => {
    setTimeout(() => {
      mockTransaction.oncomplete?.();
    }, 0);
    return mockTransaction;
  },
  close: vi.fn(),
};

globalThis.indexedDB = {
  open: vi.fn(() => {
    const req = new MockIDBOpenDBRequest();
    setTimeout(() => {
      req.result = mockDB;
      req.onsuccess?.({ target: req } as any);
    }, 0);
    return req as any;
  }),
} as any;

describe("Crash Recovery Service", () => {
  beforeEach(() => {
    mockDBStorage.clear();
    vi.clearAllMocks();
  });

  const mockSnapshot: RecoverySnapshot = {
    savedAt: new Date().toISOString(),
    project: { id: "project-1", name: "Recoverable Project" } as Project,
    mediaAssets: [],
    tracks: [],
    clips: [],
    transitions: [],
  };

  it("should write snapshot to IndexedDB and read it back successfully", async () => {
    // Initially should be no snapshot
    expect(await hasSnapshot()).toBe(false);
    expect(await getSnapshot()).toBeNull();

    // Save snapshot
    await saveSnapshot(mockSnapshot);
    expect(mockStore.put).toHaveBeenCalledWith(mockSnapshot, "activeProject");

    // Retrieve snapshot
    expect(await hasSnapshot()).toBe(true);
    const retrieved = await getSnapshot();
    expect(retrieved).toEqual(mockSnapshot);
  });

  it("should clear the stored snapshot from database on clean project close", async () => {
    await saveSnapshot(mockSnapshot);
    expect(await hasSnapshot()).toBe(true);

    await clearSnapshot();
    expect(mockStore.delete).toHaveBeenCalledWith("activeProject");
    expect(await hasSnapshot()).toBe(false);
  });
});
