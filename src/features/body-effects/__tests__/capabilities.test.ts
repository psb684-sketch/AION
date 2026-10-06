import { describe, it, expect } from "vitest";
import { evaluateEffectCompatibility, LOCAL_ENGINE_CAPABILITIES } from "../capabilities";
import type { BodyEffectManifest } from "@clypra-studio/types";

describe("evaluateEffectCompatibility", () => {
  const baseCutoutManifest: BodyEffectManifest = {
    id: "subject-cutout",
    name: "Text Behind Subject",
    version: "1.0.0",
    category: "Cutout",
    description: "Places text or graphic layers behind a segmented person",
    requirements: {
      minEngineVersion: "1.0.0",
      captureType: "silhouette_mask",
      maskCategory: "person",
    },
    compositing: {
      primitive: "AlphaCutout",
      layerZOrder: "behind-subject",
      blendMode: "normal",
    },
    parameterSchema: {
      feather: { type: "float", default: 4, min: 0, max: 20 },
    },
    defaultParams: { feather: 4 },
    tags: ["cutout", "behind-subject"],
  };

  it("approves compatible cutout effect", () => {
    const result = evaluateEffectCompatibility(baseCutoutManifest, LOCAL_ENGINE_CAPABILITIES);
    expect(result.compatible).toBe(true);
  });

  it("approves compatible hybrid wings effect", () => {
    const wingsManifest: BodyEffectManifest = {
      ...baseCutoutManifest,
      id: "angel-wings",
      requirements: {
        minEngineVersion: "1.5.0",
        captureType: "hybrid_body",
      },
      compositing: {
        primitive: "SkeletalSpriteAnchor",
        layerZOrder: "behind-subject",
        blendMode: "screen",
      },
    };

    const result = evaluateEffectCompatibility(wingsManifest, LOCAL_ENGINE_CAPABILITIES);
    expect(result.compatible).toBe(true);
  });

  it("rejects effect requiring an unsupported capture provider", () => {
    const futureManifest: BodyEffectManifest = {
      ...baseCutoutManifest,
      requirements: {
        minEngineVersion: "2.0.0",
        captureType: "volumetric_mesh" as any,
      },
    };

    const result = evaluateEffectCompatibility(futureManifest, LOCAL_ENGINE_CAPABILITIES);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("Unsupported capture type");
  });

  it("rejects effect requiring an unsupported compositing primitive", () => {
    const futureManifest: BodyEffectManifest = {
      ...baseCutoutManifest,
      compositing: {
        primitive: "RaymarchedFluid3D" as any,
        layerZOrder: "behind-subject",
        blendMode: "normal",
      },
    };

    const result = evaluateEffectCompatibility(futureManifest, LOCAL_ENGINE_CAPABILITIES);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("Unsupported compositing primitive");
  });
});
