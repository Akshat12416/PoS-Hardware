import readline from "readline";
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";

let keypressHandler = null;
let rawModeEnabled = false;
let flushTimer = null;

export function initKeyboardWedgeScanner() {
  closeKeyboardWedgeScanner();

  if (!process.stdin.isTTY) {
    logger.warn("[SCANNER] stdin is not TTY; keyboard wedge capture disabled");
    return false;
  }

  let buffer = "";

  function flushBuffer() {
    const value = buffer.trim();
    buffer = "";
    if (!value) return;
    EventBus.emit("barcode", value);
    logger.info(`[SCANNER] Keyboard wedge scan received: ${value}`);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  rawModeEnabled = true;
  logger.info("[SCANNER] Keyboard wedge capture initialized");

  keypressHandler = (str, key) => {
    const name = key?.name || "";
    const isTerminator = name === "return" || name === "enter" || name === "tab";

    if (isTerminator) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushBuffer();
      return;
    }

    if (key?.ctrl || key?.meta) return;

    if (typeof str === "string" && str.length > 0) {
      buffer += str;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBuffer();
      }, 120);
    }
  };

  process.stdin.on("keypress", keypressHandler);
  return true;
}

export function closeKeyboardWedgeScanner() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (keypressHandler) {
    process.stdin.off("keypress", keypressHandler);
    keypressHandler = null;
  }
  if (rawModeEnabled && process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore
    }
    rawModeEnabled = false;
  }
}
