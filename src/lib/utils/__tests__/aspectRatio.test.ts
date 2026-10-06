import { describe, it, expect } from "vitest";
import { calculateAspectRatio } from "../aspectRatio";

describe("aspectRatio", () => {
  describe("calculateAspectRatio", () => {
    describe("fit mode (letterbox/pillarbox)", () => {
      it("should pillarbox 9:16 vertical video in 16:9 canvas", () => {
        // Vertical video (1080x1920) in horizontal canvas (1920x1080)
        const layout = calculateAspectRatio(1920, 1080, 1080, 1920, "fit");

        // Video should fit height, width scaled proportionally
        expect(layout.height).toBe(1080); // Full height
        expect(layout.width).toBeCloseTo(607.5, 1); // Scaled width (1080 * 1080/1920)
        expect(layout.x).toBeCloseTo(656.25, 1); // Centered horizontally
        expect(layout.y).toBe(0); // No vertical offset
        expect(layout.scale).toBeCloseTo(0.5625, 4); // 1080/1920
      });

      it("should letterbox 16:9 horizontal video in 9:16 canvas", () => {
        // Horizontal video (1920x1080) in vertical canvas (1080x1920)
        const layout = calculateAspectRatio(1080, 1920, 1920, 1080, "fit");

        // Video should fit width, height scaled proportionally
        expect(layout.width).toBe(1080); // Full width
        expect(layout.height).toBeCloseTo(607.5, 1); // Scaled height (1080 * 1080/1920)
        expect(layout.x).toBe(0); // No horizontal offset
        expect(layout.y).toBeCloseTo(656.25, 1); // Centered vertically
        expect(layout.scale).toBeCloseTo(0.5625, 4); // 1080/1920
      });

      it("should fit 1:1 square video in 16:9 canvas (pillarbox)", () => {
        // Square video (1080x1080) in horizontal canvas (1920x1080)
        const layout = calculateAspectRatio(1920, 1080, 1080, 1080, "fit");

        // Video should fit height, pillarboxed
        expect(layout.height).toBe(1080); // Full height
        expect(layout.width).toBe(1080); // Same as height (square)
        expect(layout.x).toBe(420); // Centered horizontally: (1920 - 1080) / 2
        expect(layout.y).toBe(0); // No vertical offset
        expect(layout.scale).toBe(1); // No scaling needed
      });

      it("should fit 4:3 video in 16:9 canvas (pillarbox)", () => {
        // 4:3 video (1440x1080) in 16:9 canvas (1920x1080)
        const layout = calculateAspectRatio(1920, 1080, 1440, 1080, "fit");

        // Video should fit height
        expect(layout.height).toBe(1080); // Full height
        expect(layout.width).toBe(1440); // Full width
        expect(layout.x).toBe(240); // Centered: (1920 - 1440) / 2
        expect(layout.y).toBe(0); // No vertical offset
        expect(layout.scale).toBe(1); // No scaling needed
      });

      it("should not scale when video matches canvas aspect ratio", () => {
        // 16:9 video in 16:9 canvas (different resolutions)
        const layout = calculateAspectRatio(1920, 1080, 960, 540, "fit");

        // Video should scale up 2x to fill canvas
        expect(layout.width).toBe(1920);
        expect(layout.height).toBe(1080);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
        expect(layout.scale).toBe(2); // 1920/960 = 2
      });
    });

    describe("cover mode (crop edges)", () => {
      it("should crop 9:16 vertical video to fill 16:9 canvas", () => {
        // Vertical video (1080x1920) in horizontal canvas (1920x1080)
        const layout = calculateAspectRatio(1920, 1080, 1080, 1920, "cover");

        // Video should fill width, height extended beyond canvas (cropped)
        expect(layout.width).toBe(1920); // Full width
        expect(layout.height).toBeCloseTo(3413.33, 1); // 1920 * 1920/1080
        expect(layout.x).toBe(0); // No horizontal offset
        expect(layout.y).toBeCloseTo(-1166.67, 1); // Negative offset (cropped top/bottom)
        expect(layout.scale).toBeCloseTo(1.7778, 4); // 1920/1080
      });

      it("should crop 16:9 horizontal video to fill 9:16 canvas", () => {
        // Horizontal video (1920x1080) in vertical canvas (1080x1920)
        const layout = calculateAspectRatio(1080, 1920, 1920, 1080, "cover");

        // Video should fill height, width extended beyond canvas (cropped)
        expect(layout.height).toBe(1920); // Full height
        expect(layout.width).toBeCloseTo(3413.33, 1); // 1920 * 1920/1080
        expect(layout.y).toBe(0); // No vertical offset
        expect(layout.x).toBeCloseTo(-1166.67, 1); // Negative offset (cropped left/right)
        expect(layout.scale).toBeCloseTo(1.7778, 4); // 1920/1080
      });

      it("should fill canvas exactly when video matches aspect ratio", () => {
        // 16:9 video in 16:9 canvas (different resolutions)
        const layout = calculateAspectRatio(1920, 1080, 960, 540, "cover");

        // Video should scale up 2x to fill canvas (no crop needed)
        expect(layout.width).toBe(1920);
        expect(layout.height).toBe(1080);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
        expect(layout.scale).toBe(2);
      });
    });

    describe("stretch mode (distort)", () => {
      it("should stretch 9:16 vertical video to fill 16:9 canvas", () => {
        // Vertical video (1080x1920) in horizontal canvas (1920x1080)
        const layout = calculateAspectRatio(1920, 1080, 1080, 1920, "stretch");

        // Video should fill entire canvas (distorted)
        expect(layout.width).toBe(1920);
        expect(layout.height).toBe(1080);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
      });

      it("should stretch any video to match canvas dimensions", () => {
        // Any aspect ratio should fill canvas
        const layout = calculateAspectRatio(800, 600, 1920, 1080, "stretch");

        expect(layout.width).toBe(800);
        expect(layout.height).toBe(600);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
      });
    });

    describe("edge cases", () => {
      it("should handle zero source dimensions", () => {
        const layout = calculateAspectRatio(1920, 1080, 0, 0, "fit");

        // Should fallback to container dimensions
        expect(layout.width).toBe(1920);
        expect(layout.height).toBe(1080);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
      });

      it("should handle negative source dimensions", () => {
        const layout = calculateAspectRatio(1920, 1080, -100, -100, "fit");

        // Should fallback to container dimensions
        expect(layout.width).toBe(1920);
        expect(layout.height).toBe(1080);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
      });

      it("should handle very small container", () => {
        // Tiny preview window
        const layout = calculateAspectRatio(320, 180, 1920, 1080, "fit");

        expect(layout.width).toBe(320);
        expect(layout.height).toBe(180);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
        expect(layout.scale).toBeCloseTo(0.1667, 4); // 320/1920
      });

      it("should handle very large canvas", () => {
        // 4K canvas with HD video
        const layout = calculateAspectRatio(3840, 2160, 1920, 1080, "fit");

        expect(layout.width).toBe(3840);
        expect(layout.height).toBe(2160);
        expect(layout.x).toBe(0);
        expect(layout.y).toBe(0);
        expect(layout.scale).toBe(2); // 3840/1920 = 2
      });
    });
  });
});
