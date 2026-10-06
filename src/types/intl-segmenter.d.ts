declare global {
  namespace Intl {
    interface SegmenterOptions {
      granularity?: "grapheme" | "word" | "sentence";
      localeMatcher?: "lookup" | "best fit";
    }
    interface SegmentData {
      segment: string;
      index: number;
      input: string;
      isWordLike?: boolean;
    }
    class Segmenter {
      constructor(locale?: string | string[], options?: SegmenterOptions);
      segment(input: string): Iterable<SegmentData>;
      resolvedOptions(): SegmenterOptions;
    }
  }
}
export {};
