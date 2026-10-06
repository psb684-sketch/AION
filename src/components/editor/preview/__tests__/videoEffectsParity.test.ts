import { describe, expect, it } from "vitest";
import type { EvaluatedMediaLayer, EvaluatedScene } from "@/core/evaluation/types";
import {
  buildNativeVideoProjectRequest,
  getNativePreviewBlockers,
} from "../nativeVideoPreview";

// ─── Mathematical Models ──────────────────────────────────────────────────────

function evalGlslRgbSplit(
  uv: [number, number],
  splitX: number,
  splitY: number,
  resolution: [number, number]
) {
  const res = [Math.max(resolution[0], 1), Math.max(resolution[1], 1)];
  const splitOffset = [splitX / res[0], splitY / res[1]];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const rUv = [clamp01(uv[0] - splitOffset[0]), clamp01(uv[1] - splitOffset[1])];
  const gUv = [uv[0], uv[1]];
  const bUv = [clamp01(uv[0] + splitOffset[0]), clamp01(uv[1] + splitOffset[1])];
  return { splitOffset, rUv, gUv, bUv };
}

function evalWgslRgbSplit(
  uv: [number, number],
  split_x: number,
  split_y: number,
  source_dimensions: [number, number]
) {
  const dims = [Math.max(source_dimensions[0], 1), Math.max(source_dimensions[1], 1)];
  const split_offset = [split_x / dims[0], split_y / dims[1]];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const rUv = [clamp01(uv[0] - split_offset[0]), clamp01(uv[1] - split_offset[1])];
  const gUv = [uv[0], uv[1]];
  const bUv = [clamp01(uv[0] + split_offset[0]), clamp01(uv[1] + split_offset[1])];
  return { split_offset, rUv, gUv, bUv };
}

function evalGlslPixelate(
  uv: [number, number],
  pixelSize: number,
  resolution: [number, number]
) {
  const res = [Math.max(resolution[0], 1), Math.max(resolution[1], 1)];
  const cell = [Math.max(pixelSize, 1) / res[0], Math.max(pixelSize, 1) / res[1]];
  const sampleUv = [
    Math.floor(uv[0] / cell[0]) * cell[0] + cell[0] * 0.5,
    Math.floor(uv[1] / cell[1]) * cell[1] + cell[1] * 0.5,
  ];
  return { cell, sampleUv };
}

function evalWgslPixelate(
  uv: [number, number],
  pixelate_size: number,
  source_dimensions: [number, number]
) {
  const dims = [Math.max(source_dimensions[0], 1), Math.max(source_dimensions[1], 1)];
  const cell = [Math.max(pixelate_size, 1) / dims[0], Math.max(pixelate_size, 1) / dims[1]];
  const sampleUv = [
    Math.floor(uv[0] / cell[0]) * cell[0] + cell[0] * 0.5,
    Math.floor(uv[1] / cell[1]) * cell[1] + cell[1] * 0.5,
  ];
  return { cell, sampleUv };
}

function evalScanlines(uvY: number, rgb: [number, number, number], count: number, intensity: number) {
  const scanline = Math.sin(uvY * count * 3.14159) * 0.5 + 0.5;
  const dark = rgb.map((c) => c * (1.0 - intensity * 0.5));
  return rgb.map((c, i) => dark[i] * (1.0 - scanline) + c * scanline) as [number, number, number];
}

function evalFilmGrain(uv: [number, number], seed: number, size: number, intensity: number, rgb: [number, number, number]) {
  const dotVal = (uv[0] + seed) * Math.max(size, 0.1) * 12.9898 + (uv[1] + seed) * Math.max(size, 0.1) * 78.233;
  const sinVal = Math.sin(dotVal) * 43758.5453;
  const grain = sinVal - Math.floor(sinVal);
  return rgb.map((c) => c + (grain - 0.5) * intensity) as [number, number, number];
}

function makeVideoLayer(overrides: Partial<EvaluatedMediaLayer> = {}): EvaluatedMediaLayer {
  return {
    layerId: "clip-fx",
    clipId: "clip-fx",
    role: "primary",
    clipKind: "video",
    zIndex: 0,
    trackIndex: 0,
    layerType: "media",
    mediaId: "asset-fx",
    mediaType: "video",
    sourcePath: "/Users/test/clip.mp4",
    sourceTime: 2,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    inTransition: false,
    blendMode: "normal",
    ...overrides,
  };
}

function makeScene(visualLayers: EvaluatedScene["visualLayers"]): EvaluatedScene {
  return {
    visualLayers,
    audioLayers: [],
    transitions: [],
    metadata: {
      time: 2,
      canvasWidth: 1920,
      canvasHeight: 1080,
      frameRate: 30,
      isGap: false,
    },
  };
}

