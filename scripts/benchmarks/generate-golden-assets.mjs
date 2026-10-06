#!/usr/bin/env node
/**
 * Clypra Golden Project Asset Generator
 *
 * Generates the standardized test media suite required for the
 * Release Candidate 1 (RC1) Full-System Benchmark.
 *
 * Usage:
 *   node scripts/benchmarks/generate-golden-assets.mjs [--force] [--dir <path>]
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_FIXTURES_DIR = resolve(__dirname, "../../fixtures/golden-project");

async function findFfmpeg() {
  try {
    const { stdout } = await execFileAsync("which", ["ffmpeg"]);
    const bin = stdout.trim();
    if (bin && existsSync(bin)) return bin;
  } catch {
    // Fall back to sidecars
  }

  const platform = process.platform;
  const arch = process.arch;
  let target = "";
  if (platform === "darwin") {
    target = arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  } else if (platform === "win32") {
    target = "x86_64-pc-windows-msvc.exe";
  } else {
    target = "x86_64-unknown-linux-gnu";
  }

  const sidecar = resolve(__dirname, "../../src-tauri/bin", `ffmpeg-${target}`);
  if (existsSync(sidecar)) return sidecar;

  throw new Error("FFmpeg executable not found on PATH or in src-tauri/bin.");
}

async function runFfmpeg(ffmpegBin, args) {
  try {
    await execFileAsync(ffmpegBin, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
  } catch (error) {
    throw new Error(`FFmpeg failed: ${error.stderr || error.message}`);
  }
}

async function main() {
  const force = process.argv.includes("--force");
  const dirIndex = process.argv.indexOf("--dir");
  const outputDir = dirIndex >= 0 ? resolve(process.argv[dirIndex + 1]) : DEFAULT_FIXTURES_DIR;

  console.log(`\n================================================================`);
  console.log(`  CLYPRA GOLDEN PROJECT SYNTHETIC ASSET GENERATOR`);
  console.log(`  Target Directory: ${outputDir}`);
  console.log(`================================================================\n`);

  await mkdir(outputDir, { recursive: true });
  const ffmpegBin = await findFfmpeg();
  console.log(`✓ Located FFmpeg binary: ${ffmpegBin}\n`);

  const manifest = [
    {
      filename: "video_4k_30fps_hevc.mp4",
      description: "4K 30fps HEVC Primary Video (A-Roll)",
      duration: 120,
      generate: async (dest) => {
        // 3840x2160 @ 30fps, HEVC with hvc1 tag and embedded 48k stereo audio tone
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi", "-i", "testsrc2=size=3840x2160:rate=30:duration=120",
          "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=120",
          "-c:v", "libx265", "-tag:v", "hvc1", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "192k",
          "-shortest",
          dest,
        ]);
      },
    },
    {
      filename: "video_1080p_60fps_h264.mp4",
      description: "1080p 60fps H.264 B-Roll Video",
      duration: 120,
      generate: async (dest) => {
        // 1920x1080 @ 60fps, H.264 with embedded audio
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=60:duration=120",
          "-f", "lavfi", "-i", "sine=frequency=523.25:sample_rate=48000:duration=120",
          "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "192k",
          "-shortest",
          dest,
        ]);
      },
    },
    {
      filename: "video_vertical_1080x1920_30fps.mp4",
      description: "9:16 Vertical 30fps Smartphone Overlay",
      duration: 60,
      generate: async (dest) => {
        // 1080x1920 vertical format
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=60",
          "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
          dest,
        ]);
      },
    },
    {
      filename: "video_av1_720p_24fps.mp4",
      description: "720p 24fps AV1 End-Card Clip",
      duration: 30,
      generate: async (dest) => {
        // Attempt libsvtav1; if unavailable, fallback to libx264 with note
        try {
          await runFfmpeg(ffmpegBin, [
            "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24:duration=30",
            "-c:v", "libsvtav1", "-preset", "10", "-pix_fmt", "yuv420p",
            dest,
          ]);
        } catch {
          console.warn("  [Notice] libsvtav1 unavailable; falling back to libx264 for AV1 fixture.");
          await runFfmpeg(ffmpegBin, [
            "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24:duration=30",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            dest,
          ]);
        }
      },
    },
    {
      filename: "audio_music_stereo_48k.mp3",
      description: "Stereo 48kHz Synthesized Music Bed",
      duration: 120,
      generate: async (dest) => {
        // Stereo chord synthesis (440Hz L, 660Hz R)
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=120",
          "-f", "lavfi", "-i", "sine=frequency=659.25:sample_rate=48000:duration=120",
          "-filter_complex", "[0:a][1:a]amerge=inputs=2[a]",
          "-map", "[a]",
          "-c:a", "libmp3lame", "-b:a", "256k",
          dest,
        ]);
      },
    },
    {
      filename: "audio_voiceover_mono_48k.wav",
      description: "Mono 48kHz Voiceover Speech Track",
      duration: 90,
      generate: async (dest) => {
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=90",
          "-c:a", "pcm_s16le",
          dest,
        ]);
      },
    },
    {
      filename: "sticker_animated_lottie.json",
      description: "Animated Lottie Vector Sticker",
      duration: 3,
      generate: async (dest) => {
        // Standard Lottie format JSON definition (bouncing star/circle vector)
        const lottieData = {
          v: "5.7.4",
          fr: 60,
          ip: 0,
          op: 180,
          w: 500,
          h: 500,
          nm: "Clypra Golden Star",
          ddd: 0,
          assets: [],
          layers: [
            {
              ddd: 0,
              ind: 1,
              ty: 4,
              nm: "StarShape",
              sr: 1,
              ks: {
                o: { a: 0, k: 100 },
                r: {
                  a: 1,
                  k: [
                    { t: 0, s: [0] },
                    { t: 180, s: [360] },
                  ],
                },
                p: { a: 0, k: [250, 250, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: {
                  a: 1,
                  k: [
                    { t: 0, s: [80, 80, 100] },
                    { t: 90, s: [120, 120, 100] },
                    { t: 180, s: [80, 80, 100] },
                  ],
                },
              },
              ao: 0,
              shapes: [
                {
                  ty: "sr",
                  sy: 1,
                  d: 1,
                  pt: { a: 0, k: 5 },
                  p: { a: 0, k: [0, 0] },
                  r: { a: 0, k: 0 },
                  ir: { a: 0, k: 60 },
                  is: { a: 0, k: 0 },
                  or: { a: 0, k: 130 },
                  os: { a: 0, k: 0 },
                  ix: 1,
                  nm: "Polystar",
                },
                {
                  ty: "fl",
                  c: { a: 0, k: [0.98, 0.73, 0.01, 1] },
                  o: { a: 0, k: 100 },
                  r: 1,
                  bm: 0,
                  nm: "Fill",
                },
              ],
              ip: 0,
              op: 180,
              st: 0,
              bm: 0,
            },
          ],
        };
        await writeFile(dest, JSON.stringify(lottieData, null, 2), "utf8");
      },
    },
    {
      filename: "sticker_static_badge.png",
      description: "Transparent Static PNG Badge",
      duration: 0,
      generate: async (dest) => {
        // 512x512 RGBA transparent badge with colored circle
        await runFfmpeg(ffmpegBin, [
          "-f", "lavfi",
          "-i", "color=c=black@0.0:size=512x512:duration=1",
          "-vf", "drawbox=x=64:y=64:w=384:h=384:color=0x4F46E5@1.0:t=fill",
          "-frames:v", "1",
          dest,
        ]);
      },
    },
  ];

  for (const item of manifest) {
    const dest = resolve(outputDir, item.filename);
    const exists = existsSync(dest);

    if (exists && !force) {
      const info = await stat(dest);
      console.log(`  [Cached] ${item.filename.padEnd(36)} (${(info.size / 1024 / 1024).toFixed(2)} MB)`);
      continue;
    }

    process.stdout.write(`  [Generating] ${item.filename.padEnd(32)} ... `);
    const start = Date.now();
    await item.generate(dest);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    const info = await stat(dest);
    console.log(`DONE in ${elapsed}s (${(info.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  console.log(`\n================================================================`);
  console.log(`  ALL GOLDEN PROJECT ASSETS READY AT:`);
  console.log(`  ${outputDir}`);
  console.log(`================================================================\n`);
}

main().catch((err) => {
  console.error("\n❌ Asset generation failed:", err);
  process.exit(1);
});
