import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/lib/platform/tauri";

export interface ClymatteStatus {
  exists: boolean;
  path?: string;
  frameCount: number;
  width: number;
  height: number;
  fpsNum: number;
  fpsDen: number;
  fileSizeBytes: number;
}

export interface ClymatteFrameInput {
  timestampUs: number;
  r8Data: number[] | Uint8Array;
}

export interface ClymatteWriteRequest {
  clipId: string;
  clipHash: string;
  width: number;
  height: number;
  fpsNum: number;
  fpsDen: number;
  modelSignature?: string;
  frames: ClymatteFrameInput[];
}

export interface ClymatteBakeRequest {
  clipId: string;
  videoPath: string;
  clipHash?: string;
  modelSignature?: string;
  startSecs?: number;
  endSecs?: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface ClymatteProgressPayload {
  clipId: string;
  progress: number;
  elapsedMs: number;
  stage: string;
}

export async function checkClymatteStatus(
  clipId: string,
  clipHash?: string,
): Promise<ClymatteStatus> {
  if (!isTauriRuntime()) {
    return {
      exists: false,
      frameCount: 0,
      width: 0,
      height: 0,
      fpsNum: 0,
      fpsDen: 0,
      fileSizeBytes: 0,
    };
  }
  return invoke<ClymatteStatus>("clymatte_check_status", {
    clipId,
    clipHash,
  });
}

export async function registerActiveMatte(
  clipId: string,
  filePath?: string,
  clipHash?: string,
): Promise<ClymatteStatus> {
  if (!isTauriRuntime()) {
    return {
      exists: false,
      frameCount: 0,
      width: 0,
      height: 0,
      fpsNum: 0,
      fpsDen: 0,
      fileSizeBytes: 0,
    };
  }
  return invoke<ClymatteStatus>("clymatte_register_active_matte", {
    clipId,
    filePath,
    clipHash,
  });
}

export async function unregisterActiveMatte(clipId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("clymatte_unregister_active_matte", { clipId });
}

export async function writeClymatteFrames(
  request: ClymatteWriteRequest,
): Promise<ClymatteStatus> {
  if (!isTauriRuntime()) {
    throw new Error("writeClymatteFrames requires Tauri runtime");
  }
  const sanitizedFrames = request.frames.map((f) => ({
    timestampUs: f.timestampUs,
    r8Data: Array.isArray(f.r8Data) ? f.r8Data : Array.from(f.r8Data),
  }));

  return invoke<ClymatteStatus>("clymatte_write_frames", {
    request: {
      ...request,
      frames: sanitizedFrames,
    },
  });
}

export async function bakeClymatteClip(
  request: ClymatteBakeRequest,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("bakeClymatteClip requires Tauri runtime");
  }
  return invoke<string>("clymatte_bake_clip", { request });
}

export async function cancelClymatteBake(clipId: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("clymatte_cancel_bake", { clipId });
}

export async function onClymatteProgress(
  callback: (payload: ClymatteProgressPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<ClymatteProgressPayload>("clymatte-progress", (event) => {
    callback(event.payload);
  });
}
