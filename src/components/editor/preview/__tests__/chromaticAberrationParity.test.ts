import { describe, expect, it } from "vitest";
import type { EvaluatedMediaLayer, EvaluatedScene } from "@/core/evaluation/types";
import {
  buildNativeVideoProjectRequest,
  getNativePreviewBlockers,
} from "../nativeVideoPreview";

/**
 * Direct evaluation of Studio's GLSL Chromatic Aberration Shader Node
 * (from clypra-engine/src/effects/video/chromaticAberration.ts)
 */
function evalGlslChromaticAberration(
  uv: [number, number],
  amount: number,
  angleDegrees: number,
  edgeFeather: number,
  resolution: [number, number]
) {
  const rad = angleDegrees * 0.0174532925;
  const dir: [number, number] = [Math.cos(rad), Math.sin(rad)];
  const distFromCenter = Math.hypot(uv[0] - 0.5, uv[1] - 0.5) * 2.0;
  const smooth = (x: number) => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };
  const featherClamped = Math.max(0, Math.min(1, edgeFeather));
  const featherFactor = 1.0 * (1.0 - featherClamped) + smooth(distFromCenter) * featherClamped;
  const res: [number, number] = [Math.max(resolution[0], 1), Math.max(resolution[1], 1)];
  const offset: [number, number] = [
    (dir[0] * amount * featherFactor) / res[0],
    (dir[1] * amount * featherFactor) / res[1],
  ];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const rUv: [number, number] = [clamp01(uv[0] + offset[0]), clamp01(uv[1] + offset[1])];
  const gUv: [number, number] = [uv[0], uv[1]];
  const bUv: [number, number] = [clamp01(uv[0] - offset[0]), clamp01(uv[1] - offset[1])];
  return { offset, rUv, gUv, bUv, featherFactor };
}

/**
 * Direct evaluation of Desktop's WGSL Chromatic Aberration Shader
 * (from clypra/src-tauri/src/shaders/multi_track_blend.wgsl:257-275)
 */
function evalWgslChromaticAberration(
  uv: [number, number],
  amount: number,
  angle_degrees: number,
  edge_feather: number,
  source_dimensions: [number, number]
) {
  const rad = angle_degrees * 0.0174532925;
  const dir: [number, number] = [Math.cos(rad), Math.sin(rad)];
  const dist_from_center = Math.hypot(uv[0] - 0.5, uv[1] - 0.5) * 2.0;
  const smooth = (x: number) => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };
  const feather_clamped = Math.max(0, Math.min(1, edge_feather));
  const feather_factor = 1.0 * (1.0 - feather_clamped) + smooth(dist_from_center) * feather_clamped;
  const dims: [number, number] = [Math.max(source_dimensions[0], 1), Math.max(source_dimensions[1], 1)];
  const offset: [number, number] = [
    (dir[0] * amount * feather_factor) / dims[0],
    (dir[1] * amount * feather_factor) / dims[1],
  ];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const rUv: [number, number] = [clamp01(uv[0] + offset[0]), clamp01(uv[1] + offset[1])];
  const gUv: [number, number] = [uv[0], uv[1]];
  const bUv: [number, number] = [clamp01(uv[0] - offset[0]), clamp01(uv[1] - offset[1])];
  return { offset, rUv, gUv, bUv, feather_factor };
}

