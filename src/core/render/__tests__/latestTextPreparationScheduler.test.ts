import { afterEach, describe, expect, it, vi } from "vitest";
import { LatestTextPreparationScheduler } from "../latestTextPreparationScheduler";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("LatestTextPreparationScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps one active task and replaces stale pending work", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const started: string[] = [];
    const scheduler = new LatestTextPreparationScheduler<{ key: string }>(async ({ key }) => {
      started.push(key);
      if (key === "a") await first.promise;
      if (key === "c") await second.promise;
    });

    scheduler.enqueue("a", { key: "a" });
    scheduler.enqueue("b", { key: "b" });
    scheduler.enqueue("c", { key: "c" });
    expect(started).toEqual(["a"]);

    first.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(["a", "c"]);

    second.resolve();
    await Promise.resolve();
    scheduler.dispose();
  });

  it("does not start duplicate active or pending keys", async () => {
    const gate = deferred<void>();
    const started: string[] = [];
    const scheduler = new LatestTextPreparationScheduler<{ key: string }>(async ({ key }) => {
      started.push(key);
      await gate.promise;
    });

    scheduler.enqueue("a", { key: "a" });
    scheduler.enqueue("a", { key: "a" });
    scheduler.enqueue("b", { key: "b" });
    scheduler.enqueue("b", { key: "b" });
    expect(started).toEqual(["a"]);

    gate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(["a", "b"]);
    scheduler.dispose();
  });

  it("keeps only the newest revision during a playback cooldown", async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    const scheduler = new LatestTextPreparationScheduler<{ key: string }>(
      async ({ key }) => {
        started.push(key);
      },
      undefined,
      { cooldownMs: 100 },
    );

    scheduler.enqueue("first", { key: "first" });
    await vi.runAllTicks();
    expect(started).toEqual(["first"]);

    scheduler.enqueue("stale", { key: "stale" });
    scheduler.enqueue("latest", { key: "latest" });
    await vi.advanceTimersByTimeAsync(99);
    expect(started).toEqual(["first"]);

    await vi.advanceTimersByTimeAsync(1);
    expect(started).toEqual(["first", "latest"]);
    scheduler.dispose();
  });
});
