# Body Effect Rendering — Technical Documentation

**Always-included steering file for the body effects feature area.**

---

## Overview

The body effects system composites a live video subject over generated content (text, gradients, animated backdrops) by separating the human subject from the background in real time. The flagship effect is **Subject Cutout** (`subject-cutout` / `alpha-cutout`), which places large typography _behind_ the subject — a technique commonly called "text behind person".

The pipeline has three distinct layers that execute every animation frame:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Background                                       │
│  Raw video frame OR simulated animated backdrop             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Typography                                       │
│  Canvas2D text drawn at canvas center (full-bleed)          │
│  Auto-sized, shadow, user-nudgeable via textOffsetY         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Subject Cutout Foreground                        │
│  Feathered alpha-masked video frame (subject only)          │
│  composited on top so subject occludes the text             │
└─────────────────────────────────────────────────────────────┘
```

The ordering of Layer 2 before Layer 3 is what produces the illusion of text existing in the 3D scene behind the person.

---

## Segmentation Pipeline

### Worker Architecture

Body segmentation runs entirely off the main thread inside `bodySegmentation.worker.ts`. The main thread never blocks on mask computation.

```
Main Thread (BodyLabView.tsx)
  │
  │  requestAnimationFrame loop
  │  → capture video frame (ImageData)
  │  → bodySegmentationWorkerClient.segmentBodyMask()
  │      │
  │      │  postMessage({ type: 'SEGMENT', imageData, ... })
  │      ▼
  │  bodySegmentation.worker.ts
  │      │
  │      ├─ Runtime: "onnx"       → ONNX Runtime WASM inference
  │      ├─ Runtime: "mediapipe"  → MediaPipe ImageSegmenter
  │      ├─ Runtime: "heuristic"  → Luma-based fallback (no model)
  │      └─ Runtime: "fallback"   → heuristic if primary runtime fails
  │      │
  │      │  postMessage({ mask: ImageData })
  │      ▼
  │  maskCanvasRef  ← putImageData() on the main thread
  │  (used in next rAF tick to build cutoutCanvasRef)
```

The worker client (`bodySegmentationWorkerClient.ts`) maintains a **per-clip request queue**. Only one in-flight segmentation request exists per clip key at a time; newer frames supersede queued-but-not-yet-started ones, preventing mask latency from accumulating during fast scrubbing.

### Runtime Selection

| Runtime     | Model                                              | Notes                                                    |
| ----------- | -------------------------------------------------- | -------------------------------------------------------- |
| `onnx`      | Custom `.onnx` model served from CDN               | Best quality; WASM-based ONNX Runtime                    |
| `mediapipe` | Configured via `segmentationConfig.ts` (see below) | Good quality; uses MediaPipe `ImageSegmenter` Vision API |
| `heuristic` | None — luma + edge heuristic                       | Zero-latency fallback; no model required                 |
| `fallback`  | Same as `heuristic`                                | Auto-triggered if primary runtime throws or returns null |

Mask output from all runtimes is `ImageData` at the inference resolution. The client upscales it to `drawW × drawH` before writing to `maskCanvasRef`.

### Segmentation Config (`segmentationConfig.ts`)

Runtime config is fetched from the API at startup and cached in a module-level promise. It controls which model URL, WASM paths, and confidence threshold are used.

```
getBodySegmentationConfig()
  │
  ├─ fetchRemoteConfig()  → GET /body-effects/segmentation-config
  │       ↓ on success: merges with DEFAULT_CONFIG
  │       ↓ on failure: falls back silently to DEFAULT_CONFIG
  │
  └─ envOverrides()  → VITE_CLYPRA_BODY_SEGMENTATION_* env vars
          ↓ always applied last (highest precedence)
```

The current `DEFAULT_CONFIG` uses **`selfie_segmenter`** (a single-class silhouette model). This model segments the person's silhouette from the background but does **not** classify sub-regions — it produces a single binary foreground/background mask. It does not have separate outputs for hair, clothes, or body skin.

**Important:** Upgrading to `selfie_multiclass_256x256` would produce 6 per-class confidence masks (background, hair, body skin, face skin, clothes, others), enabling better hair boundary coverage. However, this requires updating `mediaPipeResultToMask` to combine foreground classes — see the Mask Channel Selection section below.

The config can be overridden without a code deploy:

- At runtime via `GET /body-effects/segmentation-config` response
- At build time via `VITE_CLYPRA_BODY_SEGMENTATION_MODEL_URL` and related env vars

### Mask Channel Selection (`mediaPipeResultToMask`)

The current implementation takes `confidenceMasks[last]` as the person confidence channel:

```typescript
// Current: grab last confidence mask (works for selfie_segmenter binary output)
const personConfidenceMask =
  confidenceMasks.length > 1
    ? confidenceMasks[confidenceMasks.length - 1]
    : confidenceMasks[0];
