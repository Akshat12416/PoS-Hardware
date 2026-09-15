import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";

const HID_USAGE_ENTER = 40;
const HID_USAGE_TAB = 43;
const HID_USAGE_A = 4;
const HID_USAGE_Z = 29;
const HID_USAGE_1 = 30;
const HID_USAGE_0 = 39;
const LEFT_SHIFT_MASK = 0x02;
const RIGHT_SHIFT_MASK = 0x20;
const SCAN_IDLE_FLUSH_MS = 120;

const shiftedNumberMap = {
  30: "!",
  31: "@",
  32: "#",
  33: "$",
  34: "%",
  35: "^",
  36: "&",
  37: "*",
  38: "(",
  39: ")"
};

const symbolMap = {
  44: " ", 45: "-", 46: "=", 47: "[", 48: "]", 49: "\\",
  51: ";", 52: "'", 53: "`", 54: ",", 55: ".", 56: "/"
};

const shiftedSymbolMap = {
  45: "_", 46: "+", 47: "{", 48: "}", 49: "|",
  51: ":", 52: "\"", 53: "~", 54: "<", 55: ">", 56: "?"
};

function usageToChar(usageId, shifted) {
  if (usageId >= HID_USAGE_A && usageId <= HID_USAGE_Z) {
    const base = String.fromCharCode("a".charCodeAt(0) + (usageId - HID_USAGE_A));
    return shifted ? base.toUpperCase() : base;
  }

  if (usageId >= HID_USAGE_1 && usageId <= HID_USAGE_0) {
    if (shifted) return shiftedNumberMap[usageId] || "";
    return usageId === HID_USAGE_0 ? "0" : String(usageId - HID_USAGE_1 + 1);
  }

  if (shifted) return shiftedSymbolMap[usageId] || symbolMap[usageId] || "";
  return symbolMap[usageId] || "";
}

export async function initUsbHidScanner(options = {}) {
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

  const candidates = devices.filter((d) => {
    if (vendorId && d.vendorId !== vendorId) return false;
    if (productId && d.productId !== productId) return false;
    if (typeof d.usagePage === "number" && d.usagePage !== 1) return false; // Generic desktop
    if (typeof d.usage === "number" && d.usage !== 6) return false; // Keyboard
    return Boolean(d.path);
  });

  if (candidates.length === 0) {
    logger.warn("[SCANNER] No matching keyboard HID scanner device found");
    return { started: false, reason: "no matching hid keyboard device" };
  }

  const prioritized = candidates.sort((a, b) => {
    const scannerRegex = /(zebra|symbol|honeywell|datalogic|scanner|barcode)/i;
    const aText = `${a.product || ""} ${a.manufacturer || ""}`;
    const bText = `${b.product || ""} ${b.manufacturer || ""}`;
    const aScore = scannerRegex.test(aText) ? 1 : 0;
    const bScore = scannerRegex.test(bText) ? 1 : 0;
    return bScore - aScore;
  });

  const candidate = prioritized[0];
  let device;
  try {
    device = new HID.HID(candidate.path);
  } catch (err) {
    logger.warn(`[SCANNER] Failed to open HID device (${err.message})`);
    return { started: false, reason: "failed opening hid device" };
  }

  let buffer = "";
  let flushTimer = null;
  let lastUsageId = null;

  function flush() {
    const value = buffer.trim();
    buffer = "";
    if (!value) return;
    EventBus.emit("barcode", value);
    logger.info(`[SCANNER] USB HID scan received: ${value}`);
  }

  device.on("data", (data) => {
    const bytes = Array.from(data || []);
    if (bytes.length < 3) return;

    const modifiers = bytes[0] || 0;
    const shifted = Boolean(modifiers & LEFT_SHIFT_MASK || modifiers & RIGHT_SHIFT_MASK);
    const usageIds = bytes.slice(2).filter((u) => u > 0);
    if (usageIds.length === 0) {
      lastUsageId = null;
      return;
    }

    for (const usageId of usageIds) {
      // Ignore key repeat while key is held down.
      if (usageId === lastUsageId) continue;
      lastUsageId = usageId;

      if (usageId === HID_USAGE_ENTER || usageId === HID_USAGE_TAB) {
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

  device.on("error", (err) => {
    logger.error(`[SCANNER] USB HID error: ${err.message}`);
  });

  logger.info(
    `[SCANNER] USB HID scanner listening vendorId=${candidate.vendorId} productId=${candidate.productId} product=${candidate.product || "unknown"}`
  );

  return {
    started: true,
    vendorId: candidate.vendorId,
    productId: candidate.productId
  };
}

