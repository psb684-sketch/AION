/**
 * GPUTextureCache.test.ts — GPU memory budget enforcement tests
 *
 * Verifies that uploadTexture enforces the hard memory budget via LRU eviction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GPUTextureCache } from "../cache/gpuTextureCache";

// Minimal mock WebGL2 context
function createMockGL(): WebGL2RenderingContext {
  const textures = new Map<number, object>();
  let nextTextureId = 1;

  return {
    canvas: { width: 1920, height: 1080 } as HTMLCanvasElement,
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
    COLOR_BUFFER_BIT: 0x00004000,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,

    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    createTexture: vi.fn(() => ({ id: nextTextureId++ })),
    deleteTexture: vi.fn((tex: any) => {
      textures.delete(tex.id);
    }),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    createShader: vi.fn(() => ({ id: 1 })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    createProgram: vi.fn(() => ({ id: 1 })),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    getUniformLocation: vi.fn(() => ({ id: 1 })),
    createBuffer: vi.fn(() => ({ id: 1 })),
    deleteBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawArrays: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
  } as unknown as WebGL2RenderingContext;
}

function createMockCanvas(): HTMLCanvasElement {
  return {
    width: 1920,
    height: 1080,
    getContext: vi.fn((type: string) => {
      if (type === "webgl2") return createMockGL();
      return null;
    }),
  } as unknown as HTMLCanvasElement;
}

describe("GPUTextureCache Memory Budget", () => {
  let canvas: HTMLCanvasElement;
  let cache: GPUTextureCache;

  beforeEach(() => {
    canvas = createMockCanvas();
  });

  afterEach(() => {
    cache?.dispose();
  });

  it("accepts optional memory budget in constructor", () => {
    cache = new GPUTextureCache(canvas, 64);
    expect(cache.getStats().budgetMB).toBe(64);
  });

  it("defaults to 128MB budget when not specified", () => {
    cache = new GPUTextureCache(canvas);
    expect(cache.getStats().budgetMB).toBe(128);
  });

  it("tracks memory usage after upload", () => {
    cache = new GPUTextureCache(canvas, 128);
    // 100x100 RGBA = 40,000 bytes
    cache.uploadTexture("tex-1", new Uint8Array(100 * 100 * 4), 100, 100);
    expect(cache.getMemoryUsageMB()).toBeCloseTo(40000 / (1024 * 1024), 5);
  });

  it("evicts LRU texture when budget would be exceeded", () => {
    cache = new GPUTextureCache(canvas, 1); // 1 MB budget
    // Each texture is 100x100x4 = 40,000 bytes
    // 1 MB = 1,048,576 bytes → ~26 textures fit
    // Upload 30 textures → should evict oldest
    for (let i = 0; i < 30; i++) {
      cache.uploadTexture(`tex-${i}`, new Uint8Array(100 * 100 * 4), 100, 100);
    }

    const stats = cache.getStats();
    const memoryMB = parseFloat(stats.memoryMB);
    expect(memoryMB).toBeLessThanOrEqual(1.0);
    // tex-0 should have been evicted
    expect(cache.hasTexture("tex-0")).toBe(false);
  });

  it("reuses existing texture without counting memory twice", () => {
    cache = new GPUTextureCache(canvas, 128);
    cache.uploadTexture("tex-1", new Uint8Array(100 * 100 * 4), 100, 100);
    cache.uploadTexture("tex-1", new Uint8Array(100 * 100 * 4), 100, 100);

    const memoryMB = cache.getMemoryUsageMB();
    expect(memoryMB).toBeCloseTo(40000 / (1024 * 1024), 5);
  });

  it("resets memory tracking on clearAll", () => {
    cache = new GPUTextureCache(canvas, 128);
    cache.uploadTexture("tex-1", new Uint8Array(100 * 100 * 4), 100, 100);
    cache.clearAll();
    expect(cache.getMemoryUsageMB()).toBe(0);
  });

  it("reports utilization percentage in stats", () => {
    cache = new GPUTextureCache(canvas, 1); // 1 MB
    cache.uploadTexture("tex-1", new Uint8Array(100 * 100 * 4), 100, 100);
    const stats = cache.getStats();
    expect(stats).toHaveProperty("utilizationPercent");
    expect(parseFloat(stats.utilizationPercent as string)).toBeGreaterThan(0);
  });
});