describe("Video Effects WYSIWYG Parity Contract (RGB Split, Pixelate, Scanlines, Film Grain)", () => {
  const resolutions: Array<[number, number]> = [
    [1920, 1080],
    [3840, 2160],
    [1280, 720],
    [1080, 1920],
  ];

  describe("RGB Split Parity", () => {
    it("produces identical channel UV displacements between Studio and Desktop", () => {
      const splitValues = [0, 4, 8, 16, 25];
      for (const res of resolutions) {
        for (const sx of splitValues) {
          for (const sy of splitValues) {
            const glsl = evalGlslRgbSplit([0.5, 0.5], sx, sy, res);
            const wgsl = evalWgslRgbSplit([0.5, 0.5], sx, sy, res);

            expect(glsl.splitOffset[0]).toBeCloseTo(wgsl.split_offset[0], 7);
            expect(glsl.splitOffset[1]).toBeCloseTo(wgsl.split_offset[1], 7);
            expect(glsl.rUv[0]).toBeCloseTo(wgsl.rUv[0], 7);
            expect(glsl.bUv[0]).toBeCloseTo(wgsl.bUv[0], 7);
          }
        }
      }
    });

    it("correctly integrates RgbSplit into native preview pipeline without blockers", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "rgb-split",
            intensity: 1.0,
            localTime: 0,
            parameters: { splitX: 12.0, splitY: 6.0 },
            compositing: { primitive: "RgbSplit" },
          } as any,
        ],
      });
      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        rgbSplitX: 12.0,
        rgbSplitY: 6.0,
      });
      expect(getNativePreviewBlockers(makeScene([layer]))).toEqual([]);
    });
  });

  describe("Pixelate Parity", () => {
    it("produces identical quantized grid coordinates between Studio and Desktop", () => {
      const sizes = [4, 8, 16, 32, 64];
      const testUvs: Array<[number, number]> = [
        [0.12, 0.34],
        [0.55, 0.55],
        [0.89, 0.12],
        [0.99, 0.99],
      ];
      for (const res of resolutions) {
        for (const size of sizes) {
          for (const uv of testUvs) {
            const glsl = evalGlslPixelate(uv, size, res);
            const wgsl = evalWgslPixelate(uv, size, res);

            expect(glsl.cell[0]).toBeCloseTo(wgsl.cell[0], 7);
            expect(glsl.cell[1]).toBeCloseTo(wgsl.cell[1], 7);
            expect(glsl.sampleUv[0]).toBeCloseTo(wgsl.sampleUv[0], 7);
            expect(glsl.sampleUv[1]).toBeCloseTo(wgsl.sampleUv[1], 7);
          }
        }
      }
    });

    it("correctly integrates Pixelate into native preview pipeline without blockers", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "pixelate",
            intensity: 1.0,
            localTime: 0,
            parameters: { pixelSize: 24.0 },
            compositing: { primitive: "Pixelate" },
          } as any,
        ],
      });
      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        pixelateSize: 24.0,
      });
      expect(getNativePreviewBlockers(makeScene([layer]))).toEqual([]);
    });
  });

  describe("Scanlines Parity", () => {
    it("produces identical scanline luma attenuation across vertical lines", () => {
      const counts = [60, 120, 240];
      const intensities = [0.2, 0.5, 0.8];
      const baseRgb: [number, number, number] = [0.8, 0.5, 0.2];

      for (const count of counts) {
        for (const intensity of intensities) {
          for (let y = 0; y <= 1.0; y += 0.1) {
            const color = evalScanlines(y, baseRgb, count, intensity);
            expect(color[0]).toBeLessThanOrEqual(baseRgb[0]);
            expect(color[1]).toBeLessThanOrEqual(baseRgb[1]);
            expect(color[2]).toBeLessThanOrEqual(baseRgb[2]);
          }
        }
      }
    });

    it("correctly integrates Scanlines into native preview pipeline without blockers", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "scanlines",
            intensity: 0.8,
            localTime: 0,
            parameters: { scanlineCount: 160, scanlineIntensity: 0.5 },
            compositing: { primitive: "Scanlines" },
          } as any,
        ],
      });
      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        scanlineCount: 160,
        scanlineIntensity: 0.4, // 0.5 * 0.8
      });
      expect(getNativePreviewBlockers(makeScene([layer]))).toEqual([]);
    });
  });

  describe("Film Grain Parity", () => {
    it("produces deterministic noise values with identical mathematical formulation", () => {
      const seeds = [0.0, 1.5, 42.0];
      const sizes = [0.5, 1.0, 2.0];
      const baseRgb: [number, number, number] = [0.5, 0.5, 0.5];

      for (const seed of seeds) {
        for (const size of sizes) {
          const color1 = evalFilmGrain([0.3, 0.7], seed, size, 0.2, baseRgb);
          const color2 = evalFilmGrain([0.3, 0.7], seed, size, 0.2, baseRgb);
          expect(color1[0]).toBe(color2[0]);
          expect(color1[1]).toBe(color2[1]);
          expect(color1[2]).toBe(color2[2]);
        }
      }
    });

    it("correctly integrates FilmGrain into native preview pipeline without blockers", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "film-grain",
            intensity: 1.0,
            localTime: 0,
            parameters: { grainIntensity: 0.25, grainSize: 1.8 },
            compositing: { primitive: "FilmGrain" },
          } as any,
        ],
      });
      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        grainIntensity: 0.25,
        grainSize: 1.8,
      });
      expect(getNativePreviewBlockers(makeScene([layer]))).toEqual([]);
    });
  });
});
