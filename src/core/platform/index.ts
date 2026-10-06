import { PlatformInterface, getPlatformType } from "./platform";
import { TauriPlatformAdapter } from "./adapters/tauriAdapter";
import { CapacitorPlatformAdapter } from "./adapters/capacitorAdapter";

let activePlatform: PlatformInterface;

const platformType = getPlatformType();

if (platformType === "tauri") {
  activePlatform = new TauriPlatformAdapter();
} else {
  activePlatform = new CapacitorPlatformAdapter();
}

export { activePlatform as platform };
export * from "./platform";
