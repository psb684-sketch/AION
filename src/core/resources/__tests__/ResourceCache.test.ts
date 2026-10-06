import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResourceCache } from "../ResourceCache";

// Stub ImageBitmap for Node environment (not available outside browser)
if (typeof globalThis.ImageBitmap === "undefined") {
  (globalThis as any).ImageBitmap = class ImageBitmap {
    width = 0;
    height = 0;
    close() {}
  };
}

describe("ResourceCache — acquire/release lifecycle", () => {
  let cache: ResourceCache;

  beforeEach(() => {
    cache = new ResourceCache({ maxResources: 5, debug: false });
  });

  it("acquire increments refCount, release decrements it", async () => {
    // Stub fetch so loadResource succeeds with a placeholder
    const handle = await cache.acquire("test://img.png", "placeholder");

    const resource = cache.get(handle);
    expect(resource).not.toBeNull();
    expect(resource!.refCount).toBe(1);

    // Second acquire of the same URL bumps refCount
    const handle2 = await cache.acquire("test://img.png", "placeholder");
    expect(handle2).toBe(handle);
    expect(cache.get(handle)!.refCount).toBe(2);

    // Release once
    cache.release(handle);
    expect(cache.get(handle)!.refCount).toBe(1);

    // Release again
    cache.release(handle);
    expect(cache.get(handle)!.refCount).toBe(0);
  });

  it("release never goes below zero", async () => {
    const handle = await cache.acquire("test://a.png", "placeholder");
    cache.release(handle);
    cache.release(handle); // extra release
    cache.release(handle); // extra release

    expect(cache.get(handle)!.refCount).toBe(0);
  });

  it("evictLRU prefers zero-refCount resources", async () => {
    // Fill cache to max (5)
    const h1 = await cache.acquire("test://1.png", "placeholder");
    const h2 = await cache.acquire("test://2.png", "placeholder");
    const h3 = await cache.acquire("test://3.png", "placeholder");
    const h4 = await cache.acquire("test://4.png", "placeholder");
    const h5 = await cache.acquire("test://5.png", "placeholder");

    // Release h1 and h2 (refCount → 0), keep h3-h5 referenced
    cache.release(h1);
    cache.release(h2);

    // Acquire a 6th resource — should evict one of the zero-ref resources
    const h6 = await cache.acquire("test://6.png", "placeholder");

    // h1 (oldest zero-ref) should have been evicted
    expect(cache.get(h1)).toBeNull();
    // h3-h5 should still exist (referenced)
    expect(cache.get(h3)).not.toBeNull();
    expect(cache.get(h4)).not.toBeNull();
    expect(cache.get(h5)).not.toBeNull();
    expect(cache.get(h6)).not.toBeNull();
  });

  it("clear closes all resources", async () => {
    await cache.acquire("test://a.png", "placeholder");
    await cache.acquire("test://b.png", "placeholder");

    expect(cache.getStats().resourceCount).toBe(2);

    cache.clear();

    expect(cache.getStats().resourceCount).toBe(0);
  });
});
