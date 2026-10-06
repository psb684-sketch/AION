import type { PlaybackContext, PlaybackContextStateSnapshot, PlaybackContextListener } from "./PlaybackContext";
import type { PlaybackClock, PlaybackState } from "./PlaybackClock";
import type { PlaybackClockListener } from "./PlaybackClock";

/**
 * Program Playback Context - Wraps PlaybackClock for timeline (program) playback.
 *
 * Delegates all transport commands to the global PlaybackClock singleton.
 * This is the "program monitor" context in NLE terminology.
 */
export class ProgramPlaybackContext implements PlaybackContext {
  readonly type = "program" as const;
  private clock: PlaybackClock;

  constructor(clock: PlaybackClock) {
    this.clock = clock;
  }

  play(): void {
    this.clock.play();
  }

  pause(): void {
    this.clock.pause();
  }

  stop(): void {
    this.clock.stop();
  }

  seek(time: number): void {
    this.clock.seek(time);
  }

  setSpeed(speed: number): void {
    this.clock.setSpeed(speed);
  }

  getTime(): number {
    return this.clock.time;
  }

  getDuration(): number {
    return this.clock.duration;
  }

  getState(): PlaybackState {
    return this.clock.state;
  }

  getSpeed(): number {
    return this.clock.speed;
  }

  getSnapshot(): PlaybackContextStateSnapshot {
    return this.clock.getState();
  }

  subscribe(listener: PlaybackContextListener): () => void {
    const wrapped: PlaybackClockListener = (state) => {
      listener({
        time: state.time,
        state: state.state,
        duration: state.duration,
        speed: state.speed,
      });
    };
    return this.clock.subscribe(wrapped);
  }

  dispose(): void {
    // Clock is a global singleton managed by ProjectSession - don't dispose here
  }
}
