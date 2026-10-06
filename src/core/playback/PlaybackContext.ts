import type { PlaybackState } from "./PlaybackClock";

export type PlaybackContextType = "source" | "program";

export interface PlaybackContextStateSnapshot {
  time: number;
  state: PlaybackState;
  duration: number;
  speed: number;
}

export type PlaybackContextListener = (state: PlaybackContextStateSnapshot) => void;

export interface PlaybackContext {
  readonly type: PlaybackContextType;

  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setSpeed(speed: number): void;

  getTime(): number;
  getDuration(): number;
  getState(): PlaybackState;
  getSpeed(): number;
  getSnapshot(): PlaybackContextStateSnapshot;

  subscribe(listener: PlaybackContextListener): () => void;
  dispose(): void;
}
