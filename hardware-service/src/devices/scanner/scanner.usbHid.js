import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import {
  usageToChar,
  isTerminatorUsage,
  LEFT_SHIFT_MASK,
  RIGHT_SHIFT_MASK
} from "./hidDecode.js";

const SCAN_IDLE_FLUSH_MS = 120;
const SCANNER_NAME = /(zebra|symbol|honeywell|datalogic|scanner|barcode)/i;
const KEYBOARD_EXCLUDE = /(cherry|spos|keyboard|planar)/i;

let hidDevice = null;
let flushTimer = null;

export async function initUsbHidScanner(options = {}) {
  closeUsbHidScanner();

  let hidLib;
  try {
    hidLib = await import("node-hid");
  } catch (err) {
    logger.warn(`[SCANNER] node-hid unavailable (${err.message})`);
    return { started: false, reason: "node-hid unavailable" };
  }

  const HID = hidLib?.default || hidLib;
  const devices = HID?.devices ? HID.devices() : [];
  if (!Array.isArray(devices) || devices.length === 0) {
    logger.warn("[SCANNER] No HID devices found");
    return { started: false, reason: "no hid devices" };
  }

  const vendorId = Number(options.vendorId) || null;
  const productId = Number(options.productId) || null;
  const explicitId = Boolean(vendorId || productId);

  const candidates = devices.filter((d) => {
    if (vendorId && d.vendorId !== vendorId) return false;
    if (productId && d.productId !== productId) return false;
    if (typeof d.usagePage === "number" && d.usagePage !== 1) return false;
    if (typeof d.usage === "number" && d.usage !== 6) return false;
    if (!d.path) return false;
    if (!explicitId) {
      const text = `${d.product || ""} ${d.manufacturer || ""}`;
      if (KEYBOARD_EXCLUDE.test(text)) return false;
      if (!SCANNER_NAME.test(text)) return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    const reason = explicitId
      ? "no matching HID device for configured VID/PID"
      : "no Zebra/scanner-named HID device (Cherry keyboard ignored)";
    logger.warn(`[SCANNER] ${reason}`);
    return { started: false, reason };
  }

  const prioritized = candidates.sort((a, b) => {
    const aText = `${a.product || ""} ${a.manufacturer || ""}`;
    const bText = `${b.product || ""} ${b.manufacturer || ""}`;
    const aScore = SCANNER_NAME.test(aText) ? 1 : 0;
    const bScore = SCANNER_NAME.test(bText) ? 1 : 0;
    return bScore - aScore;
  });

  const candidate = prioritized[0];
  try {
    hidDevice = new HID.HID(candidate.path);
  } catch (err) {
    logger.warn(`[SCANNER] Failed to open HID device (${err.message})`);
    return { started: false, reason: "failed opening hid device" };
  }

  let buffer = "";
  let lastUsageId = null;

  function flush() {
    const value = buffer.trim();
    buffer = "";
    if (!value) return;
    EventBus.emit("barcode", value);
    logger.info(`[SCANNER] USB HID scan received: ${value}`);
  }

  hidDevice.on("data", (data) => {
    const bytes = Array.from(data || []);
    if (bytes.length < 3) return;

    const modifiers = bytes[0] || 0;
    const shifted = Boolean(
      modifiers & LEFT_SHIFT_MASK || modifiers & RIGHT_SHIFT_MASK
    );
    const usageIds = bytes.slice(2).filter((u) => u > 0);
    if (usageIds.length === 0) {
      lastUsageId = null;
      return;
    }

    for (const usageId of usageIds) {
      if (usageId === lastUsageId) continue;
      lastUsageId = usageId;

      if (isTerminatorUsage(usageId)) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flush();
        continue;
      }

      const ch = usageToChar(usageId, shifted);
      if (!ch) continue;
      buffer += ch;

      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, SCAN_IDLE_FLUSH_MS);
    }
  });

  let readFailed = false;
  hidDevice.on("error", (err) => {
    if (readFailed) return;
    readFailed = true;
    logger.error(`[SCANNER] USB HID error: ${err.message}`);
    closeUsbHidScanner();
    if (typeof options.onReadError === "function") {
      options.onReadError(err);
    }
  });

  logger.info(
    `[SCANNER] USB HID scanner listening vendorId=${candidate.vendorId} productId=${candidate.productId} product=${candidate.product || "unknown"}`
  );

  return {
    started: true,
    mode: "usb_hid",
    vendorId: candidate.vendorId,
    productId: candidate.productId,
    product: candidate.product || null,
    manufacturer: candidate.manufacturer || null
  };
}

export function closeUsbHidScanner() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!hidDevice) return;
  try {
    hidDevice.removeAllListeners();
    hidDevice.close();
  } catch {
    // ignore
  }
  hidDevice = null;
}
