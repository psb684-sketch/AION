#!/usr/bin/env node
/**
 * Refuse to package Clypra with the tiny development FFmpeg wrapper scripts.
 * A Tauri externalBin entry only guarantees inclusion; this check guarantees
 * that the included files are native executables for the requested target.
 */
import { open, stat } from "node:fs/promises";
import { resolve } from "node:path";

const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : hostTarget();
if (!target || target.startsWith("--")) {
  throw new Error("Usage: node scripts/verify-sidecars.mjs [--target <target-triple>]");
}

const extension = target.includes("windows") ? ".exe" : "";
const expectedMagic = target.includes("windows") ? "4d5a" : target.includes("linux") ? "7f454c46" : null;
const binaries = ["ffmpeg", "ffprobe"];

for (const binary of binaries) {
  const path = resolve("src-tauri", "bin", `${binary}-${target}${extension}`);
  let header = Buffer.alloc(4);
  let size;
  try {
    const handle = await open(path, "r");
    try {
      await handle.read(header, 0, header.length, 0);
    } finally {
      await handle.close();
    }
    ({ size } = await stat(path));
  } catch (error) {
    throw new Error(`Missing required ${binary} sidecar at ${path}: ${error.message}`);
  }

  if (size < 1_000_000) {
    throw new Error(`${path} is only ${size} bytes; release sidecars must be verified native binaries, not development wrappers.`);
  }

  const magic = header.toString("hex");
  if (expectedMagic && !magic.startsWith(expectedMagic)) {
    throw new Error(`${path} has header ${magic}, expected prefix ${expectedMagic} for ${target}.`);
  }
  if (target.includes("apple-darwin") && !isMachO(magic)) {
    throw new Error(`${path} has header ${magic}, expected a Mach-O executable for ${target}.`);
  }
  console.log(`Verified ${binary} sidecar: ${path} (${Math.round(size / 1024 / 1024)} MB)`);
}

function isMachO(magic) {
  return new Set(["feedface", "cefaedfe", "feedfacf", "cffaedfe", "cafebabe", "bebafeca"]).has(magic);
}

function hostTarget() {
  const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x86_64" : null;
  if (!arch) return null;
  if (process.platform === "darwin") return `${arch}-apple-darwin`;
  if (process.platform === "linux") return `${arch}-unknown-linux-gnu`;
  if (process.platform === "win32") return `${arch}-pc-windows-msvc`;
  return null;
}
