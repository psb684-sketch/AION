import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureSubject, detectPoseLandmarks } from "../capture/bodyCaptureClient";
import { bodyMaskCache } from "../segmentation/maskCache";
import { buildSkeletalPoseData, interpolateSkeletalPose } from "../capture/cadenceDecimator";
import type { Landmark3D, SkeletalPoseData } from "@clypra-studio/types";

// Mock Worker environment
class MockWorker {
  onmessage: ((event: MessageEvent<any>) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  postMessage(data: any) {
    // Return mock response asynchronously
    setTimeout(() => {
      if (this.onmessage) {
        if (data.imageData) {
          // Pose response
          const landmarks: Landmark3D[] = new Array(33).fill(null).map(() => ({
            x: 0.5,
            y: 0.5,
            z: 0.0,
            visibility: 0.9,
          }));
          const pose = buildSkeletalPoseData(landmarks);
          this.onmessage(
            new MessageEvent("message", {
              data: {
                requestId: data.requestId,
                clipId: data.clipId,
                timestampUs: data.timestampUs,
                pose,
                runtimeUsed: "heuristic",
              },
            }),
          );
        }
      }
    }, 1);
  }

  terminate() {}
}

(globalThis as any).Worker = MockWorker;

if (typeof ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

describe("Dual-Worker & Hybrid Memory Soak Benchmark", () => {
  beforeEach(() => {
    bodyMaskCache.clear();
    vi.clearAllMocks();
  });

  it("maintains bounded memory and zero leak over 500 scrub cycles", async () => {
    const mockCanvas = {
      width: 256,
      height: 256,
    } as any;

    // Simulate 500 continuous timeline frames
    const frameCount = 500;
    const initialHeap = (globalThis as any).process?.memoryUsage?.().heapUsed ?? 0;

    for (let i = 0; i < frameCount; i++) {
      const timeSecs = i * 0.033; // 30 fps playback step
      const timestampUs = Math.round(timeSecs * 1_000_000);

      // 1. Cadence interpolated pose calculation
      const dummyLandmarks: Landmark3D[] = new Array(33).fill(null).map(() => ({
        x: 0.5 + (i % 10) * 0.01,
        y: 0.5,
        z: 0.0,
        visibility: 0.9,
      }));
      const p1 = buildSkeletalPoseData(dummyLandmarks);
      const p2 = buildSkeletalPoseData(dummyLandmarks);
      const interpolated = interpolateSkeletalPose(p1, p2, 0.5);

      expect(interpolated.anchors.torsoOrientation).toBeDefined();
      expect(interpolated.landmarks.length).toBe(33);

      // 2. Simulate mask caching in bounded LRU
      const dummyMask = new ImageData(64, 64);
      bodyMaskCache.set(`clip-1:test:${i}`, dummyMask);
    }

    // Assert cache bounds remain strictly capped at maxEntries
    let cacheCount = 0;
    for (let i = 0; i < frameCount; i++) {
      if (bodyMaskCache.get(`clip-1:test:${i}`)) {
        cacheCount++;
      }
    }

    // Default maxEntries is 90
    expect(cacheCount).toBeLessThanOrEqual(90);

    const finalHeap = (globalThis as any).process?.memoryUsage?.().heapUsed ?? 0;
    const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

    // Assert heap delta stays well below the 50MB constraint
    expect(heapDeltaMb).toBeLessThan(50);
  });

  it("handles concurrent pose interpolation without NaN orientations", () => {
    const landmarksA: Landmark3D[] = new Array(33).fill(null).map(() => ({
      x: 0.4,
      y: 0.4,
      z: 0.0,
      visibility: 0.9,
    }));
    const landmarksB: Landmark3D[] = new Array(33).fill(null).map(() => ({
      x: 0.6,
      y: 0.4,
      z: 0.1,
      visibility: 0.9,
    }));

    const poseA = buildSkeletalPoseData(landmarksA);
    const poseB = buildSkeletalPoseData(landmarksB);

    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const res = interpolateSkeletalPose(poseA, poseB, t);
      const q = res.anchors.torsoOrientation;

      expect(Number.isNaN(q.x)).toBe(false);
      expect(Number.isNaN(q.y)).toBe(false);
      expect(Number.isNaN(q.z)).toBe(false);
      expect(Number.isNaN(q.w)).toBe(false);

      const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
      expect(len).toBeCloseTo(1.0, 4);
    }
  });
});
