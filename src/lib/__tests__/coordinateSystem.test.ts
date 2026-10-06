import { describe, it, expect } from "vitest";
import { screenToCanvas, canvasToScreen, calculateDisplayTransform, hitTestClip, type ViewportTransform, type CanvasSpace } from "../utils/coordinateSystem";

describe("Coordinate System Math", () => {
  it("should be mathematical inverses (property-based round-trip test)", () => {
    // Generate thousands of random permutations of viewport, canvas size, and points
    const ITERATIONS = 10000;

    for (let i = 0; i < ITERATIONS; i++) {
      // Random canvas size (e.g. 1920x1080, 1080x1920, 1000x1000)
      const canvas: CanvasSpace = {
        width: 100 + Math.random() * 3000,
        height: 100 + Math.random() * 3000,
      };

      // Random viewport zoom and pan
      const viewport: ViewportTransform = {
        zoom: 0.1 + Math.random() * 4.9, // 0.1 to 5.0
        panX: -500 + Math.random() * 1000,
        panY: -500 + Math.random() * 1000,
      };

      // Random container size
      const containerWidth = 200 + Math.random() * 1600;
      const containerHeight = 200 + Math.random() * 1200;

      // Use calculateDisplayTransform to produce consistent scale/offset
      const { scale, offsetX, offsetY } = calculateDisplayTransform(canvas, viewport, containerWidth, containerHeight, "fit");

      const displayOffset = { x: offsetX, y: offsetY };

      // Random point in screen space
      const originalScreen = {
        x: -1000 + Math.random() * 3000,
        y: -1000 + Math.random() * 3000,
      };

      // Screen -> Canvas
      const canvasPoint = screenToCanvas(originalScreen.x, originalScreen.y, viewport, canvas, scale, displayOffset);

      // Canvas -> Screen
      const roundTripScreen = canvasToScreen(canvasPoint.x, canvasPoint.y, viewport, canvas, scale, displayOffset);

      // Verify they are inverses (within floating point precision)
      expect(roundTripScreen.x).toBeCloseTo(originalScreen.x, 3);
      expect(roundTripScreen.y).toBeCloseTo(originalScreen.y, 3);
    }
  });

  it("should also round-trip starting from canvas space", () => {
    const canvas: CanvasSpace = { width: 1920, height: 1080 };
    const viewport: ViewportTransform = { zoom: 2.0, panX: 50, panY: -30 };
    const { scale, offsetX, offsetY } = calculateDisplayTransform(canvas, viewport, 800, 600, "fit");
    const offset = { x: offsetX, y: offsetY };

    // Canvas -> Screen -> Canvas
    const originalCanvas = { x: 500, y: 300 };
    const screen = canvasToScreen(originalCanvas.x, originalCanvas.y, viewport, canvas, scale, offset);
    const roundTrip = screenToCanvas(screen.x, screen.y, viewport, canvas, scale, offset);

    expect(roundTrip.x).toBeCloseTo(originalCanvas.x, 6);
    expect(roundTrip.y).toBeCloseTo(originalCanvas.y, 6);
  });

  describe("calculateDisplayTransform", () => {
    it("should produce zoom-dependent displayWidth", () => {
      const canvas: CanvasSpace = { width: 1920, height: 1080 };

      const result1 = calculateDisplayTransform(canvas, { zoom: 1.0, panX: 0, panY: 0 }, 800, 600, "fit");
      const result2 = calculateDisplayTransform(canvas, { zoom: 2.0, panX: 0, panY: 0 }, 800, 600, "fit");

      // At zoom=2, displayWidth should be 2x the zoom=1 width
      expect(result2.displayWidth).toBeCloseTo(result1.displayWidth * 2, 6);
      expect(result2.displayHeight).toBeCloseTo(result1.displayHeight * 2, 6);
    });

    it("should return same base scale regardless of zoom", () => {
      const canvas: CanvasSpace = { width: 1920, height: 1080 };

      const result1 = calculateDisplayTransform(canvas, { zoom: 1.0, panX: 0, panY: 0 }, 800, 600, "fit");
      const result2 = calculateDisplayTransform(canvas, { zoom: 3.0, panX: 0, panY: 0 }, 800, 600, "fit");

      // Base scale should be identical — zoom is NOT baked in
      expect(result1.scale).toBeCloseTo(result2.scale, 10);
    });

    it("should incorporate pan into offset", () => {
      const canvas: CanvasSpace = { width: 1920, height: 1080 };
      const viewport: ViewportTransform = { zoom: 1.0, panX: 0, panY: 0 };
      const viewportPanned: ViewportTransform = { zoom: 1.0, panX: 100, panY: 50 };

      const base = calculateDisplayTransform(canvas, viewport, 800, 600, "fit");
      const panned = calculateDisplayTransform(canvas, viewportPanned, 800, 600, "fit");

      // Pan is screen-space — offset shifts by exactly the pan amount
      expect(panned.offsetX - base.offsetX).toBeCloseTo(100, 6);
      expect(panned.offsetY - base.offsetY).toBeCloseTo(50, 6);
    });
  });

  describe("hitTestClip", () => {
    it("should accurately hit-test a standard un-rotated clip", () => {
      const clip = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };

      // Inside
      expect(hitTestClip(150, 150, clip)).toBe(true);
      expect(hitTestClip(100, 100, clip)).toBe(true);
      expect(hitTestClip(300, 200, clip)).toBe(true);

      // Outside
      expect(hitTestClip(99, 150, clip)).toBe(false);
      expect(hitTestClip(150, 99, clip)).toBe(false);
      expect(hitTestClip(301, 150, clip)).toBe(false);
      expect(hitTestClip(150, 201, clip)).toBe(false);
    });

    it("should accurately hit-test a rotated clip (90 degrees)", () => {
      // Square clip at 100,100 (size 100x100) -> Center is 150,150
      // Rotate 90 degrees -> Bounds should be same visually since it's a square rotated around center
      const clip = { x: 100, y: 100, width: 100, height: 100, rotation: 90 };

      // The center should be a hit
      expect(hitTestClip(150, 150, clip)).toBe(true);

      // Edges should be hits
      expect(hitTestClip(100, 150, clip)).toBe(true);

      // Outside edges should miss
      expect(hitTestClip(99, 150, clip)).toBe(false);
    });

    it("should accurately hit-test a rotated rectangle (45 degrees)", () => {
      // 100x20 rectangle centered at 0,0
      const clip = { x: -50, y: -10, width: 100, height: 20, rotation: 45 };

      // Center is a hit
      expect(hitTestClip(0, 0, clip)).toBe(true);

      // (40, 40) is roughly on the rotated +X axis of the rect
      // Before rotation it would be at x=~56, y=0. Since width is 100 (x: -50 to 50),
      // this should be OUTSIDE the clip.
      expect(hitTestClip(40, 40, clip)).toBe(false);

      // (30, 30) is x=~42, y=0 unrotated -> INSIDE the clip
      expect(hitTestClip(30, 30, clip)).toBe(true);

      // (-30, -30) is x=~-42, y=0 unrotated -> INSIDE the clip
      expect(hitTestClip(-30, -30, clip)).toBe(true);

      // (-30, 30) is on the rotated Y axis -> OUTSIDE (height is only 20)
      expect(hitTestClip(-30, 30, clip)).toBe(false);
    });
  });
});
