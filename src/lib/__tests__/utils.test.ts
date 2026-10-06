/**
 * Utility Function Tests
 *
 * Tests core utility functions: clamp, fileBasename, isFormElement
 * Covers: edge cases, boundary values, invalid inputs
 */

import { describe, it, expect } from "vitest";
import { clamp, fileBasename, isFormElement } from "../utils";

describe("clamp", () => {
  it("should return value within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("should clamp to min when below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-100, -50, 50)).toBe(-50);
    expect(clamp(0.1, 1, 10)).toBe(1);
  });

  it("should clamp to max when above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(100, -50, 50)).toBe(50);
    expect(clamp(15, 1, 10)).toBe(10);
  });

  it("should handle equal min and max", () => {
    expect(clamp(5, 10, 10)).toBe(10);
    expect(clamp(100, 50, 50)).toBe(50);
    expect(clamp(0, 0, 0)).toBe(0);
  });

  it("should handle negative ranges", () => {
    expect(clamp(-30, -50, -20)).toBe(-30);
    expect(clamp(-100, -50, -20)).toBe(-50);
    expect(clamp(0, -50, -20)).toBe(-20);
  });

  it("should handle zero", () => {
    expect(clamp(0, -10, 10)).toBe(0);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(0, -10, 0)).toBe(0);
  });

  it("should handle very large values", () => {
    expect(clamp(Number.MAX_SAFE_INTEGER, 0, 100)).toBe(100);
    expect(clamp(Number.MIN_SAFE_INTEGER, -100, 0)).toBe(-100);
  });

  it("should handle floating point values", () => {
    expect(clamp(3.14159, 0, 5)).toBe(3.14159);
    expect(clamp(0.999999, 0, 0.5)).toBe(0.5);
    expect(clamp(-0.0001, 0, 1)).toBe(0);
  });

  it("should handle NaN (returns NaN)", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
    expect(clamp(5, NaN, 10)).toBeNaN();
    expect(clamp(5, 0, NaN)).toBeNaN();
  });

  it("should handle Infinity", () => {
    expect(clamp(Infinity, 0, 10)).toBe(10);
    expect(clamp(-Infinity, 0, 10)).toBe(0);
    expect(clamp(5, -Infinity, 10)).toBe(5);
    expect(clamp(5, 0, Infinity)).toBe(5);
    expect(clamp(5, -Infinity, Infinity)).toBe(5);
  });

  it("should handle reversed min/max (swaps them)", () => {
    // Math.min/max will handle this correctly
    expect(clamp(5, 10, 0)).toBe(5); // Actually clamps between 0 and 10
    expect(clamp(15, 10, 0)).toBe(10);
    expect(clamp(-5, 10, 0)).toBe(0);
  });

  it("should handle video editing use cases", () => {
    // Clamping playhead to duration
    expect(clamp(120, 0, 60)).toBe(60); // Playhead at 2min in 1min video
    expect(clamp(-10, 0, 60)).toBe(0); // Negative playhead
    expect(clamp(30, 0, 60)).toBe(30); // Normal playhead

    // Clamping trim values
    expect(clamp(100, 0, 60)).toBe(60); // Trim end beyond duration
    expect(clamp(-5, 0, 60)).toBe(0); // Negative trim start
  });
});

