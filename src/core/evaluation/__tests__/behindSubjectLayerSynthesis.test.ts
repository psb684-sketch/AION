/**
 * Behind Subject Layer Synthesis Tests
 *
 * Validates that setting behindSubject on text/graphic overlays dynamically synthesizes
 * a foreground subject cutout layer with zero audio duplication.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateTimelineScene as evaluateScene } from "../evaluator";
import type { TextClip, VideoClip, Track, MediaAsset, Project } from "@/types";
import { useEffectsStore } from "@/features/text-effects/store/effectsStore";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
  invoke: vi.fn(),
}));

describe("Behind Subject Layer Synthesis", () => {
  const project: Project = {
    id: "test-project",
    name: "Behind Subject Test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    aspectRatio: "16:9",
    canvasWidth: 1920,
    canvasHeight: 1080,
    frameRate: 30,
    duration: 10,
  };

  // In Clypra's timeline, Track index 0 is the topmost track in UI (overlay layer),
  // while higher track indices are lower background layers.
  const tracks: Track[] = [
    { id: "t1", type: "text", name: "Text Track", muted: false, locked: false, visible: true, height: 56 },
    { id: "v1", type: "video", name: "Video Track", muted: false, locked: false, visible: true, height: 56 },
  ];

  const assets: MediaAsset[] = [
    {
      id: "asset-1",
      name: "presenter.mp4",
      type: "video",
      path: "/media/presenter.mp4",
      duration: 10,
      width: 1920,
      height: 1080,
      size: 1024 * 1024,
    },
  ];

  const videoClip: VideoClip = {
    id: "video-1",
    kind: "video",
    trackId: "v1",
    mediaId: "asset-1",
    startTime: 0,
    duration: 10,
    trimIn: 0,
    trimOut: 10,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    opacity: 1.0,
    rotation: 0,
  };

  const createTextClip = (overrides: Partial<TextClip> = {}): TextClip => ({
    id: "text-1",
    kind: "text",
    trackId: "t1",
    mediaId: "",
    startTime: 0,
    duration: 10,
    trimIn: 0,
    trimOut: 10,
    x: 960,
    y: 540,
    width: 600,
    height: 120,
    opacity: 1.0,
    rotation: 0,
    text: "Behind Person Headline",
    fontSize: 48,
    fontFamily: "Inter",
    color: "#ffffff",
    fontWeight: "bold",
    fontStyle: "normal",
    align: "center",
    valign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
    paddingX: 16,
    paddingY: 16,
    ...overrides,
  });

  beforeEach(() => {
    useEffectsStore.setState({ definitions: {} });
  });

  it("does not synthesize a cutout layer when behindSubject is false or undefined", () => {
    const textClip = createTextClip({
      id: "text-normal",
      text: "Standard Text",
      behindSubject: false,
    });

    const scene = evaluateScene(2.0, [videoClip, textClip], tracks, assets, project);

    // Only 2 visual layers: 1 video media layer, 1 text layer
    expect(scene.visualLayers).toHaveLength(2);
    const mediaLayers = scene.visualLayers.filter((l) => l.layerType === "media");
    const textLayers = scene.visualLayers.filter((l) => l.layerType === "text");
    expect(mediaLayers).toHaveLength(1);
    expect(textLayers).toHaveLength(1);
    expect(mediaLayers[0].layerId).not.toContain("subject-cutout");
  });

  it("synthesizes a foreground cutout layer when behindSubject is true", () => {
    const textClip = createTextClip({
      id: "text-behind",
      text: "Behind Person Headline",
      behindSubject: true,
      subjectFeather: 6,
    });

    const scene = evaluateScene(3.0, [videoClip, textClip], tracks, assets, project);

    // Should contain:
    // 1) Base video media layer
    // 2) Text layer
    // 3) Synthesized cutout media layer
    expect(scene.visualLayers).toHaveLength(3);

    const baseMedia = scene.visualLayers.find(
      (l) => l.layerType === "media" && !l.layerId.endsWith(":subject-cutout"),
    );
    const textLayer = scene.visualLayers.find((l) => l.layerType === "text");
    const cutoutLayer = scene.visualLayers.find(
      (l) => l.layerType === "media" && l.layerId.endsWith(":subject-cutout"),
    );

    expect(baseMedia).toBeDefined();
    expect(textLayer).toBeDefined();
    expect(cutoutLayer).toBeDefined();

    // Z-Order Sandwich Verification:
    // Base video is under text, cutout is above text
    expect(baseMedia!.zIndex).toBeLessThan(textLayer!.zIndex);
    expect(cutoutLayer!.zIndex).toBeGreaterThan(textLayer!.zIndex);
    expect(Number.isInteger(cutoutLayer!.zIndex)).toBe(true);

    // Cutout effect configuration
    if (cutoutLayer && cutoutLayer.layerType === "media") {
      expect(cutoutLayer.effects).toBeDefined();
      const cutoutEffect = cutoutLayer.effects?.find((fx) => fx.renderer === "body_cutout");
      expect(cutoutEffect).toBeDefined();
      expect(cutoutEffect?.type).toBe("body_effect");
      expect(cutoutEffect?.parameters?.feather).toBe(6);
      expect(cutoutEffect?.intensity).toBe(1.0);
    }
  });

  it("defaults subjectFeather to 4px when not explicitly specified", () => {
    const textClip = createTextClip({
      id: "text-default-feather",
      text: "Default Feather Text",
      behindSubject: true,
    });

    const scene = evaluateScene(1.0, [videoClip, textClip], tracks, assets, project);
    const cutoutLayer = scene.visualLayers.find(
      (l) => l.layerType === "media" && l.layerId.endsWith(":subject-cutout"),
    );

    expect(cutoutLayer).toBeDefined();
    if (cutoutLayer && cutoutLayer.layerType === "media") {
      const cutoutEffect = cutoutLayer.effects?.find((fx) => fx.renderer === "body_cutout");
      expect(cutoutEffect?.parameters?.feather).toBe(4);
    }
  });

  it("ensures zero audio duplication when behindSubject is enabled", () => {
    const textClip = createTextClip({
      id: "text-behind-audio-check",
      text: "Audio Immunity Text",
      behindSubject: true,
    });

    const scene = evaluateScene(4.0, [videoClip, textClip], tracks, assets, project);

    // Audio layers must only evaluate real audio sources (1 from videoClip)
    // The synthesized cutout media layer MUST NOT produce any audio layer
    expect(scene.audioLayers).toHaveLength(1);
    expect(scene.audioLayers[0].clipId).toBe(videoClip.id);
    expect(scene.audioLayers.some((a) => a.clipId.includes("subject-cutout"))).toBe(false);
  });
});
