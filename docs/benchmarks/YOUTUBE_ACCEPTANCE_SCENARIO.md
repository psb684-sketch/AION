# Clypra YouTube Demonstration & Acceptance Scenario

## Production Recording Script with Timestamp Context

This document provides the canonical production demonstration script for recording the comprehensive Clypra YouTube showcase. 

**Core Principle**: The YouTube recording is not merely marketing material; it is a **public demonstration of a system that has already passed its private production rehearsal**. Every timestamp represents a concrete acceptance milestone verified against live performance telemetry.

---

## Live Performance HUD (Developer Overlay)

During test rehearsals (and optionally toggled during the demonstration), verify that the Clypra Diagnostics Overlay reflects green metrics:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLYPRA PERFORMANCE HUD                          │
├──────────────────────────┬───────────┬───────────────────┬─────────────┤
│ Preview FPS              │ 59.8 FPS  │ Target: ≥ 58.0    │ [ PASS ]    │
│ Total Frame Time         │ 13.8 ms   │ Budget: ≤ 16.7 ms │ [ PASS ]    │
│ Hardware Video Decode    │ 2.6 ms    │ NV12 Cache: Hit   │ [ PASS ]    │
│ WGPU Multi-Track Pass    │ 3.4 ms    │ 24-Track Capable  │ [ PASS ]    │
│ SDF Vector Text Pass     │ 1.8 ms    │ Glyph Fallback: OK│ [ PASS ]    │
│ GPU Shutter Motion Blur  │ 2.9 ms    │ Samples: 16       │ [ PASS ]    │
│ Resident RAM (RSS)       │ 1.42 GB   │ Leak Ceiling: 1.8G│ [ PASS ]    │
│ Export RTF (4K HEVC)     │ 2.45x     │ Min Target: 2.0x  │ [ PASS ]    │
└──────────────────────────┴───────────┴───────────────────┴─────────────┘
```

---

## Chronological Script & Acceptance Milestones

### `00:00 - 00:45` — Cold Launch & Diagnostics Telemetry Activation
* **On-Screen Action**:
  1. Launch Clypra from cold OS state.
  2. Open Developer Tools / Diagnostics HUD (`Alt + D` or `Help → Diagnostics`).
  3. Show instantaneous window readiness and swapchain initialization.
* **Demonstrated Capabilities**:
  - Zero-delay native surface swapchain prewarm (`~2 ms`).
  - Statically linked TLS and safe auto-recovery initialization.
* **Acceptance Checkpoint**:
  - `render-session-created` \(\le 30\) ms.
  - No dropped frames on initial window presentation.

---

### `00:45 - 01:30` — Multi-Format Media Ingestion
* **On-Screen Action**:
  1. Drag and drop a diverse media folder into the Media Library:
     - 4K 30fps HEVC MP4
     - 1080p 60fps H.264 MOV
     - 1080x1920 30fps Vertical Smartphone Video
     - 720p AV1 WebM
     - Stereo 48kHz Music Track + Mono WAV Voiceover
  2. Demonstrate instant poster frame and waveform extraction without UI blocking.
* **Demonstrated Capabilities**:
  - Multi-threaded hardware probe (`libavformat` `AVDISCARD_ALL` filtering).
  - CLI FFmpeg (`libdav1d`) fallback for AV1 thumbnails.
  - Self-healing media cards (zero stuck gray thumbnails).
* **Acceptance Checkpoint**:
  - Thumbnail generation \(\le 180\) ms per asset.
  - Waveform LOD worker round-trip \(\le 45\) ms.

---

### `01:30 - 02:45` — High-Velocity Timeline Editing
* **On-Screen Action**:
  1. Place primary 4K footage on Track 1 and secondary 1080p on Track 2.
  2. Perform rapid razor splits with `Cmd + B` / `Ctrl + B`.
  3. Trim heads and tails with ripple edit (`Q` / `W`).
  4. Ripple delete gaps and nudge clips using physical keyboard shortcuts.
  5. Demonstrate lock-free editing: perform cuts and trims **while the timeline is actively playing at 60 FPS**.
* **Demonstrated Capabilities**:
  - Cross-OS shortcut parity (`Cmd` vs `Ctrl`) and international physical layout support (`e.code`).
  - Lock-free double-buffered project snapshots (`parking_lot::RwLock<Arc<FrameRequest>>`).
  - Audio and video clocks maintain sub-millisecond sync during active mutation.
* **Acceptance Checkpoint**:
  - Timeline mutation latency (`recordTimelineEdit`) \(\le 6\) ms.
  - Zero audio clicks, pops, or transport pauses during splits.

---

### `02:45 - 04:00` — Multi-Track Audio Engine & Rubber Bands
* **On-Screen Action**:
  1. Add background music to Track 3 and voiceover to Track 4.
  2. Demonstrate J/L cut audio unlinking (`UnlinkAudioCommand`).
  3. Click to create volume rubber band nodes on the audio envelope.
  4. Drag nodes to shape cubic Bézier ducking curves under dialogue.
  5. Toggle track Solo buttons to isolate dialogue and music.
* **Demonstrated Capabilities**:
  - First-class native audio mixer with atomic IPC synchronization (`replaceNativeAudioClips`).
  - Non-destructive volume envelopes with cubic curve interpolation.
  - Pitch preservation under playback rate adjustments.
* **Acceptance Checkpoint**:
  - Audio buffer latency \(\le 20\) ms.
  - Zero A/V drift accumulation over extended scrub.

---

### `04:00 - 05:15` — Native Vector Text Engine & Typography
* **On-Screen Action**:
  1. Add a Plain Text clip on Track 5.
  2. Type long multiline copy; change fonts (Inter Variable, Oswald, Montserrat).
  3. Adjust letter-spacing, line-height, text transforms (`uppercase`, `capitalize`).
  4. Add colored outlines and soft drop shadows in the Inspector.
  5. Zoom preview to 400% to demonstrate crisp, resolution-independent vector rendering.
* **Demonstrated Capabilities**:
  - Native Signed Distance Field (SDF) WGSL shader pipeline.
  - Bundled WOFF2 font registry with automatic Noto Emoji fallback.
  - Synchronous fast-path text transforms eliminating raster bridge bottlenecks.
* **Acceptance Checkpoint**:
  - Text editing input latency \(\le 8\) ms.
  - Vector SDF shader composition \(\le 2.0\) ms.

---

### `05:15 - 06:30` — Kinetic Text Effects & Spring Physics
* **On-Screen Action**:
  1. Apply a Kinetic Text Effect to an action title.
  2. Open the Ease Curve Inspector: switch from Linear to `speedHero` preset.
  3. Demonstrate physical spring dynamics: adjust `stiffness`, `damping`, and `mass`.
  4. Trigger playback to show realistic, organic overshoot and bounce.
  5. Show responsive time anchoring: trim the clip shorter; show intro/outro animations adapting dynamically without collision.
* **Demonstrated Capabilities**:
  - Analytical damped harmonic oscillator solver in \(O(1)\) time.
  - Custom cubic Bézier Newton-Raphson tangent solver.
  - Responsive intro/outro time anchoring (`timeAnchor: "start"` / `"end"`).
* **Acceptance Checkpoint**:
  - Animation evaluation (`evaluateTimelineScene`) \(\le 0.8\) ms.
  - Elastic compression guard maintains valid keyframe order.

---

### `06:30 - 07:45` — Text Templates & Compound Reusable Components
* **On-Screen Action**:
  1. Open Text Templates drawer; drag a broadcast lower-third template onto the timeline.
  2. Edit template control fields (Name, Subtitle, Accent Color) in the Inspector.
  3. Show real-time updates across all nested layers simultaneously.
  4. Create a compound clip from multiple elements and save as a custom template.
* **Demonstrated Capabilities**:
  - Native text template instantiation with contract v2 document snapshots.
  - Background template rasterizer worker execution (`templateRasterizerWorkerClient`).
* **Acceptance Checkpoint**:
  - Template parameter propagation \(\le 12\) ms.
  - Zero memory growth on repeated template instantiation.

---

### `07:45 - 09:00` — Static & Animated Lottie Stickers
* **On-Screen Action**:
  1. Add an animated Lottie sticker (e.g. Subscribe button or emoji).
  2. Scale, rotate, and reposition the sticker using on-canvas transform gizmos.
  3. Set speed to 1.5x and enable seamless looping.
  4. Layer multiple stickers with overlapping blend modes.
* **Demonstrated Capabilities**:
  - Web Worker Lottie vector frame rasterization.
  - GPU quad transform caching and alpha blending.
* **Acceptance Checkpoint**:
  - Sticker decode and composition \(\le 1.2\) ms.
  - Zero frame drops on multi-layer sticker playback.

---

### `09:00 - 10:15` — Spatial Motion Paths & Direction-Aware Shutter Blur
* **On-Screen Action**:
  1. Select an overlay clip; enable "Show Motion Path".
  2. Add multi-point position keyframes across the screen.
  3. Drag on-canvas diamond nodes and adjust curvature using blue/orange Bézier tangent handles.
  4. Enable "Cinematic Motion Blur" in the Inspector.
  5. Set shutter angle to `180°` and quality to 16 samples.
  6. Scrub through the curve to reveal authentic directional motion blur aligned with velocity vectors.
* **Demonstrated Capabilities**:
  - Centripetal Catmull-Rom auto-tangent computation.
  - Dedicated WGSL velocity compute shader.
  - Inline timeline keyframe lane with diamond indicators and ease inspectors.
* **Acceptance Checkpoint**:
  - Motion blur pass execution \(\le 3.0\) ms.
  - Smooth 60 FPS playback with active blur accumulation.

---

### `10:15 - 11:15` — 60 FPS Program Preview Scrubbing & Seeking
* **On-Screen Action**:
  1. Click rapidly across distant timeline markers (cold seek jumps).
  2. Show instantaneous coarse keyframe display (<20 ms) followed by 60ms fine settlement.
  3. Scrub the playhead back and forth across all 7 active tracks at high speed.
  4. Step single frames forward and backward with arrow keys.
* **Demonstrated Capabilities**:
  - Two-stage coarse-to-fine seeking pipeline with quarter proxy fast-path.
  - Keyframe-approx fast-path with DPB packet draining optimization.
  - Zero cache contamination between approximate and exact frames.
* **Acceptance Checkpoint**:
  - Cold seek keyframe presentation \(\le 18\) ms.
  - Warm scrub frame latency \(\le 12\) ms (\(\ge 60\) FPS).

---

### `11:15 - 12:00` — Hardware Export & Bitstream Verification
* **On-Screen Action**:
  1. Open Export Dialog (`Cmd + E` / `Ctrl + E`).
  2. Select `4K (3840x2160)`, `HEVC / H.265`, `Hardware Accelerated`, `Rec.709`.
  3. Start export: show progress bar, elapsed time, and Real-Time Factor (RTF) gauge (>2.0x).
  4. Open terminal / verify script: run `ffprobe` to validate the generated file.
  5. Play back the finished export in QuickTime / VLC to demonstrate perfect A/V sync.
* **Demonstrated Capabilities**:
  - Direct zero-copy GPU render-to-encoder pipeline (VideoToolbox / NVENC / AMF).
  - Accurate Rec.709 colorimetry container tagging.
  - Programmatic bitstream validation.
* **Acceptance Checkpoint**:
  - Export completion with zero errors (RTF \(\ge 2.0x\)).
  - Bitstream matches duration within \(\pm 1\) frame with sub-10ms A/V sync.

---

## Verification Sign-Off

Upon completing this scenario:
1. Export the active session telemetry log: `window.__clypra_diagnostics.workerPerf.getSummary()`.
2. Attach the final `RC1_SCORECARD.md` to the release candidate artifacts.
3. Certify that all 11 timestamped checkpoints completed with **PASS** status.