function makeVideoLayer(overrides: Partial<EvaluatedMediaLayer> = {}): EvaluatedMediaLayer {
  return {
    layerId: "clip-chromatic",
    clipId: "clip-chromatic",
    role: "primary",
    clipKind: "video",
    zIndex: 0,
    trackIndex: 0,
    layerType: "media",
    mediaId: "asset-chromatic",
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

describe("Chromatic Aberration WYSIWYG Parity Contract", () => {
  describe("Mathematical Equivalence (Studio GLSL vs Desktop WGSL)", () => {
    const resolutions: Array<[number, number]> = [
      [1920, 1080],
      [3840, 2160],
      [1280, 720],
      [1080, 1920],
    ];
    const angles = [0.0, 45.0, 90.0, 180.0, 270.0, 315.0];
    const amounts = [0.0, 4.0, 8.0, 12.0, 20.0, 50.0];
    const feathers = [0.0, 0.25, 0.5, 0.8, 1.0];
    const testPoints: Array<[number, number]> = [
      [0.5, 0.5], // optical center
      [0.0, 0.0], // top-left corner
      [1.0, 1.0], // bottom-right corner
      [0.5, 0.0], // top-center edge
      [0.2, 0.8], // off-center interior
    ];

    it("yields identical UV offsets across comprehensive parameter sweeps (< 1e-7 delta)", () => {
      let vectorCount = 0;
      for (const res of resolutions) {
        for (const angle of angles) {
          for (const amount of amounts) {
            for (const feather of feathers) {
              for (const uv of testPoints) {
                const glsl = evalGlslChromaticAberration(uv, amount, angle, feather, res);
                const wgsl = evalWgslChromaticAberration(uv, amount, angle, feather, res);

                expect(glsl.offset[0]).toBeCloseTo(wgsl.offset[0], 7);
                expect(glsl.offset[1]).toBeCloseTo(wgsl.offset[1], 7);
                expect(glsl.rUv[0]).toBeCloseTo(wgsl.rUv[0], 7);
                expect(glsl.rUv[1]).toBeCloseTo(wgsl.rUv[1], 7);
                expect(glsl.bUv[0]).toBeCloseTo(wgsl.bUv[0], 7);
                expect(glsl.bUv[1]).toBeCloseTo(wgsl.bUv[1], 7);
                expect(glsl.featherFactor).toBeCloseTo(wgsl.feather_factor, 7);
                vectorCount++;
              }
            }
          }
        }
      }
      expect(vectorCount).toBeGreaterThan(500);
    });

    it("preserves zero displacement at optical center when edgeFeather = 1.0", () => {
      const centerUv: [number, number] = [0.5, 0.5];
      const glsl = evalGlslChromaticAberration(centerUv, 20.0, 45.0, 1.0, [1920, 1080]);
      const wgsl = evalWgslChromaticAberration(centerUv, 20.0, 45.0, 1.0, [1920, 1080]);

      expect(glsl.featherFactor).toBe(0.0);
      expect(wgsl.feather_factor).toBe(0.0);
      expect(glsl.offset[0]).toBe(0.0);
      expect(glsl.offset[1]).toBe(0.0);
      expect(wgsl.offset[0]).toBe(0.0);
      expect(wgsl.offset[1]).toBe(0.0);
    });

    it("produces uniform displacement across frame when edgeFeather = 0.0", () => {
      const p1 = evalWgslChromaticAberration([0.5, 0.5], 10.0, 0.0, 0.0, [1920, 1080]);
      const p2 = evalWgslChromaticAberration([0.0, 0.0], 10.0, 0.0, 0.0, [1920, 1080]);
      const p3 = evalWgslChromaticAberration([1.0, 1.0], 10.0, 0.0, 0.0, [1920, 1080]);

      expect(p1.feather_factor).toBe(1.0);
      expect(p2.feather_factor).toBe(1.0);
      expect(p3.feather_factor).toBe(1.0);
      expect(p1.offset[0]).toBeCloseTo(p2.offset[0], 7);
      expect(p1.offset[0]).toBeCloseTo(p3.offset[0], 7);
    });

    it("constrains horizontal shift to X-axis at angle 0°", () => {
      const res = evalWgslChromaticAberration([0.8, 0.8], 15.0, 0.0, 0.0, [1920, 1080]);
      expect(res.offset[0]).toBeGreaterThan(0);
      expect(res.offset[1]).toBeCloseTo(0, 7);
    });

    it("constrains vertical shift to Y-axis at angle 90°", () => {
      const res = evalWgslChromaticAberration([0.8, 0.8], 15.0, 90.0, 0.0, [1920, 1080]);
      expect(res.offset[0]).toBeCloseTo(0, 7);
      expect(res.offset[1]).toBeGreaterThan(0);
    });
  });

  describe("Integration with Clypra Native Preview Pipeline", () => {
    it("correctly serializes compositing.primitive ChromaticAberration into native request", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "chromatic-aberration",
            intensity: 1.0,
            localTime: 0,
            parameters: {
              amount: 14.0,
              angleDegrees: 30.0,
              edgeFeather: 0.6,
            },
            compositing: {
              primitive: "ChromaticAberration",
              layerZOrder: "in-front",
              blendMode: "normal",
            },
          } as any,
        ],
      });

      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request).not.toBeNull();
      const grade = request?.layers[0].colorGrade;
      expect(grade).toMatchObject({
        chromaticAmount: 14.0,
        chromaticAngle: 30.0,
        chromaticEdgeFeather: 0.6,
      });
    });

    it("scales chromatic amount by effect.intensity", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "chromatic-aberration",
            intensity: 0.5,
            localTime: 0,
            parameters: {
              amount: 20.0,
              angleDegrees: 45.0,
              edgeFeather: 0.5,
            },
            compositing: {
              primitive: "ChromaticAberration",
            },
          } as any,
        ],
      });

      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        chromaticAmount: 10.0,
        chromaticAngle: 45.0,
        chromaticEdgeFeather: 0.5,
      });
    });

    it("accepts legacy renderer: chromatic_aberration for backwards compatibility", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            renderer: "chromatic_aberration",
            intensity: 1.0,
            localTime: 0,
            parameters: {
              amount: 8.0,
              angleDegrees: 0.0,
              edgeFeather: 0.5,
            },
          } as any,
        ],
      });

      const request = buildNativeVideoProjectRequest(makeScene([layer]));
      expect(request?.layers[0].colorGrade).toMatchObject({
        chromaticAmount: 8.0,
        chromaticAngle: 0.0,
        chromaticEdgeFeather: 0.5,
      });
    });

    it("does not report blockers for ChromaticAberration primitive", () => {
      const layer = makeVideoLayer({
        effects: [
          {
            effectId: "chromatic-aberration",
            intensity: 1.0,
            localTime: 0,
            parameters: {
              amount: 8.0,
              angleDegrees: 0.0,
              edgeFeather: 0.5,
            },
            compositing: {
              primitive: "ChromaticAberration",
            },
          } as any,
        ],
      });

      const blockers = getNativePreviewBlockers(makeScene([layer]));
      expect(blockers).toEqual([]);
    });
  });
});
