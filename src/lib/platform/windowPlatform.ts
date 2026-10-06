/** Browser-safe platform check used to reserve macOS traffic-light space. */
export function isMacOSPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|Macintosh/i.test(
    `${navigator.platform} ${navigator.userAgent}`,
  );
}
