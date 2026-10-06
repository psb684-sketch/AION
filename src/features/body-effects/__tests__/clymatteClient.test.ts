import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkClymatteStatus,
  registerActiveMatte,
  unregisterActiveMatte,
  writeClymatteFrames,
  bakeClymatteClip,
  cancelClymatteBake,
} from "../bake/clymatteClient";
import { useClymatteStore } from "../bake/clymatteStore";
import { clipCommands } from "@/core/commands/clipCommands";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock("@/lib/platform/tauri", () => ({
  isTauriRuntime: () => true,
}));

describe("clymatteClient and Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClymatteStore.setState({
      bakingClips: {},
      bakedClips: {},
    });
  });

  it("checks .clymatte status through IPC", async () => {
    mockInvoke.mockResolvedValueOnce({
      exists: true,
      path: "/cache/mattes/clip123.clymatte",
      frameCount: 120,
      width: 512,
      height: 288,
      fpsNum: 30000,
      fpsDen: 1000,
      fileSizeBytes: 1048576,
    });

    const status = await checkClymatteStatus("clip-1", "clip123");
    expect(mockInvoke).toHaveBeenCalledWith("clymatte_check_status", {
      clipId: "clip-1",
      clipHash: "clip123",
    });
    expect(status.exists).toBe(true);
    expect(status.frameCount).toBe(120);
    expect(status.fileSizeBytes).toBe(1048576);
  });

  it("registers active matte prefetcher into preview session", async () => {
    mockInvoke.mockResolvedValueOnce({
      exists: true,
      path: "/cache/mattes/clip123.clymatte",
      frameCount: 60,
      width: 512,
      height: 288,
      fpsNum: 30000,
      fpsDen: 1000,
      fileSizeBytes: 524288,
    });

    const result = await registerActiveMatte("clip-1", undefined, "clip123");
    expect(mockInvoke).toHaveBeenCalledWith("clymatte_register_active_matte", {
      clipId: "clip-1",
      filePath: undefined,
      clipHash: "clip123",
    });
    expect(result.exists).toBe(true);
  });

  it("unregisters active matte prefetcher", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await unregisterActiveMatte("clip-1");
    expect(mockInvoke).toHaveBeenCalledWith("clymatte_unregister_active_matte", {
      clipId: "clip-1",
    });
  });

  it("serializes and streams frames to writeClymatteFrames", async () => {
    mockInvoke.mockResolvedValueOnce({
      exists: true,
      frameCount: 2,
    });

    const uint8Frame = new Uint8Array([255, 128, 0, 64]);
    await writeClymatteFrames({
      clipId: "clip-1",
      clipHash: "clip123",
      width: 2,
      height: 2,
      fpsNum: 30,
      fpsDen: 1,
      frames: [
        { timestampUs: 0, r8Data: uint8Frame },
        { timestampUs: 33333, r8Data: [255, 255, 255, 255] },
      ],
    });

    expect(mockInvoke).toHaveBeenCalledWith("clymatte_write_frames", {
      request: {
        clipId: "clip-1",
        clipHash: "clip123",
        width: 2,
        height: 2,
        fpsNum: 30,
        fpsDen: 1,
        frames: [
          { timestampUs: 0, r8Data: [255, 128, 0, 64] },
          { timestampUs: 33333, r8Data: [255, 255, 255, 255] },
        ],
      },
    });
  });

  it("dispatches bake and cancellation commands", async () => {
    mockInvoke.mockResolvedValueOnce("clip-1");
    const bakeRes = await bakeClymatteClip({
      clipId: "clip-1",
      videoPath: "/media/source.mp4",
      fps: 30,
    });
    expect(bakeRes).toBe("clip-1");
    expect(mockInvoke).toHaveBeenCalledWith("clymatte_bake_clip", {
      request: {
        clipId: "clip-1",
        videoPath: "/media/source.mp4",
        fps: 30,
      },
    });

    mockInvoke.mockResolvedValueOnce(true);
    const cancelRes = await cancelClymatteBake("clip-1");
    expect(cancelRes).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("clymatte_cancel_bake", {
      clipId: "clip-1",
    });
  });

  it("tracks reactive bake progress and completion in useClymatteStore", () => {
    const store = useClymatteStore.getState();

    // Start progress
    store.setBakeProgress("clip-1", 0.35, "segmenting");
    expect(useClymatteStore.getState().bakingClips["clip-1"]).toEqual({
      progress: 0.35,
      stage: "segmenting",
    });
    expect(useClymatteStore.getState().bakedClips["clip-1"]).toBeUndefined();

    // Complete bake
    store.setBakeComplete("clip-1");
    expect(useClymatteStore.getState().bakingClips["clip-1"]).toBeUndefined();
    expect(useClymatteStore.getState().bakedClips["clip-1"]).toBe(true);
  });

  it("has clip.bakeSubjectMask registered in clipCommands with correct visibility", () => {
    const cmd = clipCommands.find((c) => c.id === "clip.bakeSubjectMask");
    expect(cmd).toBeDefined();
    expect(cmd?.label).toBe("Bake Subject Mask (Render in Place)");
    expect(cmd?.group).toBe("media");

    const dummyContext: any = {
      selectedClipIds: ["c1"],
      clickedClipId: "c1",
      clips: [{ id: "c1", mediaId: "m1", kind: "video", duration: 5 }],
      tracks: [{ id: "t1" }],
    };

    expect(cmd?.isVisible(dummyContext)).toBe(true);
    expect(cmd?.isEnabled(dummyContext)).toBe(true);
  });
});
