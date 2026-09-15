/**
 * Cash drawer (M-S CF-405BX-M-B) open via serial ESC/POS.
 * Typical command: ESC p m t1 t2 (27 112 48 55 121) or vendor-specific.
 */
import logger from "../../utils/logger.js";

/** ESC p 0 7 y - common open drawer command (pulse pin 2) */
const OPEN_DRAWER_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x37, 0x79]);

/**
 * Opens the cash drawer via serial (M-S CF-405BX-M-B).
 * @param {string} serialPath - e.g. COM4
 * @returns {Promise<void>}
 */
export async function openDrawer(serialPath) {
  if (!serialPath || !serialPath.trim()) {
    throw new Error("Cash drawer serial path not configured (CASH_DRAWER_SERIAL_PATH)");
  }

  const { SerialPort } = await import("serialport");
  const drawerPort = new SerialPort({
    path: serialPath.trim(),
    baudRate: 9600,
    autoOpen: true
  });

  return new Promise((resolve, reject) => {
    drawerPort.once("open", () => {
      drawerPort.write(OPEN_DRAWER_CMD, (err) => {
        if (err) {
          drawerPort.close(() => reject(err));
          return;
        }
        logger.info("Cash drawer open command sent");
        drawerPort.close(() => resolve());
      });
    });
    drawerPort.once("error", (err) => {
      logger.error(`Cash drawer error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Returns true if cash drawer is configured (serial path set).
 * @param {string} serialPath
 * @returns {boolean}
 */
export function isConfigured(serialPath) {
  return Boolean(serialPath && String(serialPath).trim());
}
