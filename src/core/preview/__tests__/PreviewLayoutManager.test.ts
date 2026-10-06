import { describe, it, expect } from "vitest";
import { PreviewLayoutManager } from "../PreviewLayoutManager";

describe("PreviewLayoutManager", () => {
  it("enforces strictly even integer dimensions on all outputs", () => {
    // Arbitrary odd and fractional dimensions
    const result = PreviewLayoutManager.compute({
      canvasWidth: 1080,
      canvasHeight: 1920, // 9:16 portrait
      containerWidth: 789,
      containerHeight: 443.8125,
      mode: "fit",
      devicePixelRatio: 1.25, // Windows 125% DPI
    });

    expect(result.displayWidth % 2).toBe(0);
    expect(result.displayHeight % 2).toBe(0);
    expect(result.physicalWidth % 2).toBe(0);
    expect(result.physicalHeight % 2).toBe(0);
    expect(Number.isInteger(result.offsetX)).toBe(true);
    expect(Number.isInteger(result.offsetY)).toBe(true);
  });

  it("calculates correct aspect-ratio fit for 16:9 widescreen", () => {
    const result = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 800,
      containerHeight: 600,
      mode: "fit",
    });

    // 1920x1080 fit into 800x600 -> limited by width: 800x450
    expect(result.displayWidth).toBe(800);
    expect(result.displayHeight).toBe(450);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(75); // (600 - 450) / 2
  });

  it("calculates correct aspect-ratio fit for 9:16 portrait video", () => {
    const result = PreviewLayoutManager.compute({
      canvasWidth: 1080,
      canvasHeight: 1920,
      containerWidth: 1000,
      containerHeight: 500,
      mode: "fit",
    });

    // Height limited: 500 -> width = 500 * (1080 / 1920) = 281.25 -> snapped to 282 (even)
    expect(result.displayHeight).toBe(500);
    expect(result.displayWidth).toBe(282);
    expect(result.displayWidth % 2).toBe(0);
    expect(result.offsetX).toBe(Math.round((1000 - 282) / 2));
    expect(result.offsetY).toBe(0);
  });

  it("applies uniform safe padding when requested", () => {
    const withoutPadding = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 1000,
      containerHeight: 1000,
      padding: 0,
    });

    const withPadding = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 1000,
      containerHeight: 1000,
      padding: 20,
    });

    // With 20px padding on each side, available width is 960 instead of 1000
    expect(withPadding.displayWidth).toBeLessThan(withoutPadding.displayWidth);
    expect(withPadding.displayWidth).toBe(960);
    expect(withPadding.displayHeight).toBe(540);
  });

  it("correctly computes physical swapchain coordinates for Windows fractional scale", () => {
    const result = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 960,
      containerHeight: 540,
      devicePixelRatio: 1.5, // 150% Windows scaling
    });

    expect(result.displayWidth).toBe(960);
    expect(result.displayHeight).toBe(540);
    // 960 * 1.5 = 1440
    expect(result.physicalWidth).toBe(1440);
    // 540 * 1.5 = 810 -> snapped to 810
    expect(result.physicalHeight).toBe(810);
    expect(result.physicalWidth % 2).toBe(0);
    expect(result.physicalHeight % 2).toBe(0);
  });

  it("incorporates pan offsets into centering offsets", () => {
    const base = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 1000,
      containerHeight: 1000,
      panX: 0,
      panY: 0,
    });

    const panned = PreviewLayoutManager.compute({
      canvasWidth: 1920,
      canvasHeight: 1080,
      containerWidth: 1000,
      containerHeight: 1000,
      panX: 50,
      panY: -30,
    });

    expect(panned.offsetX).toBe(base.offsetX + 50);
    expect(panned.offsetY).toBe(base.offsetY - 30);
  });
});
