/**
 * Scale service: Datalogic Magellan 9300i / Remote Weight 8300RD over serial.
 * Magellan single-cable RS-232 only replies when polled with S11.
 */
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import parseWeight, { parseMagellan } from "./scale.parser.js";
import { appendScaleChunk } from "./scale.buffer.js";
import { isDemoMode } from "../../utils/demoMode.js";

const POLL_MS = 500;

let lastWeight = null;
let lastWeightAt = null;
let lastRaw = null;
let lastStatus = null;
let lastError = null;
let parseErrors = 0;
let port = null;
let configuredPath = null;
let configuredBaud = 9600;
let configuredProtocol = "magellan";
let configuredUnit = "lb";
let reconnectTimer = null;
let pollTimer = null;
let shuttingDown = false;
let serialOpen = false;

export function getLastWeight() {
  return lastWeight;
}

export function getScaleHealth() {
  const demo = isDemoMode();
  return {
    demo,
    configured: demo ? true : Boolean(configuredPath),
    connected: demo ? true : Boolean(port && serialOpen),
    path: demo ? "DEMO" : configuredPath,
    baud_rate: configuredBaud,
    protocol: demo ? "demo" : configuredProtocol,
    unit: demo ? "kg" : configuredUnit,
    status: lastStatus,
    last_weight: lastWeight,
    last_weight_at: lastWeightAt,
    last_raw: lastRaw,
    last_error: lastError,
    parse_errors: parseErrors
  };
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
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

function handleLine(line) {
  lastRaw = line;

  if (configuredProtocol === "magellan") {
    const reply = parseMagellan(line, configuredUnit);
    if (!reply) {
      parseErrors += 1;
      logger.warn("[SCALE] Unparsed Magellan reply", { raw: line });
      return;
    }
    lastStatus = reply.status;
    if (reply.weight === null) return;
    const changed = reply.weight !== lastWeight;
    lastWeight = reply.weight;
    lastWeightAt = new Date().toISOString();
    if (changed) {
      logger.info(`[SCALE] Weight received: ${reply.weight} ${configuredUnit}`);
      EventBus.emit("weight", reply.weight);
    }
    return;
  }

  const weight = parseWeight(line);
  if (weight !== null) {
    lastWeight = weight;
    lastWeightAt = new Date().toISOString();
    lastStatus = "stable";
    logger.info(`[SCALE] Weight received: ${weight}`);
    EventBus.emit("weight", weight);
  } else {
    parseErrors += 1;
    logger.warn("[SCALE] Unparsed weight line", { raw: line });
  }
}

export async function initScale(options = {}) {
  const path = String(options.path || "").trim();
  const baudRate = options.baudRate || 9600;
  configuredPath = path || null;
  configuredBaud = baudRate;
  configuredProtocol = String(options.protocol || "magellan").toLowerCase();
  configuredUnit = String(options.unit || "lb").toLowerCase();
  shuttingDown = false;

  if (options.demo || isDemoMode()) {
    configuredPath = "DEMO";
    serialOpen = true;
    lastError = null;
    lastRaw = "WT: 1.250 kg";
    setLastWeight(1.25);
    logger.info("[SCALE] DEMO mode — simulated 1.250 kg (no serial port)");
    return { started: true, demo: true };
  }

  if (!path) {
    lastError = "scale_serial_path is not configured";
    logger.warn("[SCALE] No serial path configured");
    return { started: false, reason: lastError };
  }

  const magellan = configuredProtocol === "magellan";
  const dataBits = options.dataBits || (magellan ? 7 : 8);
  const parity = options.parity || (magellan ? "even" : "none");
  const stopBits = options.stopBits || 1;

  async function openPort() {
    const { SerialPort } = await import("serialport");
    stopPolling();
    if (port) {
      try {
        if (port.isOpen) port.close();
      } catch {
        // ignore
      }
      port = null;
    }

    port = new SerialPort({
      path,
      baudRate,
      dataBits,
      parity,
      stopBits,
      autoOpen: false
    });

    await new Promise((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve) => {
      port.set({ dtr: true, rts: true }, (err) => {
        if (err) logger.warn(`[SCALE] Could not raise DTR/RTS: ${err.message}`);
        resolve();
      });
    });

    serialOpen = true;
    lastError = null;
    logger.info(
      `[SCALE] Connected on ${path} @ ${baudRate} ${dataBits}${parity[0].toUpperCase()}${stopBits} (${configuredProtocol})`
    );

    let buffer = "";
    port.on("data", (data) => {
      const parsed = appendScaleChunk(buffer, data.toString());
      buffer = parsed.rest;
      for (const line of parsed.lines) handleLine(line);
    });

    port.on("error", (err) => {
      lastError = err.message;
      serialOpen = false;
      logger.error(`[SCALE] ${err.message}`);
    });

    port.on("close", () => {
      serialOpen = false;
      stopPolling();
      if (!shuttingDown) {
        lastError = lastError || "serial port closed";
        scheduleReconnect(openPort);
      }
    });

    if (magellan) {
      pollTimer = setInterval(() => {
        if (!port || !port.isOpen) return;
        port.write("S11\r", (err) => {
          if (err) {
            lastError = err.message;
            logger.warn(`[SCALE] Poll write failed: ${err.message}`);
          }
        });
      }, POLL_MS);
    }
  }

  try {
    await openPort();
    return { started: true, path, baudRate, protocol: configuredProtocol };
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
  stopPolling();
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
