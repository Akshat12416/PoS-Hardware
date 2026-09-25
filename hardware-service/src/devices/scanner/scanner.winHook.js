/**
 * Windows fallback for a scanner that types like a keyboard.
 * Used when node-hid can see the Symbol/Zebra device but cannot read it.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import {
  createWedgeState,
  pushWedgeKey,
  flushIdleWedge,
  WEDGE_IDLE_MS
} from "./wedgeBuffer.js";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/barcode-hook.ps1"
);

let child = null;
let wedgeState = createWedgeState();
let idleTimer = null;

function emitScan(value) {
  EventBus.emit("barcode", value);
  logger.info(`[SCANNER] Keyboard scan received: ${value}`);
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export function startWindowsWedgeCapture() {
  if (process.platform !== "win32") {
    return { started: false, reason: "windows keyboard capture is only supported on win32" };
  }
  if (child) return { started: true, mode: "keyboard_wedge" };

  wedgeState = createWedgeState();
  child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );

  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    const token = String(line || "").trim();
    if (!token || token === "HOOK_READY") return;
    const result = pushWedgeKey(wedgeState, token, Date.now());
    wedgeState = result.state;
    clearIdleTimer();
    if (result.value) {
      emitScan(result.value);
      return;
    }
    if (!wedgeState.buffer) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      const flushed = flushIdleWedge(wedgeState, Date.now());
      wedgeState = flushed.state;
      if (flushed.value) emitScan(flushed.value);
    }, WEDGE_IDLE_MS);
  });

  child.stderr.on("data", (buf) => {
    const text = String(buf || "").trim();
    if (text) logger.warn(`[SCANNER] Keyboard hook: ${text}`);
  });

  child.on("exit", (code) => {
    logger.warn(`[SCANNER] Keyboard hook exited (${code})`);
    child = null;
  });

  logger.info("[SCANNER] Windows keyboard capture started");
  return { started: true, mode: "keyboard_wedge" };
}

export function stopWindowsWedgeCapture() {
  clearIdleTimer();
  if (!child) return;
  const running = child;
  child = null;
  try {
    running.kill();
  } catch {
    // ignore
  }
}
