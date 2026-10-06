export interface QualityTier {
  id: string;
  label: string;
  longEdge: number; // target resolution on the longer dimension
}

export const QUALITY_TIERS: QualityTier[] = [
  { id: "720p", label: "720p", longEdge: 1280 },
  { id: "1080p", label: "1080p", longEdge: 1920 },
  { id: "4k", label: "4K", longEdge: 3840 },
];

/**
 * Computes actual export dimensions from the project's real aspect ratio and a
 * quality tier's target long-edge resolution. Preserves aspect ratio exactly —
 * a 9:16 project at the "1080p" tier exports at 1080x1920, not 1920x1080.
 *
 * Dimensions are rounded to even numbers — required for H.264/H.265 YUV 4:2:0
 * chroma subsampling; odd dimensions will fail or corrupt encoding in FFmpeg.
 */
export function resolveExportDimensions(
  projectWidth: number,
  projectHeight: number,
  tier: QualityTier,
): { width: number; height: number } {
  const aspectRatio = projectWidth / projectHeight;
  const isPortrait = projectHeight > projectWidth;

  const toEven = (n: number) => Math.round(n / 2) * 2;

  if (isPortrait) {
    const height = tier.longEdge;
    const width = toEven(height * aspectRatio);
    return { width, height: toEven(height) };
  } else {
    const width = tier.longEdge;
    const height = toEven(width / aspectRatio);
    return { width: toEven(width), height };
  }
}
