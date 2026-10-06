/**
 * Bounded scheduler for time-dependent text preparation.
 *
 * Text animation can produce a different raster key on every playback tick.
 * A normal promise cache only deduplicates identical keys; it does not stop
 * old, already-started preparations from piling up behind the visible frame.
 * This scheduler intentionally has one active task and one latest pending
 * task. A newer request replaces an older pending request before any work is
 * started. The render loop can therefore keep presenting the last complete
 * asset while preparation catches up.
 */
export class LatestTextPreparationScheduler<T> {
  private active: { key: string; input: T } | null = null;
  private pending: { key: string; input: T } | null = null;
  private disposed = false;
  private nextEligibleAt = 0;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly run: (input: T) => Promise<void>,
    private readonly onError: (error: unknown, input: T) => void = () => undefined,
    /**
     * Time to leave between completed background jobs. This bounds CPU/GPU
     * pressure when an animated layer produces a new key on every frame,
     * while still retaining only the newest requested revision.
     */
    private readonly options: { cooldownMs?: number } = {},
  ) {}

  enqueue(key: string, input: T): void {
    if (this.disposed) return;
    if (this.active?.key === key || this.pending?.key === key) return;
    this.pending = { key, input };
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private pump(): void {
    if (this.disposed || this.active || !this.pending) return;

    const delayMs = Math.max(0, this.nextEligibleAt - Date.now());
    if (delayMs > 0) {
      if (this.cooldownTimer === null) {
        this.cooldownTimer = setTimeout(() => {
          this.cooldownTimer = null;
          this.pump();
        }, delayMs);
      }
      return;
    }

    const next = this.pending;
    this.pending = null;
    this.active = next;
    void this.run(next.input)
      .catch((error) => this.onError(error, next.input))
      .finally(() => {
        if (this.active === next) this.active = null;
        this.nextEligibleAt =
          Date.now() + Math.max(0, this.options.cooldownMs ?? 0);
        this.pump();
      });
  }
}
