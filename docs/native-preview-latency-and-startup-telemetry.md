# Native Preview Latency and Startup Telemetry

**Status:** Implemented September 2026  
**Scope:** Native program preview on Windows, macOS, and other supported desktop platforms.

## Purpose

This document records the architectural response to a Windows first-playback regression in v1.5.1. The preview initially appeared blank or extremely slow, then became substantially faster when replayed in the same process.

The implementation separates two independent concerns:

1. Decode-ahead must not create visible playback latency by filling a large ready-frame queue.
2. First-use GPU/session initialization must be measurable separately from media decode and normal frame presentation.

## Evidence

The affected Windows Intel v1.5.1 session showed a high queue-hit rate but poor visible playback:

| Metric | Observed result |
| --- | --- |
| Ready-frame queue residency, p50 | ~364 ms |
| Ready-frame queue residency, p95 | ~482 ms |
| Ready-frame queue residency, max | ~545 ms |
| Queue capacity | 24 frames |
| Cold-frame p95 | ~1.4 s |
| Cold-frame max | ~10 s |

This ruled out a simple “cache miss” explanation. Frames were decoded and available, but the old fixed 16-frame lookahead policy could place them up to 16 frame intervals ahead of the playhead. At 30 fps that is approximately 533 ms of policy-created latency.

The cold outliers also could not be attributed to a single stage from the old logs. For example, the longest sample had small decode/upload/present timings while total wall time was nearly ten seconds. This requires an explicit startup/initialization measurement rather than treating all delay as FFmpeg work.

## Architecture

### Startup readiness gate

Native preview has a strict startup order:

```text
surface configured → playback snapshot configured → GPU graph prepared
→ bounded decoder queue primed → render worker / audio-driven presentation
```

Pipeline warmup is no longer launched from native-surface configuration or as
a second best-effort task from playback configuration. Those two independent
tasks could both acquire `NativePreviewSession` while a visible frame waited
for the same lock. That race was tolerable on Apple Silicon but produced
multi-second `coldStartInitUs` delays on the Intel HD 520 Windows cohort.

`prepare_native_preview_pipelines` is now awaited during
`configure_native_playback_render`, before its render worker is started or its
lookahead queue is primed. The session-owned compositor cache makes repeated
preparation for the same canvas and target format a no-op. GPU initialization
is consequently a readiness prerequisite rather than work that races audio
and visible presentation.

If GPU preparation cannot complete because the native GPU session is absent or
invalid, playback configuration returns an explicit error. The frontend can
then use its established native-surface fallback path; it must not start an
audio clock against a blank native surface.

### Deadline-aware decode ahead

`NativePreviewFrameQueue` records an EWMA of completed decode duration. Each lookahead worker derives its depth from both this measured lead requirement and a presentation-latency cap:

```text
effective lookahead = min(
  configured lookahead,
  frames fitting in 100 ms,
  frames needed to cover measured decode duration
)
```

At 30 fps, the 100 ms cap permits at most three frames ahead of the playhead. A decoder needing about 40 ms of lead uses two frames; a slower decoder remains capped at three. The configured value remains an upper bound only—it is not a latency target.

The worker also re-reads the audio clock before each decode. If its target frame is already behind the live playhead, it skips that decode instead of adding obsolete work. When a visible presentation arrives, the queue removes frames more than two frames behind the requested frame; two frames remain only for the intentional closest-frame fallback.

These invariants preserve strictly forward decoding and avoid competing backward FFmpeg seeks while preventing the queue from becoming a latency buffer.

### Non-blocking playback presentation

Continuous playback treats the audio-clock tick as a deadline. It does not
wait for an in-flight lookahead task and it does not start a competing
foreground FFmpeg decode. The prior 75 ms wait made the ready queue a
foreground dependency: current v1.5.1 evidence showed this wait at roughly
44 ms p50 / 86 ms p95 on Windows and 77 ms p50 / 78 ms p95 on Apple Silicon.

