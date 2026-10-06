import { create } from "zustand";
import { onClymatteProgress, type ClymatteProgressPayload } from "./clymatteClient";

interface ClymatteBakeState {
  bakingClips: Record<string, { progress: number; stage: string }>;
  bakedClips: Record<string, boolean>;
  setBakeProgress: (clipId: string, progress: number, stage: string) => void;
  setBakeComplete: (clipId: string) => void;
  setBakeError: (clipId: string) => void;
  initProgressListener: () => () => void;
}

let unlisten: (() => void) | null = null;

export const useClymatteStore = create<ClymatteBakeState>((set, get) => ({
  bakingClips: {},
  bakedClips: {},
  setBakeProgress: (clipId, progress, stage) =>
    set((state) => ({
      bakingClips: {
        ...state.bakingClips,
        [clipId]: { progress, stage },
      },
    })),
  setBakeComplete: (clipId) =>
    set((state) => {
      const nextBaking = { ...state.bakingClips };
      delete nextBaking[clipId];
      return {
        bakingClips: nextBaking,
        bakedClips: { ...state.bakedClips, [clipId]: true },
      };
    }),
  setBakeError: (clipId) =>
    set((state) => {
      const nextBaking = { ...state.bakingClips };
      delete nextBaking[clipId];
      return { bakingClips: nextBaking };
    }),
  initProgressListener: () => {
    if (unlisten) return unlisten;

    let active = true;
    onClymatteProgress((payload: ClymatteProgressPayload) => {
      if (!active) return;
      if (payload.stage === "complete" || payload.progress >= 1.0) {
        get().setBakeComplete(payload.clipId);
      } else {
        get().setBakeProgress(payload.clipId, payload.progress, payload.stage);
      }
    }).then((unsub) => {
      unlisten = () => {
        active = false;
        unsub();
        unlisten = null;
      };
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  },
}));
