/**
 * SplitClipCommand Integration Tests
 *
 * Tests both splits get new IDs to prevent property confusion.
 * These tests verify the fix works in realistic scenarios with volume, effects, and overlays.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SplitClipCommand } from "../SplitClipCommand";
import type { Clip } from "@/types";

describe("SplitClipCommand Integration Tests", () => {
  const createTestClip = (overrides?: Partial<Clip>): Clip => ({
    id: "original-clip",
    trackId: "track-1",
    mediaId: "media-1",
    startTime: 0,
    duration: 10,
    trimIn: 0,
    trimOut: 10,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    opacity: 1,
    rotation: 0,
    ...overrides,
  });

  describe("Property Independence After Split", () => {
    it("should allow independent volume changes after split", () => {
      const clip = createTestClip({ volume: 0.8 });
      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);

      const state = { clips: [clip], epoch: 0 };
      const newState = command.apply(state);

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Both inherit volume from original
      expect(leftClip.volume).toBe(0.8);
      expect(rightClip.volume).toBe(0.8);

      // Simulate user changing right clip volume
      const rightClipUpdated = { ...rightClip, volume: 1.0 };

      // IDs are different, so no confusion
      expect(leftClipId).not.toBe(rightClipId);
      expect(leftClipId).not.toBe("original-clip");
      expect(rightClipId).not.toBe("original-clip");

      // Left clip volume unchanged (independent)
      expect(leftClip.volume).toBe(0.8);
      expect(rightClipUpdated.volume).toBe(1.0);
    });

    it("should allow independent effect changes after split", () => {
      const clip = createTestClip({
        effects: [
          {
            id: "effect-1",
            effectId: "preset-1",
            type: "effect",
            renderer: "blur",
            params: {},
            startTime: 0,
            duration: 5,
            intensity: 0.5,
          },
        ],
      });

      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const newState = command.apply({ clips: [clip], epoch: 0 });

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Both inherit effects from original
      expect(leftClip.effects).toHaveLength(1);
      expect(rightClip.effects).toHaveLength(1);

      // Different IDs mean effects can be modified independently
      expect(leftClipId).not.toBe(rightClipId);
    });

    it("should allow independent overlay changes after split", () => {
      const clip = createTestClip({
        overlays: [
          {
            id: "overlay-1",
            effectId: "overlay-asset-1",
            type: "overlay",
            url: "blob:test",
            x: 100,
            y: 100,
            width: 200,
            height: 200,
            rotation: 0,
            opacity: 1,
            blendMode: "normal",
            startTime: 0,
            duration: 5,
            loop: false,
          },
        ],
      });

      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const newState = command.apply({ clips: [clip], epoch: 0 });

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Both inherit overlays from original
      expect(leftClip.overlays).toHaveLength(1);
      expect(rightClip.overlays).toHaveLength(1);

      // Different IDs mean overlays can be modified independently
      expect(leftClipId).not.toBe(rightClipId);
    });
  });

  describe("Multiple Splits in Sequence", () => {
    it("should handle sequential splits correctly", () => {
      // Original: 0-10s
      const clip = createTestClip({ volume: 0.5 });

      // First split at 5s
      const command1 = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const state1 = command1.apply({ clips: [clip], epoch: 0 });

      const leftClipId1 = command1.getLeftClipId()!;
      const rightClipId1 = command1.getRightClipId()!;

      expect(state1.clips).toHaveLength(2);
      expect(state1.clips.find((c) => c.id === "original-clip")).toBeUndefined();

      // Second split on right piece at 7.5s
      const rightClip1 = state1.clips.find((c) => c.id === rightClipId1)!;
      const command2 = new SplitClipCommand(rightClipId1, 7.5, 30, rightClip1);
      const state2 = command2.apply(state1);

      const leftClipId2 = command2.getLeftClipId()!;
      const rightClipId2 = command2.getRightClipId()!;

      // Should have 3 clips total
      expect(state2.clips).toHaveLength(3);

      // All clips should have different IDs
      const allIds = [leftClipId1, leftClipId2, rightClipId2];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(3);

      // Original clip should still not exist
      expect(state2.clips.find((c) => c.id === "original-clip")).toBeUndefined();
    });

    it("should maintain clip properties through multiple splits", () => {
      const clip = createTestClip({ volume: 0.7, opacity: 0.9 });

      // Split 1: 0-10 → (0-3) + (3-10)
      const cmd1 = new SplitClipCommand("original-clip", 3.0, 30, clip);
      const state1 = cmd1.apply({ clips: [clip], epoch: 0 });

      const left1 = state1.clips.find((c) => c.id === cmd1.getLeftClipId()!)!;
      const right1 = state1.clips.find((c) => c.id === cmd1.getRightClipId()!)!;

      // Both inherit properties
      expect(left1.volume).toBe(0.7);
      expect(right1.volume).toBe(0.7);
      expect(left1.opacity).toBe(0.9);
      expect(right1.opacity).toBe(0.9);

      // Split 2: (3-10) → (3-7) + (7-10)
      const cmd2 = new SplitClipCommand(right1.id, 7.0, 30, right1);
      const state2 = cmd2.apply(state1);

      const left2 = state2.clips.find((c) => c.id === cmd2.getLeftClipId()!)!;
      const right2 = state2.clips.find((c) => c.id === cmd2.getRightClipId()!)!;

      // Properties continue to propagate
      expect(left2.volume).toBe(0.7);
      expect(right2.volume).toBe(0.7);
      expect(left2.opacity).toBe(0.9);
      expect(right2.opacity).toBe(0.9);
    });
  });

  describe("Undo/Redo Behavior", () => {
    it("should restore original clip ID on undo", () => {
      const clip = createTestClip({ volume: 0.6 });
      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);

      // Apply split
      const state1 = command.apply({ clips: [clip], epoch: 0 });
      expect(state1.clips).toHaveLength(2);
      expect(state1.clips.find((c) => c.id === "original-clip")).toBeUndefined();

      // Undo (invert)
      const undoCommand = command.invert();
      const state2 = undoCommand.apply(state1);

      // Should restore original clip
      expect(state2.clips).toHaveLength(1);
      const restoredClip = state2.clips[0];
      expect(restoredClip.id).toBe("original-clip");
      expect(restoredClip.duration).toBe(10);
      expect(restoredClip.volume).toBe(0.6);
    });

    it("should handle undo/redo cycle correctly", () => {
      const clip = createTestClip();
      const splitCommand = new SplitClipCommand("original-clip", 5.0, 30, clip);

      const initialState = { clips: [clip], epoch: 0 };

      // Do: Split
      const afterSplit = splitCommand.apply(initialState);
      expect(afterSplit.clips).toHaveLength(2);
      const leftClipId = splitCommand.getLeftClipId()!;
      const rightClipId = splitCommand.getRightClipId()!;

      // Undo: Merge (restores original)
      const undoCommand = splitCommand.invert();
      const afterUndo = undoCommand.apply(afterSplit);
      expect(afterUndo.clips).toHaveLength(1);
      expect(afterUndo.clips[0].id).toBe("original-clip");
      expect(afterUndo.clips[0].duration).toBe(10);

      // Redo: Apply original split command again (in real app, history manager does this)
      const afterRedo = splitCommand.apply(afterUndo);
      expect(afterRedo.clips).toHaveLength(2);

      // After redo, should have same IDs as first split (command reuses IDs)
      const leftClipAfterRedo = afterRedo.clips.find((c) => c.id === leftClipId);
      const rightClipAfterRedo = afterRedo.clips.find((c) => c.id === rightClipId);
      expect(leftClipAfterRedo).toBeDefined();
      expect(rightClipAfterRedo).toBeDefined();
      expect(leftClipAfterRedo!.duration).toBe(5);
      expect(rightClipAfterRedo!.duration).toBe(5);
    });
  });

  describe("Edge Cases with Properties", () => {
    it("should handle split with complex effects structure", () => {
      const clip = createTestClip({
        effects: [
          {
            id: "effect-1",
            effectId: "preset-1",
            type: "effect",
            renderer: "blur",
            params: {},
            startTime: 0,
            duration: 5,
            intensity: 0.5,
          },
          {
            id: "effect-2",
            effectId: "preset-2",
            type: "effect",
            renderer: "brightness",
            params: {},
            startTime: 0,
            duration: 5,
            intensity: 0.2,
          },
          {
            id: "effect-3",
            effectId: "preset-3",
            type: "effect",
            renderer: "contrast",
            params: {},
            startTime: 0,
            duration: 5,
            intensity: 0.3,
          },
        ],
        volume: 0.75,
      });

      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const newState = command.apply({ clips: [clip], epoch: 0 });

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Both inherit all effects
      expect(leftClip.effects).toHaveLength(3);
      expect(rightClip.effects).toHaveLength(3);
      expect(leftClip.volume).toBe(0.75);
      expect(rightClip.volume).toBe(0.75);

      // Different IDs ensure independence
      expect(leftClipId).not.toBe(rightClipId);
      expect(leftClipId).not.toBe("original-clip");
    });

    it("should handle split at exact frame boundaries with properties", () => {
      const clip = createTestClip({
        startTime: 0,
        duration: 10,
        volume: 0.5,
      });

      // Split at exact 30fps frame: 5.0s = frame 150
      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const newState = command.apply({ clips: [clip], epoch: 0 });

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Exact split, both inherit volume
      expect(leftClip.startTime).toBe(0);
      expect(leftClip.duration).toBe(5);
      expect(leftClip.volume).toBe(0.5);

      expect(rightClip.startTime).toBe(5);
      expect(rightClip.duration).toBe(5);
      expect(rightClip.volume).toBe(0.5);
    });

    it("should handle split with undefined volume (default)", () => {
      const clip = createTestClip({
        volume: undefined, // Default volume
      });

      const command = new SplitClipCommand("original-clip", 5.0, 30, clip);
      const newState = command.apply({ clips: [clip], epoch: 0 });

      const leftClipId = command.getLeftClipId()!;
      const rightClipId = command.getRightClipId()!;
      const leftClip = newState.clips.find((c) => c.id === leftClipId)!;
      const rightClip = newState.clips.find((c) => c.id === rightClipId)!;

      // Undefined should remain undefined (or use default)
      expect(leftClip.volume).toBeUndefined();
      expect(rightClip.volume).toBeUndefined();

      // IDs should still be different
      expect(leftClipId).not.toBe(rightClipId);
    });
  });

  describe("Real-World Scenario: The Bug Case", () => {
    it("reproduces and fixes the original bug scenario", () => {
      // User has a clip with specific volume
      const clip = createTestClip({
        id: "my-clip",
        volume: 0.5,
      });

      // User splits the clip
      const splitCommand = new SplitClipCommand("my-clip", 5.0, 30, clip);
      const afterSplit = splitCommand.apply({ clips: [clip], epoch: 0 });

      const leftClipId = splitCommand.getLeftClipId()!;
      const rightClipId = splitCommand.getRightClipId()!;

      // BEFORE FIX: leftClipId would === "my-clip" (reused original ID)
      // AFTER FIX: leftClipId !== "my-clip" (new ID generated)
      expect(leftClipId).not.toBe("my-clip");
      expect(rightClipId).not.toBe("my-clip");
      expect(leftClipId).not.toBe(rightClipId);

      // Original clip no longer exists in timeline
      expect(afterSplit.clips.find((c) => c.id === "my-clip")).toBeUndefined();

      // User adjusts volume on right clip
      let rightClip = afterSplit.clips.find((c) => c.id === rightClipId)!;
      rightClip = { ...rightClip, volume: 1.0 };

      // BEFORE FIX: If UI had cached "my-clip" reference, it would modify wrong clip
      // AFTER FIX: Impossible to reference "my-clip" (doesn't exist)

      // Left clip volume unchanged
      const leftClip = afterSplit.clips.find((c) => c.id === leftClipId)!;
      expect(leftClip.volume).toBe(0.5);
      expect(rightClip.volume).toBe(1.0);
    });
  });
});
