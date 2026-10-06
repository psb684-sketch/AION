/**
 * Local Client Capability Evaluator
 *
 * Validates remote effect manifests against local desktop engine capabilities,
 * preventing old installs from loading incompatible shaders or missing models.
 */

import type {
  BodyEffectManifest,
  BodyEffectRequirements,
  BodyEffectCompositing,
} from "@clypra-studio/types";

export interface EngineCapabilities {
  readonly engineVersion: string;
  readonly availableProviders: ReadonlySet<string>;
  readonly supportedPrimitives: ReadonlySet<string>;
}

export interface EffectCompatibilityInput {
  readonly requirements: BodyEffectRequirements;
  readonly compositing: BodyEffectCompositing;
}

export const LOCAL_ENGINE_CAPABILITIES: EngineCapabilities = {
  engineVersion: "1.5.2",
  availableProviders: new Set([
    "silhouette_mask",
    "mask:person",
    "skeletal_pose",
    "pose:blazepose33",
    "hybrid_body",
  ]),
  supportedPrimitives: new Set([
    "PassThrough",
    "AlphaCutout",
    "body_cutout",
    "subject_cutout",
    "MaskedGlow",
    "body_glow",
    "body_segmentation_glow",
    "MaskedStroke",
    "body_outline",
    "MaskedDualBlur",
    "body_particles",
    "SkeletalSpriteAnchor",
    "ChromaticAberration",
    "chromatic_aberration",
    "chromatic-aberration",
  ]),
};

export function evaluateEffectCompatibility(
  manifest: EffectCompatibilityInput | BodyEffectManifest,
  caps: EngineCapabilities = LOCAL_ENGINE_CAPABILITIES,
): { compatible: boolean; reason?: string } {
  // Check capture type requirement (only if captureType is specified and not "none")
  if (
    manifest.requirements.captureType &&
    manifest.requirements.captureType !== "none" &&
    !caps.availableProviders.has(manifest.requirements.captureType)
  ) {
    return {
      compatible: false,
      reason: `Unsupported capture type: ${manifest.requirements.captureType}`,
    };
  }

  // Check primitive requirement
  if (!caps.supportedPrimitives.has(manifest.compositing.primitive)) {
    return {
      compatible: false,
      reason: `Unsupported compositing primitive: ${manifest.compositing.primitive}`,
    };
  }

  return { compatible: true };
}
