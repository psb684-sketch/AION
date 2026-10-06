import { useEffect } from "react";
import { usePlaybackClock, usePlaybackControls } from "./usePlaybackClock";
import { useProjectStore } from "../store/projectStore";

/**
 * Legacy usePlayback hook - now wraps the new PlaybackClock.
 * This maintains backward compatibility while using the new architecture.
 *
 * @deprecated Consider using usePlaybackClock() and usePlaybackControls() directly.
 */
export const usePlayback = () => {
  const clockState = usePlaybackClock();
  const controls = usePlaybackControls();
  const projectFrameRate = useProjectStore((s) => s.project?.frameRate);

  // Sync project framerate to clock
  useEffect(() => {
    if (projectFrameRate && clockState.frameRate !== projectFrameRate) {
      controls.setFrameRate(projectFrameRate);
    }
  }, [projectFrameRate, clockState.frameRate, controls]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return {
    isPlaying: clockState.state === "playing",
    currentTime: clockState.time,
    duration: clockState.duration,
    frameRate: clockState.frameRate,
    playbackSpeed: clockState.speed,
    play: controls.play,
    pause: controls.pause,
    stop: controls.stop,
    seek: controls.seek,
    setDuration: controls.setDuration,
    setPlaybackSpeed: controls.setSpeed,
    formatTime,
  };
};
