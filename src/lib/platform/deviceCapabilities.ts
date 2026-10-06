/**
 * Device Capabilities Detection
 *
 * Detects device type and capabilities to optimize performance settings.
 * Mobile devices receive reduced settings to preserve battery and prevent thermal throttling.
 *
 * Architecture:
 * - Desktop: Full performance (4 workers, high-res thumbnails, 60fps preview)
 * - Mobile: Reduced performance (2 workers, lower-res thumbnails, 30fps preview)
 * - Adaptive: Adjusts based on battery/thermal state
 */

import { Capacitor } from "@capacitor/core";

export interface DeviceCapabilities {
  /** Device type */
  platform: "desktop" | "mobile";

  /** Platform name (ios, android, web, electron) */
  platformName: string;

  /** Number of logical CPU cores */
  cpuCores: number;

  /** Estimated RAM in GB (approximation) */
  estimatedRamGB: number;

  /** Whether device is currently on battery power */
  onBattery: boolean;

  /** Battery level (0-1), null if unknown */
  batteryLevel: number | null;

  /** Whether device is thermally throttling */
  thermalThrottling: boolean;
}

export interface PerformanceProfile {
  /** Number of web workers for parallel processing */
  workerCount: number;

  /** Thumbnail resolution width */
  thumbnailWidth: number;

  /** Thumbnail resolution height */
  thumbnailHeight: number;

  /** Decoder pool size */
  decoderPoolSize: number;

  /** Preview playback FPS */
  previewFps: number;

  /** Filmstrip tile density */
  filmstripDensity: "low" | "medium" | "high";

  /** Enable background processing */
  enableBackgroundProcessing: boolean;

  /** Cache size in MB */
  cacheSizeMB: number;
}

/**
 * Detect if running on mobile device (iOS or Android via Capacitor).
 */
export function isMobile(): boolean {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android";
}

/**
 * Get device capabilities.
 * Uses browser APIs and Capacitor to detect hardware characteristics.
 */
export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  const platformName = Capacitor.getPlatform();
  const platform = isMobile() ? "mobile" : "desktop";

  // CPU cores
  const cpuCores = navigator.hardwareConcurrency || 4;

  // Estimate RAM based on device memory API (if available)
  // @ts-expect-error - deviceMemory is not in standard types
  const deviceMemory = navigator.deviceMemory as number | undefined;
  const estimatedRamGB = deviceMemory || (platform === "mobile" ? 4 : 8);

  // Battery status
  let onBattery = false;
  let batteryLevel: number | null = null;

  try {
    // @ts-expect-error - getBattery not in all browsers
    const battery = await navigator.getBattery?.();
    if (battery) {
      onBattery = !battery.charging;
      batteryLevel = battery.level;
    }
  } catch {
    // Battery API not available or blocked
    onBattery = platform === "mobile"; // Assume mobile is on battery
  }

  // Thermal throttling detection (heuristic)
  // On mobile, assume throttling if battery is low and device is not charging
  const thermalThrottling = platform === "mobile" && onBattery && batteryLevel !== null && batteryLevel < 0.2;

  return {
    platform,
    platformName,
    cpuCores,
    estimatedRamGB,
    onBattery,
    batteryLevel,
    thermalThrottling,
  };
}

/**
 * Get optimal performance profile for current device.
 * Adapts settings based on device capabilities and current state.
 */
export async function getPerformanceProfile(): Promise<PerformanceProfile> {
  const caps = await getDeviceCapabilities();

  // Base profile selection
  if (caps.platform === "mobile") {
    return getMobileProfile(caps);
  } else {
    return getDesktopProfile(caps);
  }
}

/**
 * Desktop performance profile: Full performance.
 */
function getDesktopProfile(caps: DeviceCapabilities): PerformanceProfile {
  // Adjust based on battery state even on desktop (laptops)
  const isLowPower = caps.onBattery && caps.batteryLevel !== null && caps.batteryLevel < 0.3;

  if (isLowPower) {
    // Reduced desktop profile for battery saving
    return {
      workerCount: Math.max(2, Math.min(caps.cpuCores - 1, 3)),
      thumbnailWidth: 120,
      thumbnailHeight: 68,
      decoderPoolSize: 15,
      previewFps: 30,
      filmstripDensity: "medium",
      enableBackgroundProcessing: false,
      cacheSizeMB: 100,
    };
  }

  // Full desktop profile
  return {
    workerCount: Math.max(2, Math.min(caps.cpuCores - 1, 4)),
    thumbnailWidth: 160,
    thumbnailHeight: 90,
    decoderPoolSize: 20,
    previewFps: 60,
    filmstripDensity: "high",
    enableBackgroundProcessing: true,
    cacheSizeMB: 200,
  };
}