```

For `selfie_segmenter`, `confidenceMasks` has 2 entries: `[background, person]`. Taking the last entry (`person`) is correct.

For `selfie_multiclass_256x256`, `confidenceMasks` has 6 entries: `[background(0), hair(1), body_skin(2), face_skin(3), clothes(4), others(5)]`. Taking only the last entry (`others`) would be wrong — it would discard hair, face, and body coverage. If the model is ever upgraded to multiclass, `mediaPipeResultToMask` must be updated to take the **per-pixel maximum** across indices 1–5 before calling `confidenceDataToMask`.

The fallback path in `mediaPipeResultToMask` uses `categoryMask` (a `Uint8Array` where 0 = background, >0 = foreground class). This path works correctly for both binary and multiclass models because any non-zero class is treated as foreground.

---

## Feathered Cutout Canvas — Two-Pass Strategy

The cutout canvas (`cutoutCanvasRef`) is rebuilt every frame when a mask is available. The construction uses a two-pass strategy with no pre-composite blur.

### Why no blur filter

An early version of this code applied `ctx.filter = blur(Npx)` when drawing the mask for `destination-in` compositing. This was removed because:

- The mask from the worker is 256×256. When bilinear-upscaled to display resolution (e.g. 900px wide), 1 mask pixel = ~3.5 display pixels.
- A `blur(2px)` filter on top expands the boundary by another 2px on each side.
- Combined, the mask's edge overshot the actual person silhouette by ~10–14 display pixels — enough to eat adjacent text characters that sit close to the face edge (e.g. the `"u"` in `"Musa"` when the face fills the right half of the frame).

The browser's bilinear interpolation during `drawImage` upscaling already produces smooth, anti-aliased edges on its own. No additional blur is needed or applied.

### Pass 1 — Build the Alpha Mask (`featherCanvasRef`)

```
featherCanvas
  ├─ clearRect
  ├─ imageSmoothingQuality = "high"
  ├─ drawImage(maskCanvas, 0, 0, targetW, targetH)   ← bilinear upscale → smooth edge
  └─ getImageData → pixel-level interior solidification:
       solidifyThreshold = 230 - feather × 4.5       ← feather slider controls band width
       alpha >= threshold  →  255 (fully opaque)      ← solid interior, no text bleed
       0 < alpha < threshold  →  smoothstep(a/threshold) × a  ← clean anti-aliased edge
```

The `solidifyThreshold` is the only boundary-affecting parameter:

- `feather=0` → threshold=230 (very tight soft-edge band, ~1–2px wide at display res)
- `feather=20` → threshold=140 (wider band, ~4–5px wide — useful for soft hair)

Pixels clearly inside the subject (high alpha from the model's confidence output) are clamped to 255. Only the true edge transition band stays semi-transparent. This prevents text from bleeding through the subject's face, hair, or body.

### Pass 2 — Composite Video onto the Mask

```
cutoutCanvas
  ├─ clearRect
  ├─ drawImage(videoElement)                          ← full video frame
  ├─ globalCompositeOperation = "destination-in"
  └─ drawImage(featherCanvas)                         ← precision mask as alpha source
       → pixels outside person boundary → erased
       → edge band → smooth transition
       → interior → fully opaque video pixels
```

The `destination-in` operation retains video pixels where the mask has alpha, erases them where it does not. Because interior alpha was clamped to 255 in Pass 1, the face and body always render at full opacity.

---

## Warmup Behavior (Mask Not Yet Ready)

The segmentation worker needs 1–3 frames to produce the first mask. During this warmup window, rendering must not fall back to drawing the raw full-frame video on top of the text layer — that would completely bury the typography.

Instead, the render loop shows a **ghost frame**:

```typescript
// Mask still loading — ghost video at 40% so text stays readable
ctx.globalAlpha = 0.4;
ctx.drawImage(video, drawX, drawY, drawW, drawH);
ctx.globalAlpha = 1;
// + "⏳ Segmenting…" pill chip rendered at bottom of frame
```

The status chip is a rounded-rect pill drawn via `roundRect()` at the bottom of the video area, letting the user know the effect is initializing rather than broken.

---

## Typography Layer

### Positioning

Text is anchored to the **full canvas center** (`canvas.width / 2`, `canvas.height / 2`), not the video sub-rect center. This produces a full-bleed layout where the text spans edge-to-edge regardless of the video's fit/fill mode.

```typescript
const textCanvasCX = canvas.width / 2;
const textCanvasCY = canvas.height / 2;
const textY = textCanvasCY + (parameters.textOffsetY ?? 0) * scaleFactor;
```

`textOffsetY` (range −200 to +200, default 0) lets the user nudge text up into the torso area or down below the frame center.

### Auto-Shrink

If the text overflows 96% of `canvas.width` at the requested font size, the font is proportionally reduced:

```typescript
const measuredW = ctx.measureText(text).width;
const maxTextW = canvas.width * 0.96;
const autoFontSize =
  measuredW > maxTextW ? baseFontSize * (maxTextW / measuredW) : baseFontSize;
