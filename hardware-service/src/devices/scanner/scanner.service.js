/**
 * Scanner coordinator: one explicit input mode at a time.
 * Modes: auto | serial | usb_hid | keyboard_wedge | disabled
 */
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import { appendScanChunk } from "./scanner.buffer.js";
import { initUsbHidScanner, closeUsbHidScanner } from "./scanner.usbHid.js";
import {
  initKeyboardWedgeScanner,
  closeKeyboardWedgeScanner
} from "./scanner.hid.js";

let lastScan = null;
let lastScanAt = null;
let lastError = null;
let scannerPort = null;
let serialOpen = false;
let activeMode = "disabled";
let deviceInfo = null;
let shuttingDown = false;

export function getLastScan() {
  if (lastScan === null) return null;
  return { value: lastScan, at: lastScanAt || new Date().toISOString() };
}

export function setLastScan(value) {
  lastScan = value;
  lastScanAt = new Date().toISOString();
}

export function getScannerHealth() {
  return {
    configured: activeMode !== "disabled",
    connected: activeMode === "serial" ? serialOpen : Boolean(deviceInfo?.started),
    active_mode: activeMode,
    device: deviceInfo,
    last_scan_at: lastScanAt,
    last_error: lastError
  };
}

async function initSerialScanner({ path, baudRate }) {
  const { SerialPort } = await import("serialport");
  scannerPort = new SerialPort({ path, baudRate, autoOpen: false });
  await new Promise((resolve, reject) => {
    scannerPort.open((err) => (err ? reject(err) : resolve()));
  });
  serialOpen = true;
  lastError = null;
  let buffer = "";
  scannerPort.on("data", (data) => {
    const parsed = appendScanChunk(buffer, data.toString());
    buffer = parsed.rest;
    if (parsed.value) {
      setLastScan(parsed.value);
      logger.info(`[SCANNER] Serial scan received: ${parsed.value}`);
    }
  });
  scannerPort.on("error", (err) => {
    lastError = err.message;
    serialOpen = false;
    logger.error(`[SCANNER] Serial error: ${err.message}`);
  });
  scannerPort.on("close", () => {
    serialOpen = false;
  });
  logger.info(`[SCANNER] Serial scanner listening on ${path} @ ${baudRate}`);
  return {
    started: true,
    mode: "serial",
    path,
    baudRate
  };
}

export async function initScannerInput(options = {}) {
  const mode = String(options.mode || "auto").toLowerCase();
  shuttingDown = false;
  lastError = null;
  deviceInfo = null;
  activeMode = "disabled";

  if (mode === "disabled") {
    logger.info("[SCANNER] Disabled by configuration");
    return { started: false, mode };
  }

  try {
    if (mode === "serial" || (mode === "auto" && options.path)) {
      if (!options.path) {
        throw new Error("scanner_serial_path required for serial mode");
      }
      deviceInfo = await initSerialScanner({
        path: options.path,
        baudRate: options.baudRate || 9600
      });
      activeMode = "serial";
      return deviceInfo;
    }

    if (mode === "usb_hid" || mode === "auto") {
      deviceInfo = await initUsbHidScanner({
        vendorId: options.vendorId,
        productId: options.productId
      });
      if (deviceInfo?.started) {
        activeMode = "usb_hid";
        return deviceInfo;
      }
      lastError = deviceInfo?.reason || "HID scanner not started";
      if (mode === "usb_hid") {
        return deviceInfo;
      }
    }

    if (
      mode === "keyboard_wedge" ||
      (mode === "auto" && options.allowKeyboardWedge)
    ) {
      const started = initKeyboardWedgeScanner();
      deviceInfo = {
        started,
        mode: "keyboard_wedge",
        reason: started ? null : "stdin is not a TTY"
      };
      if (started) {
        activeMode = "keyboard_wedge";
        lastError = null;
      } else {
        lastError = deviceInfo.reason;
      }
      return deviceInfo;
    }

    lastError = lastError || "No scanner listener started";
    logger.warn(`[SCANNER] ${lastError}`);
    return { started: false, mode, reason: lastError };
  } catch (err) {
    lastError = err.message;
    logger.warn(`[SCANNER] Init failed: ${err.message}`);
    return { started: false, mode, reason: err.message };
  }
}

export async function closeScanner() {
  shuttingDown = true;
  closeUsbHidScanner();
  closeKeyboardWedgeScanner();
  if (scannerPort) {
    await new Promise((resolve) => {
      try {
        if (!scannerPort.isOpen) return resolve();
        scannerPort.close(() => resolve());
      } catch {
        resolve();
      }
    });
    scannerPort = null;
    serialOpen = false;
  }
  activeMode = "disabled";
  deviceInfo = null;
}

EventBus.on("barcode", (value) => {
  setLastScan(String(value));
  logger.info(`[SCANNER] Barcode captured: ${String(value)}`);
});
