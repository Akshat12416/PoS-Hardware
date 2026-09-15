/**
 * Scanner service: stores last scan from Zebra DS2278 (or any HID/keyboard-mode scanner).
 * Devices emit "barcode" on EventBus; this service stores and exposes it.
 */
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";

let lastScan = null;
let lastScanAt = null;
let scannerPort = null;

/**
 * @returns {{ value: string, at: string } | null} Last barcode and timestamp
 */
export function getLastScan() {
  if (lastScan === null) return null;
  return { value: lastScan, at: lastScanAt || new Date().toISOString() };
}

/**
 * Set last scan (e.g. from EventBus or test).
 * @param {string} value - Barcode string
 */
export function setLastScan(value) {
  lastScan = value;
  lastScanAt = new Date().toISOString();
}

/**
 * Initializes serial scanner capture (optional).
 * Use when scanner is configured in serial COM mode instead of keyboard wedge mode.
 * @param {{ path?: string, baudRate?: number }} options
 */
export async function initScanner(options = {}) {
  const path = options.path;
  if (!path) return;

  const baudRate = options.baudRate || 9600;
  try {
    const { SerialPort } = await import("serialport");
    scannerPort = new SerialPort({ path, baudRate, autoOpen: true });
    let buffer = "";

    scannerPort.on("data", (data) => {
      buffer += data.toString();
      if (buffer.includes("\n") || buffer.includes("\r")) {
        const value = buffer.trim();
        buffer = "";
        if (value) {
          setLastScan(value);
          logger.info(`[SCANNER] Serial scan received: ${value}`);
        }
      }
    });

    scannerPort.on("error", (err) => {
      logger.error(`[SCANNER] Serial error: ${err.message}`);
    });

    logger.info(`[SCANNER] Serial scanner listening on ${path} @ ${baudRate}`);
  } catch (err) {
    logger.warn(`[SCANNER] Serial scanner unavailable (${err.message})`);
  }
}

EventBus.on("barcode", (value) => {
  setLastScan(String(value));
  logger.info(`[SCANNER] Barcode captured: ${String(value)}`);
});