```

This prevents long names from overflowing the canvas without requiring the user to manually reduce `textSize`.

### Scale Factor

`scaleFactor = drawH / canvas.height` normalizes font sizes and offsets relative to how much of the canvas the video occupies. In fill mode with a portrait video, `scaleFactor ≈ 1`. In fit mode with a landscape video on a portrait canvas, it can be 0.5–0.7.

---

## Canvas Reference Lifecycle

| Ref                | Created                            | Sized                                            | Reused                      |
| ------------------ | ---------------------------------- | ------------------------------------------------ | --------------------------- |
| `canvasRef`        | Once on mount                      | Fixed (`effectCanvasWidth × effectCanvasHeight`) | Always                      |
| `maskCanvasRef`    | On first mask response from worker | Match `drawW × drawH`                            | Per mask update             |
| `cutoutCanvasRef`  | On first valid mask                | Match `drawW × drawH`                            | Resized on dimension change |
| `featherCanvasRef` | First frame with mask              | Match `drawW × drawH`                            | Resized on dimension change |

`featherCanvasRef` is intentionally persistent across frames — allocating a new `HTMLCanvasElement` every animation frame is ~0.1–0.5ms of GC pressure at 30fps that compounds over a session.

---

## Adding a New Body Effect

1. Add the effect ID to the `effectId` switch block in `BodyLabView.tsx`.
2. The effect must call `drawBaseBackground()` first if it uses the video as a background.
3. If the effect needs the cutout (subject separated from background), use `cutoutCanvasRef.current` — do **not** re-implement the feather logic inline.
4. If the effect needs the raw segmentation mask pixels (e.g., for glow, outline, or displacement), read from `maskCanvasRef.current` directly.
5. Never call `drawImage(video!)` over the text layer without an alpha mask — this buries the typography.

---

## Heuristic Fallback

When no ML runtime is available (network failure, WASM not supported, model load error), the system falls back to `segmentWithHeuristic()`. This runs entirely on the CPU with no model dependencies.

The algorithm:

1. Samples every 16th pixel to compute the scene's average luma
2. Sets a threshold at `avgLuma × 0.78` (clamped to 18–180)
3. Marks a pixel as subject if: alpha > 8, AND (luma > threshold OR chroma > 28), AND center-distance bias > `1 - minConfidence`

The center-distance bias is the key heuristic assumption: the subject is more likely to be near the frame center. This works well for head-and-shoulders framing but fails for wide shots or subjects at frame edges.

Output is passed through `softenMask()` — a 3×3 box-blur on the alpha channel — to reduce hard step edges.

**Heuristic quality ceiling:** The heuristic does not understand body anatomy. It cannot distinguish a white-shirt subject from a white background, and it will include background objects that happen to be centered and high-contrast. It is a last resort, not a quality path.

---

## Known Constraints

- **Model coverage:** The default `selfie_segmenter` model segments the person's outer silhouette only. It may miss fine hair strands at the boundary, particularly against similarly-colored backgrounds. The `selfie_multiclass_256x256` model would improve hair coverage but requires a code change to `mediaPipeResultToMask` (see Mask Channel Selection above) before the config can be safely switched.
- **Two-pass feather CPU cost:** `getImageData` + pixel loop on a 720p cutout canvas processes ~921 600 alpha values per frame. At 30fps this is ~27M iterations/second — acceptable, but it should be moved off the main thread or replaced with a WebGL shader if the feature needs to scale to 60fps or feather > 8px.
- **MediaPipe IMAGE mode:** `runningMode: "IMAGE"` re-infers independently on every frame with no temporal state. Switching to `VIDEO` mode would enable inter-frame smoothing and slightly lower per-frame cost, but requires a monotonically-increasing timestamp to be passed with each inference call.
- **Worker singleton:** The worker client lazily instantiates one shared `Worker` instance. If two components both call `segmentBodyMask()` concurrently (e.g., two body-effect previews open), their requests interleave in the same worker queue. Each uses a unique `clipKey` for queue management, but only one inference runs at a time.