describe("fileBasename", () => {
  it("should extract filename from Unix path", () => {
    expect(fileBasename("/home/user/video.mp4")).toBe("video.mp4");
    expect(fileBasename("/test/folder/nested/file.mov")).toBe("file.mov");
    expect(fileBasename("/root.mp4")).toBe("root.mp4");
  });

  it("should extract filename from Windows path", () => {
    expect(fileBasename("C:\\Users\\user\\video.mp4")).toBe("video.mp4");
    expect(fileBasename("D:\\Projects\\video editing\\file.mov")).toBe("file.mov");
    expect(fileBasename("E:\\root.mp4")).toBe("root.mp4");
  });

  it("should handle mixed path separators", () => {
    expect(fileBasename("/home/user\\video.mp4")).toBe("video.mp4");
    expect(fileBasename("C:\\Users/user/video.mp4")).toBe("video.mp4");
  });

  it("should handle filename with no extension", () => {
    expect(fileBasename("/home/user/README")).toBe("README");
    expect(fileBasename("C:\\Users\\user\\Makefile")).toBe("Makefile");
  });

  it("should handle multiple extensions", () => {
    expect(fileBasename("/home/user/archive.tar.gz")).toBe("archive.tar.gz");
    expect(fileBasename("/test/video.backup.mp4")).toBe("video.backup.mp4");
  });

  it("should handle hidden files", () => {
    expect(fileBasename("/home/user/.bashrc")).toBe(".bashrc");
    expect(fileBasename("/home/user/.gitignore")).toBe(".gitignore");
  });

  it("should handle empty string", () => {
    expect(fileBasename("")).toBe("clip");
  });

  it("should handle null", () => {
    expect(fileBasename(null)).toBe("clip");
  });

  it("should handle undefined (via default)", () => {
    expect(fileBasename(undefined as unknown as string)).toBe("clip");
  });

  it("should handle path with trailing separator", () => {
    expect(fileBasename("/home/user/folder/")).toBe("clip");
    expect(fileBasename("C:\\Users\\user\\folder\\")).toBe("clip");
  });

  it("should handle single separator", () => {
    expect(fileBasename("/")).toBe("clip");
    expect(fileBasename("\\")).toBe("clip");
  });

  it("should handle filename with special characters", () => {
    expect(fileBasename("/home/user/video with spaces.mp4")).toBe("video with spaces.mp4");
    expect(fileBasename("/home/user/video[1].mp4")).toBe("video[1].mp4");
    expect(fileBasename("/home/user/video(2).mp4")).toBe("video(2).mp4");
    expect(fileBasename("/home/user/video'quote'.mp4")).toBe("video'quote'.mp4");
    expect(fileBasename('/home/user/video"quote".mp4')).toBe('video"quote".mp4');
    expect(fileBasename("/home/user/video-dash.mp4")).toBe("video-dash.mp4");
    expect(fileBasename("/home/user/video_underscore.mp4")).toBe("video_underscore.mp4");
  });

  it("should handle unicode filenames", () => {
    expect(fileBasename("/home/user/日本語.mp4")).toBe("日本語.mp4");
    expect(fileBasename("/home/user/відео.mp4")).toBe("відео.mp4");
    expect(fileBasename("/home/user/🎬video.mp4")).toBe("🎬video.mp4");
    expect(fileBasename("/home/user/中文视频.mp4")).toBe("中文视频.mp4");
  });

  it("should handle very long filenames", () => {
    const longName = "a".repeat(200) + ".mp4";
    expect(fileBasename(`/home/user/${longName}`)).toBe(longName);
  });

  it("should handle Tauri asset URLs", () => {
    expect(fileBasename("asset://localhost/test/video.mp4")).toBe("video.mp4");
    expect(fileBasename("asset://localhost/C:/Users/test/video.mp4")).toBe("video.mp4");
  });

  it("should handle file:// URLs", () => {
    expect(fileBasename("file:///home/user/video.mp4")).toBe("video.mp4");
    expect(fileBasename("file://C:/Users/user/video.mp4")).toBe("video.mp4");
  });

  it("should handle current directory paths", () => {
    expect(fileBasename("./video.mp4")).toBe("video.mp4");
    expect(fileBasename("../video.mp4")).toBe("video.mp4");
    expect(fileBasename(".\\video.mp4")).toBe("video.mp4");
    expect(fileBasename("..\\video.mp4")).toBe("video.mp4");
  });

  it("should handle relative paths without directory", () => {
    expect(fileBasename("video.mp4")).toBe("video.mp4");
    expect(fileBasename("README")).toBe("README");
  });

  it("should handle paths with dots in directory names", () => {
    expect(fileBasename("/home/user.name/video.mp4")).toBe("video.mp4");
    expect(fileBasename("C:\\Users\\user.name\\video.mp4")).toBe("video.mp4");
  });
});

