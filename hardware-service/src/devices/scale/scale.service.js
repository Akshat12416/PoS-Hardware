/**
 * Scale service: exposes last weight and connects to serial scale
 * (Datalogic Magellan 9300i / Remote Weight 8300RD).
 */
import EventBus from "../../events/bus.js";
import logger from "../../utils/logger.js";
import parseWeight from "./scale.parser.js";

let lastWeight = null;
let port = null;

/**
 * @returns {number|null} Last weight value (kg) or null
 */
export function getLastWeight() {
  return lastWeight;
}

/**
 * Initializes serial connection to scale. Call once at startup.
 * @param {Object} options - { path, baudRate }
 * @returns {Promise<void>}
 */
export async function initScale(options = {}) {
  const path = options.path || "COM3";
  const baudRate = options.baudRate || 9600;

  try {
    const { SerialPort } = await import("serialport");
    port = new SerialPort({
      path,
      baudRate,
      autoOpen: true
    });

    let buffer = "";

    port.on("data", (data) => {
      buffer += data.toString();
      if (buffer.includes("\n") || buffer.includes("\r")) {
        const weight = parseWeight(buffer);
        buffer = "";
        if (weight !== null) {
          lastWeight = weight;
          logger.info(`Weight received: ${weight}`);
          EventBus.emit("weight", weight);
        }
      }
    });

    port.on("error", (err) => {
      logger.error(`Scale error: ${err.message}`);
    });

    logger.info(`Scale connected on ${path}`);
  } catch (err) {
    logger.warn(`Scale not available (${err.message}); weight API will return last known.`);
  }
}

/**
 * Optional: set last weight (e.g. from external source or test).
 * @param {number|null} w
 */
export function setLastWeight(w) {
  lastWeight = w;
}
