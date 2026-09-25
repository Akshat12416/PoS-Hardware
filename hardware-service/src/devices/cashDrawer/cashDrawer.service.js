/**
 * Cash drawer: serial ESC/POS or printer-kick through the receipt printer.
 * Mode is explicit; unconfigured until the discovery checklist is completed.
 */
import logger from "../../utils/logger.js";
import { sendRawToPrinter } from "../printer/printer.windows.js";
import { isDemoMode } from "../../utils/demoMode.js";
import {
  isDrawerConfigured,
  resolveDrawerMode,
  drawerDiscoveryHint
} from "./cashDrawer.logic.js";

export { isDrawerConfigured };

export function isDrawerReady(cfg = {}) {
  return isDemoMode() || isDrawerConfigured(cfg);
}

export const OPEN_DRAWER_CMD = Buffer.from([
  0x1b, 0x70, 0x00, 0x32, 0xfa,
  0x1b, 0x70, 0x01, 0x32, 0xfa
]);

let lastOpenAt = null;
let lastError = null;
let lastModeUsed = null;

export function getDrawerHealth(cfg = {}) {
  const demo = isDemoMode();
  const mode = demo ? "demo" : resolveDrawerMode(cfg);
  const configured = demo ? true : isDrawerConfigured(cfg);
  return {
    demo,
    configured,
    mode,
    serial_path: cfg.cash_drawer_serial_path || null,
    baud_rate: cfg.cash_drawer_baud_rate || 9600,
    printer_name: cfg.printer_name || null,
    last_open_at: lastOpenAt,
    last_error: lastError,
    last_mode_used: lastModeUsed,
    discovery_hint: demo ? null : drawerDiscoveryHint(cfg)
  };
}

async function openSerial(serialPath, baudRate) {
  if (!serialPath || !String(serialPath).trim()) {
    throw new Error("Cash drawer serial path not configured");
  }
  const { SerialPort } = await import("serialport");
  const drawerPort = new SerialPort({
    path: String(serialPath).trim(),
    baudRate: baudRate || 9600,
    autoOpen: false
  });

  await new Promise((resolve, reject) => {
    drawerPort.open((err) => (err ? reject(err) : resolve()));
  });

  try {
    await new Promise((resolve, reject) => {
      drawerPort.write(OPEN_DRAWER_CMD, (err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve) => drawerPort.drain(() => resolve()));
  } finally {
    await new Promise((resolve) => {
      try {
        drawerPort.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }
}

export async function openDrawer(cfg = {}) {
  const mode = isDemoMode() ? "demo" : resolveDrawerMode(cfg);
  try {
    if (mode === "demo") {
      lastModeUsed = "demo";
      lastOpenAt = new Date().toISOString();
      lastError = null;
      logger.info("[CASH DRAWER] DEMO open (no serial/printer kick)");
      return { success: true, demo: true, mode: "demo" };
    }
    if (mode === "serial") {
      await openSerial(cfg.cash_drawer_serial_path, cfg.cash_drawer_baud_rate);
      lastModeUsed = "serial";
    } else if (mode === "printer") {
      await sendRawToPrinter(cfg.printer_name, OPEN_DRAWER_CMD);
      lastModeUsed = "printer";
    } else {
      throw new Error(
        "Cash drawer mode is unconfigured. Complete docs/CASH_DRAWER_DISCOVERY.md and set cash_drawer_mode to serial or printer."
      );
    }
    lastOpenAt = new Date().toISOString();
    lastError = null;
    logger.info(`[CASH DRAWER] Open command sent via ${lastModeUsed}`);
    return { success: true, mode: lastModeUsed };
  } catch (err) {
    lastError = err.message;
    logger.error(`[CASH DRAWER] ${err.message}`);
    throw err;
  }
}

/** @deprecated use isDrawerConfigured */
export function isConfigured(serialPath) {
  return Boolean(serialPath && String(serialPath).trim());
}
