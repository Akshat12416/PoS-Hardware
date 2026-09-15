// src/config.js
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const CONFIG_PATH = path.resolve("./config.json");

let config = {
  version: 1,

  terminal_uid: null,
  agent_secret: null,

  store_id: null,
  cloud_url: process.env.CLOUD_URL || "https://pos-7mvx.onrender.com",

  registered: false,
  approved: false,

  created_at: null,
  last_boot_at: null,

  /** Scale (Datalogic Magellan 9300i / Remote Weight 8300RD) */
  scale_serial_path: process.env.SCALE_SERIAL_PATH || "COM3",
  scale_baud_rate: Number(process.env.SCALE_BAUD_RATE) || 9600,

  /** Cash drawer (M-S CF-405BX-M-B) - serial port or empty to use printer kick */
  cash_drawer_serial_path: process.env.CASH_DRAWER_SERIAL_PATH || "",

  /** Barcode scanner (Zebra DS2278) - HID; no config required for keyboard-mode */
  scanner_serial_path: process.env.SCANNER_SERIAL_PATH || "",
  scanner_baud_rate: Number(process.env.SCANNER_BAUD_RATE) || 9600,
  scanner_hid_vendor_id: Number(process.env.SCANNER_HID_VENDOR_ID) || null,
  scanner_hid_product_id: Number(process.env.SCANNER_HID_PRODUCT_ID) || null,
  /** Payment terminal — Ingenico Lane/3600 via CWS bridge (legacy config keys: pax_*) */
  payment_terminal_type: process.env.PAYMENT_TERMINAL_TYPE || "ingenico",
  payment_terminal_model:
    process.env.PAYMENT_TERMINAL_MODEL || "LAN360-USPOS16A",
  payment_terminal_serial: process.env.PAYMENT_TERMINAL_SERIAL || "",
  payment_terminal_connection: process.env.PAYMENT_TERMINAL_CONNECTION || "usb",
  pax_enabled: process.env.PAX_ENABLED === "true",
  pax_bridge_url:
    process.env.PAX_BRIDGE_URL !== undefined
      ? String(process.env.PAX_BRIDGE_URL)
      : "",
  pax_strict_startup: process.env.PAX_STRICT_STARTUP === "true",
  pax_bridge_startup_probe: process.env.PAX_BRIDGE_STARTUP_PROBE === "true",
  pax_terminal_id: process.env.PAX_TERMINAL_ID || null,
  pax_terminal_ip: process.env.PAX_TERMINAL_IP || "",
  pax_terminal_port: Number(process.env.PAX_TERMINAL_PORT) || 10009,
  pax_timeout_ms: Number(process.env.PAX_TIMEOUT_MS) || 120000,

  /** Receipt formatting */
  receipt_company_name:
    process.env.RECEIPT_COMPANY_NAME || "Southwest Farmers",
  /** POS Keyboard (Cherry SPOS) / Touchscreen (Planar) - input/display */
};

/* ----------------------------------------------------
   Load existing config if present
---------------------------------------------------- */
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    config = { ...config, ...loaded };
  } catch (err) {
    console.error("❌ Failed to parse config.json:", err.message);
    process.exit(1);
  }
}

/* Env wins over config.json for PAX flags (production .env on the POS PC) */
if (process.env.PAX_ENABLED !== undefined) {
  config.pax_enabled = process.env.PAX_ENABLED === "true";
}
if (process.env.PAX_BRIDGE_URL !== undefined) {
  config.pax_bridge_url = String(process.env.PAX_BRIDGE_URL);
}
if (process.env.PAX_STRICT_STARTUP !== undefined) {
  config.pax_strict_startup = process.env.PAX_STRICT_STARTUP === "true";
}
if (process.env.PAX_BRIDGE_STARTUP_PROBE !== undefined) {
  config.pax_bridge_startup_probe =
    process.env.PAX_BRIDGE_STARTUP_PROBE === "true";
}

/* ----------------------------------------------------
   Generate identity if missing
---------------------------------------------------- */
let identityCreated = false;

if (!config.terminal_uid) {
  config.terminal_uid =
    "TERM-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  identityCreated = true;
}

if (!config.agent_secret) {
  config.agent_secret = crypto.randomBytes(32).toString("hex");
  identityCreated = true;
}

if (!config.created_at) {
  config.created_at = new Date().toISOString();
}

/* ----------------------------------------------------
   Persist identity if newly created
---------------------------------------------------- */
if (identityCreated) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("New hardware terminal identity created:", config.terminal_uid);
}

/* ----------------------------------------------------
   Update boot timestamp (every start)
---------------------------------------------------- */
config.last_boot_at = new Date().toISOString();

try {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
} catch (err) {
  console.error("❌ Failed to persist config.json:", err.message);
  process.exit(1);
}

/* ----------------------------------------------------
   Startup log
---------------------------------------------------- */
console.log("Hardware terminal UID:", config.terminal_uid);

export { config };
