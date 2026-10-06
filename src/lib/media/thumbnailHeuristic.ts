/**
 * Professional thumbnail seek-time heuristic.
 *
 * Problem: frame 0 / first GOP / exact start often produces black frames,
 * color-bars, or intro titles that don't represent actual video content.
 *
 * Strategy:
 * - Seek 15 % into the video (sweet spot between "avoid start" and "still early")
 * - Floor at 1.0 s (never seek into the first GOP / black-frame zone)
 * - Cap at 30.0 s (long intros exist, but users want quick visual confirmation)
 *
 * Formula:
 *   thumbnailTime = clamp(duration * 0.15, 1.0, 30.0)
 *
 * Examples:
 *   5 s   -> 1.0 s  (floor)
 *   20 s  -> 3.0 s
 *   2 min -> 18.0 s
 *   1 hr  -> 30.0 s (cap)
 */
export function computeThumbnailSeekTime(durationSeconds: number): number {
  return Math.min(Math.max(durationSeconds * 0.15, 1.0), 30.0);
}
