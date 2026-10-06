import { describe, it, expect } from "vitest";
import { resolveExportDimensions, QUALITY_TIERS } from "../exportDimensions";

describe("resolveExportDimensions", () => {
  it("should resolve portrait dimensions correctly", () => {
    // 9:16 portrait project
    const projectWidth = 1080;
    const projectHeight = 1920;

    // 1080p tier -> long edge = 1920
    const resolved1080p = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[1]);
    expect(resolved1080p.width).toBe(1080);
    expect(resolved1080p.height).toBe(1920);

    // 720p tier -> long edge = 1280
    const resolved720p = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[0]);
    expect(resolved720p.width).toBe(720);
    expect(resolved720p.height).toBe(1280);
  });

  it("should resolve landscape dimensions correctly", () => {
    // 16:9 landscape project
    const projectWidth = 1920;
    const projectHeight = 1080;

    // 1080p tier -> long edge = 1920
    const resolved1080p = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[1]);
    expect(resolved1080p.width).toBe(1920);
    expect(resolved1080p.height).toBe(1080);

    // 720p tier -> long edge = 1280
    const resolved720p = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[0]);
    expect(resolved720p.width).toBe(1280);
    expect(resolved720p.height).toBe(720);
  });

  it("should resolve square dimensions correctly", () => {
    // 1:1 square project
    const projectWidth = 1080;
    const projectHeight = 1080;

    // 1080p tier -> long edge = 1920 (scales square to 1920x1920)
    const resolved1080p = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[1]);
    expect(resolved1080p.width).toBe(1920);
    expect(resolved1080p.height).toBe(1920);
  });

  it("should round resolved dimensions to even numbers", () => {
    // Unusual portrait aspect ratio
    const projectWidth = 333;
    const projectHeight = 777;

    // 720p tier -> long edge = 1280
    const resolved = resolveExportDimensions(projectWidth, projectHeight, QUALITY_TIERS[0]);
    expect(resolved.width % 2).toBe(0);
    expect(resolved.height % 2).toBe(0);
  });
});
