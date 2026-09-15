/**
 * Backward-compatible serial entrypoint. New code should use cashDrawer.service.js.
 */
import { config } from "../../config.js";
import {
  OPEN_DRAWER_CMD,
  openDrawer as openDrawerService,
  isDrawerConfigured
} from "./cashDrawer.service.js";

export { OPEN_DRAWER_CMD };

export async function openDrawer(serialPathOrConfig) {
  if (typeof serialPathOrConfig === "string") {
    return openDrawerService({
      ...config,
      cash_drawer_mode: "serial",
      cash_drawer_serial_path: serialPathOrConfig
    });
  }
  return openDrawerService(serialPathOrConfig || config);
}

export function isConfigured(serialPath) {
  if (serialPath !== undefined) {
    return Boolean(serialPath && String(serialPath).trim());
  }
  return isDrawerConfigured(config);
}