/**
 * Mobile performance profile: Reduced for battery/thermal.
 */
function getMobileProfile(caps: DeviceCapabilities): PerformanceProfile {
  // Ultra low power mode: battery critical or throttling
  const isUltraLowPower = caps.thermalThrottling || (caps.batteryLevel !== null && caps.batteryLevel < 0.15);

  if (isUltraLowPower) {
    return {
      workerCount: 1, // Single worker
      thumbnailWidth: 80,
      thumbnailHeight: 45,
      decoderPoolSize: 5,
      previewFps: 24,
      filmstripDensity: "low",
      enableBackgroundProcessing: false,
      cacheSizeMB: 50,
    };
  }

  // Low power mode: on battery
  const isLowPower = caps.onBattery && caps.batteryLevel !== null && caps.batteryLevel < 0.3;

  if (isLowPower) {
    return {
      workerCount: 1,
      thumbnailWidth: 100,
      thumbnailHeight: 56,
      decoderPoolSize: 8,
      previewFps: 30,
      filmstripDensity: "low",
      enableBackgroundProcessing: false,
      cacheSizeMB: 75,
    };
  }

  // Standard mobile profile: plugged in or good battery
  return {
    workerCount: 2,
    thumbnailWidth: 120,
    thumbnailHeight: 68,
    decoderPoolSize: 10,
    previewFps: 30,
    filmstripDensity: "medium",
    enableBackgroundProcessing: true,
    cacheSizeMB: 100,
  };
}

/**
 * Monitor battery and thermal state changes.
 * Calls callback when state changes significantly.
 */
export async function monitorDeviceState(
  callback: (caps: DeviceCapabilities) => void,
  intervalMs: number = 30000, // Check every 30 seconds
): Promise<() => void> {
  let lastCaps = await getDeviceCapabilities();
  callback(lastCaps);

  // Poll for changes
  const interval = setInterval(async () => {
    const newCaps = await getDeviceCapabilities();

    // Check if significant change occurred
    const changed = newCaps.onBattery !== lastCaps.onBattery || newCaps.thermalThrottling !== lastCaps.thermalThrottling || (newCaps.batteryLevel !== null && lastCaps.batteryLevel !== null && Math.abs(newCaps.batteryLevel - lastCaps.batteryLevel) > 0.1); // 10% change

    if (changed) {
      lastCaps = newCaps;
      callback(newCaps);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Log device capabilities to console (for debugging).
 */
export async function logDeviceCapabilities(): Promise<void> {
  const caps = await getDeviceCapabilities();
  const profile = await getPerformanceProfile();

  // console.group("[Device Capabilities]");
  // console.log("Platform:", caps.platform, `(${caps.platformName})`);
  // console.log("CPU Cores:", caps.cpuCores);
  // console.log("Estimated RAM:", `${caps.estimatedRamGB} GB`);
  // console.log("Battery:", caps.onBattery ? "On Battery" : "Plugged In");
  // if (caps.batteryLevel !== null) {
  //   console.log("Battery Level:", `${(caps.batteryLevel * 100).toFixed(0)}%`);
  // }
  // console.log("Thermal Throttling:", caps.thermalThrottling ? "Yes" : "No");
  // console.groupEnd();

  // console.group("[Performance Profile]");
  // console.log("Workers:", profile.workerCount);
  // console.log("Thumbnail Size:", `${profile.thumbnailWidth}×${profile.thumbnailHeight}`);
  // console.log("Decoder Pool:", profile.decoderPoolSize);
  // console.log("Preview FPS:", profile.previewFps);
  // console.log("Filmstrip Density:", profile.filmstripDensity);
  // console.log("Background Processing:", profile.enableBackgroundProcessing);
  // console.log("Cache Size:", `${profile.cacheSizeMB} MB`);
  // console.groupEnd();
}