The presentation path now follows this rule:

```text
exact ready frame → recent completed frame (within two frames) → measured drop
```

On a miss, `lookahead-miss` is recorded as a dropped presentation and the
decoder worker continues with the newest demand. That gives the worker one
owner of decoder progress and keeps the UI responsive under temporary decode
pressure. Paused, scrub, and seek requests retain their synchronous recovery
behavior because they are interactive correctness operations rather than
continuous playback ticks.

The miss path explicitly invokes the coalesced refill scheduler before it
returns. This is a liveness invariant: the normal refill invocation is after a
successful presentation and would otherwise be skipped by an early drop,
leaving an empty queue to produce a black surface until pause/play re-primes
the session.

### Capability policy is a session contract

The session-start probe chooses `full`, `reduced`, or `proxy` quality before
the playback worker is started. The choice is written into the render
snapshot, so both the initial prime and all later queue refills decode at the
same policy. It is also repeated on native samples and rollups as
`capabilityPolicy` and `capabilityProbeUs`; a one-shot metadata field is not
reliable with adaptive telemetry sampling or a dropped first presentation.

### Cold-start timing

Visible native surface presentation now measures:

- session mutex wait before GPU work;
- compositor graph creation / pipeline initialization time;
- their combined `coldStartInitUs` only when a visible frame pays an initialization cost.

Normal short-lived mutex contention is not reported as cold start. A first use of a compositor or a wait of at least 1 ms is reported so the telemetry identifies startup contention without distorting steady-state stage metrics.

The existing pipeline warmup remains independent. The new field makes it possible to prove whether warmup completed before the first visible frame or blocked it.

### Per-stream GOP-aware decoder actor

To eliminate the 32.1s max cold seek latency and decoder-mutex lock thrashing observed on hardware like Intel HD 520 (decode p95 = 442 ms, decoder-mutex p95 = 160 ms), direct concurrent locking of `Arc<Mutex<VideoDecoder>>` across presentation and background lookahead threads has been replaced by a per-stream dedicated actor:

```text
Visible Frame Request (urgent_tx) ──┐
                                     ├──► [StreamDecoderActor] ──► VideoDecoder (serialized)
Lookahead Request (prefetch_tx) ───┘           │
                                                ├─ Prime Cache (4 frames, <10µs)
                                                └─ Mid-GOP preemption token
```

Key guarantees:
1. **Serialized Ownership:** Exactly one Tokio actor task per `(video_path, stream_id)` owns the `VideoDecoder`. Presentation and lookahead threads never compete for a raw mutex lock.
2. **Dual-Priority Channels:** Urgent presentation requests (scrubbing, seeking, paused stills) take immediate precedence over background lookahead prefetching (`prefetch_tx`).
3. **Mid-GOP Preemption:** Urgent presentation requests trip FFmpeg's `is_cancelled` packet loop via an atomic cancellation token (`cancel_in_flight`), aborting in-flight lookahead GOP decoding without burning hundreds of milliseconds on stale frames.
4. **MRU Prime Cache:** A 4-frame cache of recent sequential frames allows continuous playback and tight scrubbing to be served in `<10µs` without FFmpeg decode overhead.
5. **Opportunistic Forward Priming:** When channel queues are idle during playback, the actor proactively primes upcoming frames into the prime cache, yielding immediately upon new requests.

## Telemetry contract

Three optional microsecond fields are propagated from Rust through the Tauri contract, frontend rollups, session NDJSON, and API analytics:

| Field | Meaning | Interpretation |
| --- | --- | --- |
| `queueResidencyUs` | Time between a lookahead frame becoming ready and being presented | High values indicate excessive decode-ahead or stale queued work, not decoder speed. |
| `coldStartInitUs` | One-time visible-path session wait plus compositor initialization | High values indicate startup/pipeline/session initialization blocking. |
| `actorWaitUs` | Time a frame request spent queued waiting for the stream decoder actor | High values indicate decoder backlog or long GOP seeking; mutex wait is eliminated. |
| `capabilityPolicy` | Startup decode policy (`full`, `reduced`, or `proxy`) | Allows Intel/Apple-Silicon cohorts to be compared by the actual decode scale. |
| `capabilityProbeUs` | Startup capability probe duration | Separates a policy-selection cost from normal decode time. |

All fields have mean and percentile rollups. They are intentionally optional because steady-state frames should not be classified as startup work, and cold-decoded frames have no ready-queue residence.

The native preview and playback hot paths do not write per-frame or lifecycle
diagnostics to the terminal. These fields are emitted through native
performance samples, frontend rollups, session NDJSON, and API analytics
instead, preventing stdout/stderr backpressure from becoming a Windows preview
variable.

### Transport interaction telemetry

### Startup phase telemetry

`clypra://native-playback-startup` is a phase trace, not only a first-frame
marker. Every render revision records `render-session-created`,
`gpu-pipelines-ready`, `decode-policy-ready`, and
`first-native-frame-presented`. The session archive can therefore distinguish
decoder-lease acquisition, GPU graph construction, policy probing, and the
first actual presentation without terminal logging.

Windows native-surface startup warms only `Bgra8UnormSrgb`, the actual DXGI
swap-chain format. The RGBA readback compositor is intentionally lazy. Warming
both graphs eagerly creates two complete sets of blend pipelines, which was the
dominant first-preview cost in the Intel HD 520 telemetry cohort.

Play, pause, and paused seek/scrub commands are recorded as individual,
always-sampled `interaction` events. They contain no project or media content:
only an opaque interaction ID, outcome (`completed`, `superseded`, or
`failed`), command-queue delay, native-audio seek time, native-audio transport
time, and total completion time. They are deliberately excluded from frame
rollups so a burst of seeks cannot distort preview FPS or decode percentiles.

This distinguishes a slow click-to-play path from a slow first video frame:
the former will show command queue or native-audio time, while the latter will
remain visible in native startup/presentation telemetry.

The raw session archive also records a `native-playback-startup` milestone when
the first native frame is presented. It carries `readyAfterUs` (session
configuration through GPU readiness/probe) and `elapsedUs` (configuration
through first visible frame). Together with the play interaction timestamp,
these establish the startup timeline:

```text
play intent → native audio command complete → render session ready → first native frame
```

This event is emitted through Tauri and persisted in session telemetry; it is
not Rust terminal logging and does not run in the per-frame hot path.

### Audio control-plane isolation

Native audio timeline replacement can decode and prepare a complete candidate
graph before its atomic install. That work is intentionally allowed to take
time, but it must not delay an explicit user transport action. The controller
therefore uses two lanes:

```text
transport lane: play / pause / seek       → serial, short, latest intent
source-sync lane: clips / timeline update → latest-value, atomic replacement
```

The transport lane does not await source synchronization. During a source
update it operates on the already-installed graph; the replacement becomes
visible atomically when ready. This preserves audio continuity and prevents a
large media update from creating a click-to-play delay such as the observed
18.819 second FIFO queue wait on macOS.

The Cloudflare API schema and preview comparison analytics also recognize both fields. This permits cohort analysis across Windows Intel and macOS Apple Silicon without relying on untyped raw JSON.

## Files changed