describe("isFormElement", () => {
  it("should return true for input element", () => {
    const input = document.createElement("input");
    expect(isFormElement(input)).toBe(true);
  });

  it("should return true for textarea element", () => {
    const textarea = document.createElement("textarea");
    expect(isFormElement(textarea)).toBe(true);
  });

  it("should return true for select element", () => {
    const select = document.createElement("select");
    expect(isFormElement(select)).toBe(true);
  });

  it("should return true for button element", () => {
    const button = document.createElement("button");
    expect(isFormElement(button)).toBe(true);
  });

  it("should return true for anchor element", () => {
    const anchor = document.createElement("a");
    expect(isFormElement(anchor)).toBe(true);
  });

  it("should return true for element with role=button", () => {
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    expect(isFormElement(div)).toBe(true);
  });

  it("should return true for contenteditable element", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    expect(isFormElement(div)).toBe(true);
  });

  it("should return false for regular div", () => {
    const div = document.createElement("div");
    expect(isFormElement(div)).toBe(false);
  });

  it("should return false for span", () => {
    const span = document.createElement("span");
    expect(isFormElement(span)).toBe(false);
  });

  it("should return false for section", () => {
    const section = document.createElement("section");
    expect(isFormElement(section)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isFormElement(null)).toBe(false);
  });

  it("should return false for non-HTMLElement", () => {
    expect(isFormElement(document.createTextNode("text"))).toBe(false);
    expect(isFormElement(document.createComment("comment"))).toBe(false);
    expect(isFormElement(document)).toBe(false);
    expect(isFormElement(window)).toBe(false);
  });

  it("should return true for nested form elements", () => {
    const form = document.createElement("form");
    const div = document.createElement("div");
    const input = document.createElement("input");
    div.appendChild(input);
    form.appendChild(div);

    // The input is the target
    expect(isFormElement(input)).toBe(true);
    // The div contains a form element
    expect(isFormElement(div)).toBe(true);
    // The form contains form elements
    expect(isFormElement(form)).toBe(true);
  });

  it("should return false for element outside form", () => {
    const div = document.createElement("div");
    const form = document.createElement("form");
    const input = document.createElement("input");
    form.appendChild(input);

    // div is not a form element
    expect(isFormElement(div)).toBe(false);
  });

  it("should return true for contenteditable=false", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "false");
    // closest("[contenteditable='true']") won't match this
    expect(isFormElement(div)).toBe(false);
  });

  it("should return true for nested contenteditable", () => {
    const outer = document.createElement("div");
    outer.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    outer.appendChild(inner);

    expect(isFormElement(inner)).toBe(true);
  });

  it("should handle SVG elements", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    expect(isFormElement(svg)).toBe(false);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    expect(isFormElement(rect)).toBe(false);
  });

  it("should handle custom elements", () => {
    class CustomElement extends HTMLElement {}
    customElements.define("my-custom-element", CustomElement);
    const custom = document.createElement("my-custom-element");
    expect(isFormElement(custom)).toBe(false);
  });

  it("should handle disabled form elements", () => {
    const input = document.createElement("input");
    input.disabled = true;
    expect(isFormElement(input)).toBe(true);

    const button = document.createElement("button");
    button.disabled = true;
    expect(isFormElement(button)).toBe(true);
  });

  it("should handle readonly form elements", () => {
    const input = document.createElement("input");
    input.readOnly = true;
    expect(isFormElement(input)).toBe(true);
  });

  it("should handle hidden form elements", () => {
    const input = document.createElement("input");
    input.type = "hidden";
    expect(isFormElement(input)).toBe(true);
  });

  it("should handle various input types", () => {
    const types = ["text", "password", "email", "number", "tel", "url", "search", "date", "time", "checkbox", "radio", "file", "submit", "reset", "button", "color", "range", "month", "week", "datetime-local"];

    for (const type of types) {
      const input = document.createElement("input");
      input.type = type;
      expect(isFormElement(input)).toBe(true);
    }
  });

  it("should be used to prevent keyboard shortcuts in forms", () => {
    // Simulate scenario: user is typing in input
    const input = document.createElement("input");
    const div = document.createElement("div");

    // Keyboard shortcut handler would check:
    // if (isFormElement(event.target)) return; // Don't process shortcut

    expect(isFormElement(input)).toBe(true); // Skip shortcut
    expect(isFormElement(div)).toBe(false); // Process shortcut
  });
});
