import { describe, expect, it, vi } from "vitest";
import { SeekController, qualityForScrubVelocity } from "../seekController";

describe("SeekController", () => {
  it("assigns monotonically increasing generations and notifies listeners", () => {
    const controller = new SeekController();
    const listener = vi.fn();
    controller.subscribe(listener);

    const first = controller.request({ time: 1, mode: "scrub", velocityPxPerSecond: 100 });
    const second = controller.request({ time: 2, mode: "scrub", velocityPxPerSecond: 3_000 });

    expect(second.generation).toBeGreaterThan(first.generation);
    expect(second.quality).toBe("quarter");
    expect(controller.isCurrent(second.generation)).toBe(true);
    expect(controller.isCurrent(first.generation)).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("invalidates external transport interruptions", () => {
    const controller = new SeekController();
    const intent = controller.request({ time: 4, mode: "seek" });
    const generation = controller.invalidate();

    expect(generation).toBe(intent.generation + 1);
    expect(controller.getCurrent()).toBeNull();
    expect(controller.isCurrent(intent.generation)).toBe(false);
  });

  it("maps velocity to adaptive scrub quality", () => {
    expect(qualityForScrubVelocity(0)).toBe("full");
    expect(qualityForScrubVelocity(1_000)).toBe("half");
    expect(qualityForScrubVelocity(-3_000)).toBe("quarter");
  });

  it("sets isScrubbing and allowKeyframeApprox defaults and respects overrides", () => {
    const controller = new SeekController();

    const scrub = controller.request({ time: 1, mode: "scrub", velocityPxPerSecond: 500 });
    expect(scrub.isScrubbing).toBe(true);
    expect(scrub.allowKeyframeApprox).toBe(true);

    // Default mode: "seek" uses coarse-first keyframe approximation
    const seek = controller.request({ time: 2, mode: "seek" });
    expect(seek.isScrubbing).toBe(false);
    expect(seek.allowKeyframeApprox).toBe(true);

    // Explicit override allowKeyframeApprox: false is respected
    const exactSeek = controller.request({
      time: 2,
      mode: "seek",
      allowKeyframeApprox: false,
    });
    expect(exactSeek.isScrubbing).toBe(false);
    expect(exactSeek.allowKeyframeApprox).toBe(false);

    // mode: "frameStep" skips keyframe approx for frame-accurate navigation
    const frameStep = controller.request({ time: 2.033, mode: "frameStep" });
    expect(frameStep.isScrubbing).toBe(false);
    expect(frameStep.allowKeyframeApprox).toBe(false);

    const exactScrub = controller.request({
      time: 3,
      mode: "scrub",
      quality: "full",
      allowKeyframeApprox: false,
    });
    expect(exactScrub.isScrubbing).toBe(true);
    expect(exactScrub.quality).toBe("full");
    expect(exactScrub.allowKeyframeApprox).toBe(false);
  });

  it("schedules debounced fine settling intent after coarse seek", () => {
    vi.useFakeTimers();
    try {
      const controller = new SeekController();
      const listener = vi.fn();
      controller.subscribe(listener);

      const coarseIntent = controller.request({ time: 10, mode: "seek", source: "timeline-click-seek" });
      expect(coarseIntent.allowKeyframeApprox).toBe(true);
      expect(coarseIntent.quality).toBe("quarter");
      expect(coarseIntent.isSettling).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);

      // Fast-forward past debounce window
      vi.advanceTimersByTime(SeekController.SETTLE_DEBOUNCE_MS);

      // Settle intent should have been emitted
      expect(listener).toHaveBeenCalledTimes(2);
      const settleIntent = listener.mock.calls[1][0];
      expect(settleIntent.time).toBe(10);
      expect(settleIntent.allowKeyframeApprox).toBe(false);
      expect(settleIntent.isSettling).toBe(true);
      expect(settleIntent.quality).toBe("full");
      expect(settleIntent.generation).toBeGreaterThan(coarseIntent.generation);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels prior fine settling if another seek arrives before debounce timer", () => {
    vi.useFakeTimers();
    try {
      const controller = new SeekController();
      const listener = vi.fn();
      controller.subscribe(listener);

      controller.request({ time: 5, mode: "seek" });
      expect(listener).toHaveBeenCalledTimes(1);

      // Advance partially (30ms < 60ms)
      vi.advanceTimersByTime(30);

      // Second seek arrives before first settled
      controller.request({ time: 6, mode: "seek" });
      expect(listener).toHaveBeenCalledTimes(2);

      // Advance another 30ms (first seek would have fired at 60ms, but was cancelled)
      vi.advanceTimersByTime(30);
      expect(listener).toHaveBeenCalledTimes(2);

      // Advance remaining 30ms to reach second seek debounce (60ms)
      vi.advanceTimersByTime(30);
      expect(listener).toHaveBeenCalledTimes(3);

      const finalSettleIntent = listener.mock.calls[2][0];
      expect(finalSettleIntent.time).toBe(6);
      expect(finalSettleIntent.isSettling).toBe(true);
      expect(finalSettleIntent.allowKeyframeApprox).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not accept requests after disposal", () => {
    const controller = new SeekController();
    controller.dispose();

    expect(() => controller.request({ time: 0, mode: "seek" })).toThrow(/disposed/i);
    expect(controller.isCurrent(1)).toBe(false);
  });

  it("manages dedicated scrub lifecycle with span tracking and proxy-to-full settle transition", () => {
    const controller = new SeekController();

    const startIntent = controller.beginScrub({ time: 1.5, source: "playhead" });
    expect(startIntent.isScrubbing).toBe(true);
    expect(startIntent.isSettling).toBe(false);
    expect(startIntent.allowKeyframeApprox).toBe(true);
    expect(startIntent.quality).toBe("proxy");
    expect(startIntent.scrubSpanId).toBeDefined();
    expect(controller.getActiveScrubSpanId()).toBe(startIntent.scrubSpanId);

    const updateIntent = controller.updateScrub({ time: 2.0, velocityPxPerSecond: 1500 });
    expect(updateIntent.isScrubbing).toBe(true);
    expect(updateIntent.isSettling).toBe(false);
    expect(updateIntent.quality).toBe("half");
    expect(updateIntent.scrubSpanId).toBe(startIntent.scrubSpanId);

    const endIntent = controller.endScrub({ time: 2.5 });
    expect(endIntent.isScrubbing).toBe(false);
    expect(endIntent.isSettling).toBe(true);
    expect(endIntent.allowKeyframeApprox).toBe(false);
    expect(endIntent.quality).toBe("full");
    expect(endIntent.scrubSpanId).toBe(startIntent.scrubSpanId);
    expect(controller.getActiveScrubSpanId()).toBeNull();
  });
});