| Area | Files |
| --- | --- |
| Stream decoder actor & actor pool | `src-tauri/src/thumbnail_engine/stream_actor.rs`, `src-tauri/src/thumbnail_engine.rs` |
| GOP sequential position & duration helpers | `src-tauri/src/thumbnail_engine/decoder.rs` |
| Native playback session actor leasing & cache invalidation | `src-tauri/src/commands/native_playback.rs` |
| Lookahead policy, stale-frame eviction, actor-based preview decode | `src-tauri/src/commands/native_preview.rs` |
| Native performance sample and percentile aggregation (`actor_wait_us`) | `src-tauri/src/native_core/performance.rs`, `src-tauri/src/native_core/service.rs` |
| Native-surface response contract (`actor_wait_us`) | `src-tauri/src/native_core/surface.rs` |
| Compositor warm-state inspection + Windows Bgra8UnormSrgb pre-warm | `src-tauri/src/wgpu_compositor.rs` |
| TypeScript native bridge, preview telemetry, and session rollups | `src/lib/platform/nativeCore.ts`, `src/services/telemetryCollector.ts`, `src/components/editor/preview/NativeProgramPreview.tsx` |
| API schema and comparison analytics | sibling `clypra-api/src/types/performance.ts`, `clypra-api/src/services/analyticsEngine.ts` |

## Verification

Run from the Clypra repository:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
npm run typecheck
cargo test --manifest-path src-tauri/Cargo.toml \
  commands::native_preview::tests::lookahead_is_bounded_by_the_presentation_latency_budget \
  -- --exact
```

Run from the sibling API repository:

```bash
npm run typecheck
npm test -- --runInBand src/__tests__/performance.test.ts
```

The focused Rust regression test verifies that a configured 16-frame queue resolves to two frames for a 40 ms decoder at 30 fps, and never exceeds three frames even for a much slower decoder.

## Windows validation procedure

1. Start a fresh Windows dev session, import the affected MP4, and play immediately.
2. Collect the first cold frame and at least 30 seconds of playback telemetry.
3. Compare the first run with a replay in the same process.
4. Inspect the following in order:
   - `coldStartInitUs` for first-frame/session startup blocking;
   - `queueResidencyUs` p50/p95 for policy-created latency;
   - decode and decoder mutex timings for FFmpeg/GOP behavior;
   - upload, compose, surface acquisition, and present timings for GPU bottlenecks.

Expected result after the Bgra8UnormSrgb warmup fix: `coldStartInitUs` should be absent or under 200 ms on the first native frame (matching the macOS ~120 ms baseline). Any remaining first-run stall should be attributed to a different measured stage, not compositor pipeline compilation.

## v1.5.1 session analysis

Four sessions were analyzed from DB + R2 telemetry (September 2026):

| Session | Platform | `coldStartInitUs` (first occurrence) | Cause |
| --- | --- | --- | --- |
| `launch-1789807958711-p4yoli` | Windows Intel HD 520 | **4,963 ms** | Bgra8UnormSrgb compositor compiled synchronously inside Frame 2 presentation |
| `launch-1789807298689-5csq0k` | macOS Apple M1 | **120 ms** | Normal first-use Metal pipeline initialization |

The root cause on Windows: `configure_native_playback_render` calls `prepare_native_preview_pipelines` before the swapchain has set `configured_format()`, so it warms `Rgba8UnormSrgb`. When the native surface presents Frame 2 it uses `Bgra8UnormSrgb` (the DXGI swapchain default), finds no compositor cached for that format, and compiles all five D3D12 pipelines synchronously while holding the session mutex — blocking the decoder thread for 536 ms and producing 4.96 s of presentation latency.

The fix (`#[cfg(target_os = "windows")]` block in `warmup_gpu_pipelines` and `prepare_native_preview_pipelines`) pre-compiles `Bgra8UnormSrgb` during the readiness gate, regardless of the format passed by the caller. `has_compositor` makes subsequent calls no-ops.

## Non-goals

- This change does not claim that every initial decode is fast; long GOP media can still require a cold decode.
- It does not hide startup latency with a placeholder frame.
- It does not alter media decoding correctness, FFmpeg binaries, or native-surface fallback policy.

Its purpose is to eliminate queue-created and compositor-compilation latency and make remaining cold-start delay diagnosable with durable, cross-platform telemetry.
