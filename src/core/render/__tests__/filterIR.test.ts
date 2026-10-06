import { describe, it, expect } from "vitest";
import { resolveFilterToIR, compileFilterIRToCSS, compileFilterIRToFFmpeg, normalizeFilterIntensity, parseCSSFilterToIR } from "../filterIR";

describe("Filter IR & Target Compilers", () => {
  describe("resolveFilterToIR", () => {
    it("maps filter-sepia correctly", () => {
      const ir = resolveFilterToIR("filter-sepia", 0.8);
      expect(ir).toEqual({ sepia: 0.8 });
    });

    it("maps filter-retro correctly", () => {
      const ir = resolveFilterToIR("filter-retro", 0.5);
      expect(ir).toEqual({
        sepia: 0.25,
        saturate: 1.2,
        contrast: 0.925,
      });
    });

    it("maps filter-vivid correctly", () => {
      const ir = resolveFilterToIR("filter-vivid", 0.6);
      expect(ir).toEqual({
        saturate: 1.72,
        contrast: 1.15,
      });
    });

    it("maps filter-cool correctly", () => {
      const ir = resolveFilterToIR("filter-cool", 0.4);
      expect(ir).toEqual({
        hueRotate: -10,
        saturate: 0.96,
      });
    });

    it("maps filter-bw-classic correctly", () => {
      const ir = resolveFilterToIR("filter-bw-classic", 0.9);
      expect(ir).toEqual({ grayscale: 0.9 });
    });

    it("returns empty object for unknown filters", () => {
      const ir = resolveFilterToIR("filter-unknown", 0.5);
      expect(ir).toEqual({});
    });

    it("maps every filter exposed by the filters tab to a non-neutral IR", () => {
      const filterIds = [
        "filter-sepia",
        "filter-retro",
        "filter-aged",
        "filter-crisp",
        "filter-vivid",
        "filter-cool",
        "filter-cinematic-teal",
        "filter-bleach",
        "filter-moody",
        "filter-bw-classic",
        "filter-high-contrast",
        "filter-soft-bw",
        "filter-warm",
        "filter-cool-blue",
        "filter-purple-haze",
      ];

      for (const filterId of filterIds) {
        expect(resolveFilterToIR(filterId, 0.8), filterId).not.toEqual({});
      }
    });

    it("normalizes malformed intensity values", () => {
      expect(normalizeFilterIntensity(undefined)).toBe(0.8);
      expect(normalizeFilterIntensity(Number.NaN)).toBe(0.8);
      expect(normalizeFilterIntensity(-1)).toBe(0);
      expect(normalizeFilterIntensity(2)).toBe(1);
    });
  });

  describe("compileFilterIRToCSS", () => {
    it("generates correct CSS filter string for complex IR", () => {
      const ir = {
        sepia: 0.5,
        saturate: 1.4,
        contrast: 0.85,
        grayscale: 0.2,
        hueRotate: -25,
      };
      const css = compileFilterIRToCSS(ir);
      expect(css).toBe("sepia(50%) saturate(1.4) contrast(0.85) grayscale(20%) hue-rotate(-25deg)");
    });

    it("skips default/neutral values in CSS string", () => {
      const ir = {
        sepia: 0,
        saturate: 1,
        contrast: 1,
        grayscale: 0,
        hueRotate: 0,
      };
      const css = compileFilterIRToCSS(ir);
      expect(css).toBe("");
    });
  });

  describe("compileFilterIRToFFmpeg", () => {
    it("compiles sepia to colorchannelmixer filter segment", () => {
      const ir = { sepia: 0.8 };
      const ffmpeg = compileFilterIRToFFmpeg(ir);
      expect(ffmpeg).toContain("colorchannelmixer");
      expect(ffmpeg).toContain("rr=0.5144"); // 1 - 0.8 + 0.8 * 0.393 = 0.2 + 0.3144 = 0.5144
      expect(ffmpeg).toContain("rg=0.6152"); // 0.8 * 0.769 = 0.6152
      expect(ffmpeg).toContain("rb=0.1512"); // 0.8 * 0.189 = 0.1512
    });

    it("compiles hueRotate, saturate, and contrast adjustments", () => {
      const ir = {
        hueRotate: 5,
        saturate: 1.2,
        contrast: 1.1,
      };
      const ffmpeg = compileFilterIRToFFmpeg(ir);
      expect(ffmpeg).toBe("hue=h=5,hue=s=1.2,eq=contrast=1.1");
    });
  });

  describe("parseCSSFilterToIR", () => {
    it("parses individual filter functions correctly", () => {
      const ir = parseCSSFilterToIR("contrast(1.2) sepia(0.3) saturate(140%) grayscale(50%) hue-rotate(45deg)");
      expect(ir).toEqual({
        contrast: 1.2,
        sepia: 0.3,
        saturate: 1.4,
        grayscale: 0.5,
        hueRotate: 45,
      });
    });

    it("parses empty or empty-like filter strings gracefully", () => {
      expect(parseCSSFilterToIR("")).toEqual({});
      expect(parseCSSFilterToIR("none")).toEqual({});
    });
  });

  describe("resolveFilterToIR with custom swatch", () => {
    it("parses and scales custom swatch by intensity", () => {
      const swatch = "contrast(1.2) sepia(0.3) saturate(1.4) grayscale(0.5) hue-rotate(40deg)";
      const ir = resolveFilterToIR("custom-id", 0.5, swatch);
      expect(ir).toEqual({
        contrast: 1.1,     // 1.0 + 0.5 * (1.2 - 1.0) = 1.1
        sepia: 0.15,       // 0.5 * 0.3 = 0.15
        saturate: 1.2,     // 1.0 + 0.5 * (1.4 - 1.0) = 1.2
        grayscale: 0.25,   // 0.5 * 0.5 = 0.25
        hueRotate: 20,     // 0.5 * 40 = 20
      });
    });
  });
});
