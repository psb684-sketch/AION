import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EffectPicker } from "../components/EffectPicker";
import { VideoEffectsApi } from "../api/videoEffectsApi";
import type { EffectPreset } from "../types";

const mockBodyEffects: EffectPreset[] = [
  {
    id: "subject-cutout",
    name: "Text Behind Subject",
    type: "body-effect",
    category: "Trending",
    description: "Places text behind subject",
    thumbnail: "",
    renderer: "subject_cutout",
    params: {},
    tags: ["cutout", "behind-subject"],
    intensity: { min: 0, max: 20, default: 4, step: 0.5 },
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
  },
  {
    id: "cyber-glow",
    name: "Cyber Neon Glow",
    type: "body-effect",
    category: "Aura",
    description: "Dynamic electric aura",
    thumbnail: "",
    renderer: "body_glow",
    params: {},
    tags: ["aura", "glow"],
    intensity: { min: 1, max: 30, default: 12, step: 1 },
    requirements: {
      minEngineVersion: "1.0.0",
      captureType: "silhouette_mask",
      maskCategory: "person",
    },
    compositing: {
      primitive: "MaskedGlow",
      layerZOrder: "behind-subject",
      blendMode: "screen",
    },
  },
  {
    id: "angel-wings",
    name: "Angel Wings",
    type: "body-effect",
    category: "Wings",
    description: "Skeletal anchored wings",
    thumbnail: "",
    renderer: "body_particles",
    params: {},
    tags: ["wings", "angel"],
    intensity: { min: 0.5, max: 3.0, default: 1.0, step: 0.1 },
    requirements: {
      minEngineVersion: "1.5.0",
      captureType: "hybrid_body",
      maskCategory: "person",
    },
    compositing: {
      primitive: "SkeletalSpriteAnchor",
      layerZOrder: "behind-subject",
      blendMode: "screen",
    },
  },
  {
    id: "future-quantum-rift",
    name: "Quantum Rift",
    type: "body-effect",
    category: "Aura",
    description: "Unsupported future primitive",
    thumbnail: "",
    renderer: "body_glow",
    params: {},
    tags: ["future"],
    intensity: { min: 1, max: 10, default: 5, step: 1 },
    requirements: {
      minEngineVersion: "99.0.0",
      captureType: "volumetric_pointcloud",
    },
    compositing: {
      primitive: "QuantumVolumetricShader",
      layerZOrder: "behind-subject",
    },
  },
];

describe("EffectPicker Component — Dynamic Catalog & Capability Evaluation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(VideoEffectsApi, "getBodyEffects").mockResolvedValue(mockBodyEffects);
  });

  it("renders effects and filters by selectedCategory prop", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<EffectPicker selectedCategory="trending" onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Text Behind Subject")).toBeInTheDocument();
    });
    expect(screen.queryByText("Cyber Neon Glow")).not.toBeInTheDocument();

    // Rerender with Aura category
    rerender(<EffectPicker selectedCategory="aura" onSelect={onSelect} />);
    expect(screen.getByText("Cyber Neon Glow")).toBeInTheDocument();
    expect(screen.queryByText("Text Behind Subject")).not.toBeInTheDocument();
  });

  it("displays POSE and BEHIND badges for skeletal behind-subject effects", async () => {
    render(<EffectPicker selectedCategory="wings" onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Angel Wings")).toBeInTheDocument();
    });

    expect(screen.getByText("POSE")).toBeInTheDocument();
    expect(screen.getByText("BEHIND")).toBeInTheDocument();
  });

  it("displays UNSUPPORTED badge and disables click for incompatible effects", async () => {
    const onSelect = vi.fn();
    render(<EffectPicker selectedCategory="aura" onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Quantum Rift")).toBeInTheDocument();
    });

    expect(screen.getByText("UNSUPPORTED")).toBeInTheDocument();

    // Clicking incompatible effect should NOT call onSelect
    const card = screen.getByText("Quantum Rift").closest("div[title*='Incompatible']");
    expect(card).toBeInTheDocument();
    if (card) {
      fireEvent.click(card);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });
});
