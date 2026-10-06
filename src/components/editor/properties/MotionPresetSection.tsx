/**
 * Motion Preset & Kinetic Behavior Inspector Section.
 *
 * Provides one-click Build-In, Build-Out, and Continuous Loop animation controls
 * for visual clips (video, image, text, shapes, stickers).
 */

import React, { useState, useCallback } from "react";
import {
  Sparkles,
  Zap,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  FastForward,
  Minimize2,
  Download,
  Waves,
  Heart,
  Shuffle,
  Compass,
  Ban,
  Clock,
  Gauge,
} from "lucide-react";
import type { Clip } from "@/types";
import type { ClipMotionConfig, MotionBehaviorCategory, MotionPresetMeta } from "@/types/motion";
import {
  MOTION_IN_PRESETS,
  MOTION_OUT_PRESETS,
  MOTION_LOOP_PRESETS,
  compileClipMotionKeyframes,
} from "@/core/animation/motionPresets";
import { PropertySection } from "./primitives/PropertySection";
import { PropertySlider } from "./primitives/PropertySlider";

interface MotionPresetSectionProps {
  selectedClip: Clip;
  handleUpdateMultiple: (fields: Record<string, any>) => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Zap,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  FastForward,
  Minimize2,
  Download,
  Waves,
  Heart,
  Shuffle,
  Compass,
};

export const MotionPresetSection: React.FC<MotionPresetSectionProps> = ({
  selectedClip,
  handleUpdateMultiple,
  canvasWidth = 1920,
  canvasHeight = 1080,
}) => {
  const [activeTab, setActiveTab] = useState<MotionBehaviorCategory>("in");

  const motion: ClipMotionConfig = selectedClip.motion ?? {};
  const hasIn = Boolean(motion.inPreset && motion.inPreset !== "none");
  const hasOut = Boolean(motion.outPreset && motion.outPreset !== "none");
  const hasLoop = Boolean(motion.loopPreset && motion.loopPreset !== "none");

  const updateMotion = useCallback(
    (updates: Partial<ClipMotionConfig>) => {
      const nextMotion: ClipMotionConfig = {
        ...motion,
        ...updates,
      };

      const compiledKeyframes = compileClipMotionKeyframes(
        selectedClip,
        nextMotion,
        canvasWidth,
        canvasHeight
      );

      handleUpdateMultiple({
        motion: nextMotion,
        visualKeyframes: compiledKeyframes,
      });
    },
    [motion, selectedClip, canvasWidth, canvasHeight, handleUpdateMultiple]
  );

  const renderPresetGrid = (
    presets: MotionPresetMeta[],
    selectedId: string | undefined,
    onSelect: (id: string) => void
  ) => {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {/* None / Reset Card */}
        <button
          type="button"
          onClick={() => onSelect("none")}
          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
            !selectedId || selectedId === "none"
              ? "bg-accent/15 border-accent text-accent shadow-xs"
              : "bg-surface/50 border-border/40 text-text-muted hover:border-border hover:text-text-primary hover:bg-surface"
          }`}
        >
          <Ban className="w-4 h-4 mb-1 opacity-70" />
          <span className="text-[10px] font-medium leading-tight">None</span>
        </button>

        {presets.map((preset) => {
          const IconComp = ICON_MAP[preset.icon] || Sparkles;
          const isSelected = selectedId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              title={preset.description}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer relative group ${
                isSelected
                  ? "bg-accent/15 border-accent text-accent shadow-xs"
                  : "bg-surface/50 border-border/40 text-text-muted hover:border-border hover:text-text-primary hover:bg-surface"
              }`}
            >
              <IconComp className={`w-4 h-4 mb-1 transition-transform group-hover:scale-110 ${isSelected ? "text-accent" : "text-text-primary"}`} />
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <PropertySection
      title="Motion & Animation"
      icon={<Sparkles className="w-3.5 h-3.5" />}
      defaultCollapsed={false}
      action={
        (hasIn || hasOut || hasLoop) ? (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        ) : undefined
      }
    >
      {/* Category Tabs: In, Out, Loop */}
      <div className="flex bg-surface-base/80 p-0.5 rounded-lg border border-border/40">
        <button
          type="button"
          onClick={() => setActiveTab("in")}
          className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === "in"
              ? "bg-surface-raised text-accent shadow-xs"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {hasIn && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
          In (Build-In)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("out")}
          className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === "out"
              ? "bg-surface-raised text-accent shadow-xs"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {hasOut && <span className="w-1 h-1 rounded-full bg-amber-400" />}
          Out (Build-Out)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("loop")}
          className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === "loop"
              ? "bg-surface-raised text-accent shadow-xs"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          {hasLoop && <span className="w-1 h-1 rounded-full bg-purple-400" />}
          Loop
        </button>
      </div>

      {/* Tab Content: IN */}
      {activeTab === "in" && (
        <div className="space-y-3 pt-1">
          {renderPresetGrid(MOTION_IN_PRESETS, motion.inPreset, (id) =>
            updateMotion({ inPreset: id })
          )}

          {hasIn && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <PropertySlider
                label="Duration"
                value={motion.inDuration ?? 0.5}
                min={0.1}
                max={Math.min(2.0, selectedClip.duration)}
                step={0.05}
                suffix="s"
                decimals={2}
                icon={<Clock className="w-3 h-3 text-text-muted" />}
                onChange={(val) => updateMotion({ inDuration: val })}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: OUT */}
      {activeTab === "out" && (
        <div className="space-y-3 pt-1">
          {renderPresetGrid(MOTION_OUT_PRESETS, motion.outPreset, (id) =>
            updateMotion({ outPreset: id })
          )}

          {hasOut && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <PropertySlider
                label="Duration"
                value={motion.outDuration ?? 0.5}
                min={0.1}
                max={Math.min(2.0, selectedClip.duration)}
                step={0.05}
                suffix="s"
                decimals={2}
                icon={<Clock className="w-3 h-3 text-text-muted" />}
                onChange={(val) => updateMotion({ outDuration: val })}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: LOOP */}
      {activeTab === "loop" && (
        <div className="space-y-3 pt-1">
          {renderPresetGrid(MOTION_LOOP_PRESETS, motion.loopPreset, (id) =>
            updateMotion({ loopPreset: id })
          )}

          {hasLoop && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <PropertySlider
                label="Speed"
                value={motion.loopSpeed ?? 1.0}
                min={0.2}
                max={3.0}
                step={0.1}
                suffix="x"
                decimals={1}
                icon={<Gauge className="w-3 h-3 text-text-muted" />}
                onChange={(val) => updateMotion({ loopSpeed: val })}
              />

              <PropertySlider
                label="Intensity"
                value={motion.loopIntensity ?? 1.0}
                min={0.2}
                max={2.5}
                step={0.1}
                decimals={1}
                icon={<Activity className="w-3 h-3 text-text-muted" />}
                onChange={(val) => updateMotion({ loopIntensity: val })}
              />
            </div>
          )}
        </div>
      )}
    </PropertySection>
  );
};
