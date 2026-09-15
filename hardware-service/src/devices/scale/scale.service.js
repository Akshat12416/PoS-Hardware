/**
 * Scale service: Datalogic Magellan 9300i / Remote Weight 8300RD over serial.
 * Status reflects the real port. Parser stays tolerant until Magellan samples are confirmed.
 */
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import parseWeight from "./scale.parser.js";

let lastWeight = null;
let lastWeightAt = null;
let lastRaw = null;
let lastError = null;
let parseErrors = 0;
let port = null;
let configuredPath = null;
let configuredBaud = 9600;
let reconnectTimer = null;
let shuttingDown = false;
let serialOpen = false;

export function getLastWeight() {
  return lastWeight;
}

export function getScaleHealth() {
  return {
    configured: Boolean(configuredPath),
    connected: Boolean(port && serialOpen),
    path: configuredPath,
    baud_rate: configuredBaud,
    last_weight: lastWeight,
    last_weight_at: lastWeightAt,
    last_raw: lastRaw,
    last_error: lastError,
    parse_errors: parseErrors
  };
}

function scheduleReconnect(openPort) {
  if (shuttingDown || reconnectTimer || !configuredPath) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openPort().catch((err) => {
      lastError = err.message;
      logger.warn(`[SCALE] Reconnect failed: ${err.message}`);
      scheduleReconnect(openPort);
    });
  }, 5000);
}

export async function initScale(options = {}) {
  const path = String(options.path || "").trim();
  const baudRate = options.baudRate || 9600;
  configuredPath = path || null;
  configuredBaud = baudRate;
  shuttingDown = false;

  if (!path) {
    lastError = "scale_serial_path is not configured";
    logger.warn("[SCALE] No serial path configured");
    return { started: false, reason: lastError };
  }

  async function openPort() {
    const { SerialPort } = await import("serialport");
    if (port) {
      try {
        if (port.isOpen) port.close();
      } catch {
        // ignore
      }
      port = null;
    }

    port = new SerialPort({ path, baudRate, autoOpen: false });

    await new Promise((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });

    serialOpen = true;
    lastError = null;
    logger.info(`[SCALE] Connected on ${path} @ ${baudRate}`);

    let buffer = "";
    port.on("data", (data) => {
      buffer += data.toString();
      if (buffer.includes("\n") || buffer.includes("\r")) {
        lastRaw = buffer.trim();
        const weight = parseWeight(buffer);
        buffer = "";
        if (weight !== null) {
          lastWeight = weight;
          lastWeightAt = new Date().toISOString();
          logger.info(`[SCALE] Weight received: ${weight}`);
          EventBus.emit("weight", weight);
        } else {
          parseErrors += 1;
          logger.warn("[SCALE] Unparsed weight line", { raw: lastRaw });
        }
      }
    });

    port.on("error", (err) => {
      lastError = err.message;
      serialOpen = false;
      logger.error(`[SCALE] ${err.message}`);
    });

    port.on("close", () => {
      serialOpen = false;
      if (!shuttingDown) {
        lastError = lastError || "serial port closed";
        scheduleReconnect(openPort);
      }
    });
  }

  try {
    await openPort();
    return { started: true, path, baudRate };
  } catch (err) {
    lastError = err.message;
    serialOpen = false;
    logger.warn(`[SCALE] Not available (${err.message})`);
    scheduleReconnect(openPort);
    return { started: false, reason: err.message };
  }
}

export async function closeScale() {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!port) return;
  await new Promise((resolve) => {
    try {
      if (!port.isOpen) return resolve();
      port.close(() => resolve());
    } catch {
      resolve();
    }
  });
  port = null;
  serialOpen = false;
}

export function setLastWeight(w) {
  lastWeight = w;
  lastWeightAt = w == null ? null : new Date().toISOString();
}
