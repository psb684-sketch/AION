import { describe, it, expect } from "vitest";
import {
  parseSubtitleTime,
  formatSubtitleTime,
  parseSubtitles,
  serializeSubtitles,
} from "../parser";

describe("SRT and WebVTT Subtitle System", () => {
  describe("parseSubtitleTime", () => {
    it("handles SRT format (commas)", () => {
      expect(parseSubtitleTime("00:01:20,500")).toBe(80.5);
      expect(parseSubtitleTime("00:00:05,000")).toBe(5);
    });

    it("handles WebVTT format (dots)", () => {
      expect(parseSubtitleTime("01:20:00.125")).toBe(4800.125);
      expect(parseSubtitleTime("00:02.500")).toBe(2.5);
    });
  });

  describe("formatSubtitleTime", () => {
    it("serializes to SRT standard format", () => {
      expect(formatSubtitleTime(80.5, "srt")).toBe("00:01:20,500");
    });

    it("serializes to VTT standard format", () => {
      expect(formatSubtitleTime(2.5, "vtt")).toBe("00:00:02.500");
    });
  });

  describe("parseSubtitles", () => {
    it("parses multi-block SRT successfully", () => {
      const srt = `1
00:00:01,000 --> 00:00:03,500
Hello World!

2
00:00:04,100 --> 00:00:07,000
This is a caption.
On multiple lines.`;

      const blocks = parseSubtitles(srt);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].startTime).toBe(1);
      expect(blocks[0].endTime).toBe(3.5);
      expect(blocks[0].text).toBe("Hello World!");
      expect(blocks[1].text).toBe("This is a caption.\nOn multiple lines.");
    });

    it("parses WebVTT successfully and strips tags", () => {
      const vtt = `WEBVTT

1
00:01.000 --> 00:03.500 line:0 position:10%
<b>Hello</b> <i>World!</i>`;

      const blocks = parseSubtitles(vtt);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].startTime).toBe(1);
      expect(blocks[0].endTime).toBe(3.5);
      expect(blocks[0].text).toBe("Hello World!");
    });
  });

  describe("serializeSubtitles", () => {
    it("round-trips to valid SRT string", () => {
      const blocks = [
        { id: "1", startTime: 1.0, endTime: 3.0, text: "First" },
        { id: "2", startTime: 5.5, endTime: 7.2, text: "Second" },
      ];

      const srt = serializeSubtitles(blocks, "srt");
      expect(srt).toContain("1\n00:00:01,000 --> 00:00:03,000\nFirst");
      expect(srt).toContain("2\n00:00:05,500 --> 00:00:07,200\nSecond");
    });
  });
});
