# Clypra Release Candidate 1 (RC1) Full-System Benchmark Specification

## 1. Executive Summary

This document defines the mathematical, architectural, and operational release criteria for **Clypra Release Candidate 1 (RC1)**. It establishes an automated benchmark methodology that transforms subjective performance evaluations into a deterministic **100-Point Scoring Model** backed by non-negotiable **Hard Release Gates**.

Before cutting production releases or publishing the end-to-end YouTube product demonstration, candidate builds must execute against the standardized **Golden Project** and achieve:
1. **0 Hard Blocker Violations** (Zero P0 crashes, zero data loss, zero export corruption).
2. **A composite score of \(\ge 99.0 / 100.0\)** across all 5 validation tiers.

---

## 2. The Non-Negotiable Hard Release Gates

A catastrophic failure cannot be averaged away. If any of the following 5 release gates trip, the release candidate is **automatically rejected (FAILED)** regardless of numerical score:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HARD RELEASE GATES                              │
├─────────┬──────────────────────────────────┬───────────────────────────┤
│ Gate A  │ Zero P0 Defects                  │ 0 Crashes / 0 Data Loss   │
│ Gate B  │ Zero Unresolved Critical P1s     │ 0 Broken Core Workflows   │
│ Gate C  │ Benchmark Score Threshold        │ Score ≥ 99.0 / 100.0      │
│ Gate D  │ Zero Resource / Process Leaks    │ 0 Orphan FFmpeg / Workers │
│ Gate E  │ 100% Deterministic Bitstreams    │ Bitstream & A/V Verified  │
└─────────┴──────────────────────────────────┴───────────────────────────┘
```

### Gate Definitions:
* **Gate A (P0 = 0)**: No unhandled panics, segmentation faults, WKWebView crashes, IndexedDB corruption, or unrecoverable application states under heavy editing or transport stress.
* **Gate B (P1 = 0)**: No broken primary editing operations across video, audio, text (plain, effects, templates), and stickers.
* **Gate C (Score \(\ge 99.0\))**: The weighted evaluation across all 8 measured categories must meet or exceed 99.0 out of 100.0 points.
* **Gate D (Resource Leaks = 0)**: After a 60-minute soak run, resident memory (RSS) must plateau without unbounded growth, GPU VRAM allocations must cycle cleanly, and zero orphaned background processes (`ffmpeg`, Web Workers) may remain alive after session teardown.
* **Gate E (Deterministic Exports = 100%)**: Exporting the Golden Project must produce bitstream-compliant MP4/MOV containers matching timeline duration (\(\pm 1\) frame), 48 kHz stereo audio, zero dropped frames, and sub-10ms A/V sync drift.

---

## 3. Weighted 100-Point Scoring System

The composite benchmark score is distributed across 8 categories totaling 100 points:

| Category | Weight | Target Metric / Acceptance Criteria | Deductions |
| :--- | :---: | :--- | :--- |
| **1. Functional Correctness** | **25 pts** | 100% pass across all 14 core functional capabilities (Import, Trim, Split, Move, Delete, Undo, Redo, Video, Audio, Plain Text, Text Effects, Text Templates, Stickers, Export). | -2.0 pts per functional failure (release blocker if critical). |
| **2. Timeline Interaction** | **15 pts** | Selection \(\le 16\) ms, Clip Drag \(\le 16\) ms, Playhead Seek \(\le 16\) ms, Zoom \(\ge 58\) FPS, Scrubbing \(\ge 58\) FPS, Panel Mount \(\le 100\) ms. | -1.5 pts per latency breach exceeding 16.67 ms. |
| **3. Preview & Rendering** | **20 pts** | 60 FPS Program Preview under 5 concurrent layers (4K HEVC + Text + Effect + Template + Sticker). Target frame budget \(\le 16.67\) ms with zero dropped frames. | -2.0 pts per dropped frame in steady-state; -1.0 pt per 2ms budget breach. |
| **4. Media Pipeline & Conformance** | **10 pts** | Full codec coverage (H.264, HEVC, AV1, MP4, MOV, WebM). Mixed framerates (24, 30, 60 FPS) and mixed resolutions (4K, 1080p, 9:16 vertical) seamlessly normalized on the canvas. | -2.0 pts per unsupported format or aspect ratio distortion. |
| **5. Export Bitstream Validation** | **10 pts** | Verified via `ffprobe`: Exact duration, correct container tags (Rec.709/BT.2020), 48 kHz stereo audio, zero corrupt packets, Real-Time Factor (RTF) \(\ge 2.0x\). | -5.0 pts if RTF < 1.5x; -10.0 pts if bitstream invalid. |
| **6. Soak & Memory Stability** | **10 pts** | 60-minute playback and continuous mutation soak test. Peak RSS memory \(\le 1.8\) GB; zero heap/texture leakage; zero orphan processes. | -3.0 pts per 200 MB memory creep above baseline; -5.0 pts for leaks. |
| **7. Recovery & Persistence** | **5 pts** | Project state round-trip fidelity: 100% identical rehydration of tracks, clips, keyframes, audio rubber bands, templates, and markers across simulated crash / reload. | -2.5 pts per lost attribute or hydration anomaly. |
| **8. UI Responsiveness** | **5 pts** | Main thread responsiveness during heavy background worker execution (`WorkerPerfCollector` budget breaches = 0; task queues clear in \(\le 100\) ms). | -1.0 pt per worker stall or UI freeze. |
| **Total Score** | **100 pts** | **Passing Score: \(\ge 99.0 / 100.0\)** | **Target: 100 / 100** |

---

## 4. The Golden Project Specification

The Golden Project is a standardized, deliberately complex 2-minute (120-second) YouTube-style production timeline that exercises every subsystem simultaneously.

```
00:00 ─────────────────────────────────────────────── 02:00 (120s)
├── Track 1: Primary Video (A-Roll) ── 4K HEVC (3840x2160 @ 30fps) with cuts & trims
├── Track 2: B-Roll & Screen Video ── 1080p 60fps & 9:16 Vertical Overlays
├── Track 3: Audio Bed & Dialogue  ── Stereo 48kHz Music + Mono Voiceover + Rubber Bands
├── Track 4: Plain Text & Titles   ── SDF Vector Text, WOFF2 Fonts, Outlines & Dropshadows
├── Track 5: Kinetic Text Effects  ── Speed Curves (speedHero), Cubic Bézier Easings
├── Track 6: Text Templates        ── Compound Multi-Layer Text Templates with Dynamic Fonts
└── Track 7: Animated Stickers     ── Lottie Vector Animations, Scale/Rotate Keyframes, Blur
```

### Timeline Composition Structure:
1. **Intro Section (`00:00 - 00:30`)**:
   - 4K 30fps HEVC camera footage.
   - Animated Title with cubic Bézier entrance animation (`easeOutBack`).
   - Lottie vector sticker with rotational spring physics (`bouncy` preset).
   - Audio bed fading in with logarithmic curve.
2. **Main Section (`00:30 - 01:15`)**:
   - 1080p 60fps screen recording overlaid on primary 4K footage.
   - Vertical (9:16) picture-in-picture demonstration.
   - Concurrent voiceover and ducked background music with interactive rubber band envelope.
   - Plain text typography highlighting product features.
3. **Deep Dive / Explanation (`01:15 - 01:45`)**:
   - High-energy text effect using kinetic speed curve (`speedHero`).
   - Reusable Text Template instantiation with dynamic runtime parameter bindings.
   - Direction-aware GPU shutter motion blur (`shutterAngle: 180°`, `samples: 16`).
   - Spatial 2D Bézier motion trajectory with interactive on-canvas handles.
4. **Outro Section (`01:45 - 02:00`)**:
   - 720p AV1 end-card clip.
   - Responsive time-anchored outro keyframes (`timeAnchor: "end"`).
   - Coordinated audio fade-out across voice and music tracks.

---

## 5. Level 3 Frame Budget Allocation (Preview @ 60 FPS)

During simultaneous playback of all 7 tracks, the compositor must present frames within a strict **16.67 ms** display deadline:

```
TARGET FRAME BUDGET: 16.67 ms (60 FPS)
┌──────────────────────────────────────────────┬──────────┐
│ Subsystem Stage                              │ Budget   │
├──────────────────────────────────────────────┼──────────┤
│ Hardware Video Decode & NV12 Cache Fetch     │ 3.0 ms   │
│ WGPU Multi-Track Composition Pass            │ 4.0 ms   │
│ SDF Native Vector Text Shading               │ 2.0 ms   │
│ Post-Processing Video & Motion Blur Effects  │ 3.0 ms   │
│ Lottie / Sticker Rasterization & Blending    │ 1.0 ms   │
│ Swapchain Presentation & WindowServer Commit │ 1.0 ms   │
│ Safety Headroom Margin                       │ 2.67 ms  │
├──────────────────────────────────────────────┼──────────┤
│ Total Execution Window                       │ 14.0 ms  │
└──────────────────────────────────────────────┴──────────┘
```

If total frame render time exceeds **16.67 ms**, the frame is flagged as a budget anomaly. If a display V-Sync tick is skipped, it is logged as a dropped frame.

---

## 6. Export Verification Tolerances

Automated bitstream analysis via `ffprobe` checks the exported file against the project manifest:

| Parameter | Expected Value | Tolerance |
| :--- | :--- | :--- |
| **Duration** | 120.000 s | \(\le \pm 33.3\) ms (\(\pm 1\) frame) |
| **Video Codec** | H.264 (`avc1`) or HEVC (`hvc1`) | Exact match |
| **Frame Rate** | Constant 60.000 FPS | 0 variable frame rate jitter |
| **Resolution** | 3840x2160 (4K) or 1920x1080 | Exact match |
| **Pixel Format** | `yuv420p` | Exact match |
| **Color Primaries** | BT.709 or BT.2020 | Tagged in container |
| **Audio Codec** | AAC-LC | Exact match |
| **Audio Sample Rate**| 48,000 Hz | Exact match |
| **Audio Channels** | 2 (Stereo) | Exact match |
| **A/V Sync Drift** | Audio PTS vs Video PTS | \(< 10.0\) ms average drift |
| **Real-Time Factor** | Encode Speed Ratio | \(\ge 2.0x\) (Hardware acceleration) |

---

## 7. Operational Workflow

To execute the benchmark suite:

```bash
# 1. Generate or verify the synthetic Golden Assets
node scripts/benchmarks/generate-golden-assets.mjs

# 2. Run the automated RC1 Release-Gate Benchmark Suite
node scripts/benchmarks/run-rc1-benchmark.mjs

# 3. View the generated Markdown Scorecard
cat RC1_SCORECARD.md
```

If the score is \(\ge 99.0\) and all 5 Hard Gates pass, the build is certified as **Release Candidate 1 (RC1)**, and the YouTube Demonstration recording may proceed.
