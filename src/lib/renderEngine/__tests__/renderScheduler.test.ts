import { describe, it, expect, beforeEach } from "vitest";
import { RenderScheduler } from "../renderScheduler";
import { Priority, SpatialTier } from "../types";
import type { RenderJob } from "../types";
import { generateId } from "@/lib/utils/id";

function makeJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    jobId: generateId("job"),
    clipId: "clip-1",
    contentHash: "hash-1" as any,
    spatialTier: SpatialTier.L1,
    timestamp: 1.0,
    priority: Priority.Normal,
    epochId: "epoch-1" as any,
    enqueuedAt: performance.now(),
    ...overrides,
  };
}

describe("RenderScheduler — priority queue", () => {
  let scheduler: RenderScheduler;
  beforeEach(() => {
    scheduler = new RenderScheduler();
  });

  it("dequeues Critical before High before Normal", () => {
    scheduler.enqueue(makeJob({ jobId: "n", priority: Priority.Normal }));
    scheduler.enqueue(makeJob({ jobId: "h", priority: Priority.High }));
    scheduler.enqueue(makeJob({ jobId: "c", priority: Priority.Critical }));

    expect(scheduler.dequeue()?.jobId).toBe("c");
    expect(scheduler.dequeue()?.jobId).toBe("h");
    expect(scheduler.dequeue()?.jobId).toBe("n");
  });

  it("deduplicates by jobId", () => {
    scheduler.enqueue(makeJob({ jobId: "dup" }));
    scheduler.enqueue(makeJob({ jobId: "dup" }));
    scheduler.dequeue();
    expect(scheduler.dequeue()).toBeNull();
  });

  it("returns null when empty", () => {
    expect(scheduler.dequeue()).toBeNull();
  });
});

describe("RenderScheduler — cancellation (R18)", () => {
  let scheduler: RenderScheduler;
  beforeEach(() => {
    scheduler = new RenderScheduler();
  });

  it("cancelClip removes all jobs for that clip", () => {
    scheduler.enqueue(makeJob({ clipId: "clip-a", jobId: "j1" }));
    scheduler.enqueue(makeJob({ clipId: "clip-a", jobId: "j2" }));
    scheduler.enqueue(makeJob({ clipId: "clip-b", jobId: "j3" }));

    const cancelled = scheduler.cancelClip("clip-a");
    expect(cancelled).toBe(2);
    expect(scheduler.pendingCount()).toBe(1);
    expect(scheduler.dequeue()?.clipId).toBe("clip-b");
  });

  it("cancelInactiveTier removes jobs for that clip + tier only", () => {
    scheduler.enqueue(makeJob({ clipId: "clip-a", spatialTier: SpatialTier.L0, jobId: "j1" }));
    scheduler.enqueue(makeJob({ clipId: "clip-a", spatialTier: SpatialTier.L1, jobId: "j2" }));

    scheduler.cancelInactiveTier("clip-a", SpatialTier.L0);
    expect(scheduler.pendingCount()).toBe(1);
    expect(scheduler.dequeue()?.spatialTier).toBe(SpatialTier.L1);
  });

  it("cancel with predicate removes matching jobs", () => {
    scheduler.enqueue(makeJob({ jobId: "j1", priority: Priority.Normal }));
    scheduler.enqueue(makeJob({ jobId: "j2", priority: Priority.Critical }));

    scheduler.cancel((j) => j.priority === Priority.Normal);
    expect(scheduler.pendingCount()).toBe(1);
  });
});

describe("RenderScheduler — suspension", () => {
  it("enqueue is no-op when suspended", () => {
    const scheduler = new RenderScheduler();
    scheduler.suspend();
    scheduler.enqueue(makeJob());
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("dequeue returns null when suspended", () => {
    const scheduler = new RenderScheduler();
    scheduler.enqueue(makeJob());
    scheduler.suspend();
    expect(scheduler.dequeue()).toBeNull();
  });

  it("resumes correctly", () => {
    const scheduler = new RenderScheduler();
    scheduler.suspend();
    scheduler.resume();
    scheduler.enqueue(makeJob());
    expect(scheduler.pendingCount()).toBe(1);
  });
});
