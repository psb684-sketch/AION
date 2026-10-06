import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import lottie from "lottie-web";
import { cn } from "@/lib/utils";

export interface StickerSourcePreviewHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
  goToFrame: (frame: number) => void;
  getAnimation: () => {
    totalFrames: number;
    frameRate: number;
    isLoaded: boolean;
  };
}

interface StickerSourcePreviewProps {
  lottieData: any;
  isPlaying: boolean;
  loop?: boolean;
  speed?: number;
  initialFrame?: number;
  onFrameChange?: (currentFrame: number, totalFrames: number) => void;
  onComplete?: () => void;
  className?: string;
}

export const StickerSourcePreview = forwardRef<StickerSourcePreviewHandle, StickerSourcePreviewProps>(
  (
    {
      lottieData,
      isPlaying,
      loop = true,
      speed = 1,
      initialFrame,
      onFrameChange,
      onComplete,
      className,
    },
    ref
  ) => {
    const lottieContainerRef = useRef<HTMLDivElement | null>(null);
    const animRef = useRef<any>(null);

    const onFrameChangeRef = useRef(onFrameChange);
    const onCompleteRef = useRef(onComplete);

    useEffect(() => {
      onFrameChangeRef.current = onFrameChange;
      onCompleteRef.current = onComplete;
    }, [onFrameChange, onComplete]);

    // Expose control handles
    useImperativeHandle(ref, () => ({
      play: () => {
        if (animRef.current) {
          animRef.current.play();
        }
      },
      pause: () => {
        if (animRef.current) {
          animRef.current.pause();
        }
      },
      stop: () => {
        if (animRef.current) {
          animRef.current.stop();
        }
      },
      goToFrame: (frame: number) => {
        if (animRef.current) {
          animRef.current.goToAndStop(frame, true);
        }
      },
      getAnimation: () => {
        if (animRef.current) {
          return {
            totalFrames: animRef.current.totalFrames,
            frameRate: animRef.current.frameRate,
            isLoaded: true,
          };
        }
        return {
          totalFrames: 0,
          frameRate: 30,
          isLoaded: false,
        };
      },
    }));

    // Initialize Lottie animation
    useEffect(() => {
      if (!lottieData || !lottieContainerRef.current) return;

      const anim = lottie.loadAnimation({
        container: lottieContainerRef.current,
        renderer: "svg",
        loop: loop,
        autoplay: isPlaying,
        animationData: JSON.parse(JSON.stringify(lottieData)),
      });

      animRef.current = anim;
      anim.setSpeed(speed);

      // Listeners
      const onEnterFrame = () => {
        const total = anim.totalFrames;
        const current = anim.currentFrame;
        onFrameChangeRef.current?.(Math.round(current), Math.round(total));
      };
      anim.addEventListener("enterFrame", onEnterFrame);

      const onCompleteLocal = () => {
        onCompleteRef.current?.();
      };
      anim.addEventListener("complete", onCompleteLocal);

      return () => {
        anim.removeEventListener("enterFrame", onEnterFrame);
        anim.removeEventListener("complete", onCompleteLocal);
        anim.destroy();
        animRef.current = null;
      };
    }, [lottieData, loop]);

    // Sync speed changes
    useEffect(() => {
      if (animRef.current) {
        animRef.current.setSpeed(speed);
      }
    }, [speed]);

    // Sync play/pause changes
    useEffect(() => {
      if (animRef.current) {
        if (isPlaying) {
          animRef.current.play();
        } else {
          animRef.current.pause();
        }
      }
    }, [isPlaying]);

    // Sync initial/current frame seeking
    useEffect(() => {
      if (animRef.current && initialFrame !== undefined) {
        animRef.current.goToAndStop(initialFrame, true);
      }
    }, [initialFrame]);

    return (
      <div className={cn("max-w-full max-h-full aspect-square flex items-center justify-center overflow-hidden", className)}>
        <div ref={lottieContainerRef} className="w-full h-full" />
      </div>
    );
  }
);

StickerSourcePreview.displayName = "StickerSourcePreview";
