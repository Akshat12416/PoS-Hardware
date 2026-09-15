import fs from "fs";
import path from "path";
import crypto from "crypto";
import { validateConfig } from "./config/validateConfig.js";

export const CONFIG_PATH = path.resolve("./config.json");

function envFlag(name, fallback = false) {
  if (process.env[name] === undefined) return fallback;
  return process.env[name] === "true";
}

function envNumber(name, fallback) {
  if (process.env[name] === undefined || process.env[name] === "") {
    return fallback;
  }
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

function envString(name, fallback = "") {
  if (process.env[name] === undefined) return fallback;
  return String(process.env[name]);
}

let config = {
  version: 1,

  terminal_uid: null,
  agent_secret: null,

  store_id: null,
  cloud_url: envString("CLOUD_URL", "https://pos-7mvx.onrender.com"),

  registered: false,
  approved: false,

  created_at: null,
  last_boot_at: null,

  printer_name: envString("PRINTER_NAME", "EPSON TM-T88V Receipt"),

  scale_serial_path: envString("SCALE_SERIAL_PATH", ""),
  scale_baud_rate: envNumber("SCALE_BAUD_RATE", 9600),

  cash_drawer_mode: envString("CASH_DRAWER_MODE", "unconfigured"),
  cash_drawer_serial_path: envString("CASH_DRAWER_SERIAL_PATH", ""),
  cash_drawer_baud_rate: envNumber("CASH_DRAWER_BAUD_RATE", 9600),

  scanner_mode: envString("SCANNER_MODE", "auto"),
  scanner_serial_path: envString("SCANNER_SERIAL_PATH", ""),
  scanner_baud_rate: envNumber("SCANNER_BAUD_RATE", 9600),
  scanner_hid_vendor_id: envNumber("SCANNER_HID_VENDOR_ID", null),
  scanner_hid_product_id: envNumber("SCANNER_HID_PRODUCT_ID", null),
  scanner_allow_keyboard_wedge: envFlag("SCANNER_ALLOW_KEYBOARD_WEDGE", false),

  /** Payment terminal — Ingenico Lane/3600 via CWS bridge (legacy config keys: pax_*) */
  payment_terminal_type: envString("PAYMENT_TERMINAL_TYPE", "ingenico"),
  payment_terminal_model: envString("PAYMENT_TERMINAL_MODEL", "LAN360-USPOS16A"),
  payment_terminal_serial: envString("PAYMENT_TERMINAL_SERIAL", ""),
  payment_terminal_connection: envString("PAYMENT_TERMINAL_CONNECTION", "usb"),
  pax_enabled: envFlag("PAX_ENABLED", false),
  pax_bridge_url: envString("PAX_BRIDGE_URL", ""),
  pax_strict_startup: envFlag("PAX_STRICT_STARTUP", false),
  pax_bridge_startup_probe: envFlag("PAX_BRIDGE_STARTUP_PROBE", false),
  pax_terminal_id: process.env.PAX_TERMINAL_ID || null,
  pax_terminal_ip: envString("PAX_TERMINAL_IP", ""),
  pax_terminal_port: envNumber("PAX_TERMINAL_PORT", 10009),
  pax_timeout_ms: envNumber("PAX_TIMEOUT_MS", 120000),

  receipt_company_name: envString("RECEIPT_COMPANY_NAME", "Southwest Farmers")
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    config = { ...config, ...loaded };
  } catch (err) {
    console.error("Failed to parse config.json:", err.message);
    process.exit(1);
  }
}

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
if (process.env.PRINTER_NAME !== undefined) {
  config.printer_name = String(process.env.PRINTER_NAME);
}
if (process.env.SCANNER_MODE !== undefined) {
  config.scanner_mode = String(process.env.SCANNER_MODE);
}
if (process.env.CASH_DRAWER_MODE !== undefined) {
  config.cash_drawer_mode = String(process.env.CASH_DRAWER_MODE);
}
if (process.env.CASH_DRAWER_BAUD_RATE !== undefined) {
  config.cash_drawer_baud_rate = envNumber("CASH_DRAWER_BAUD_RATE", 9600);
}

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

export function persistConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

if (identityCreated) {
  persistConfig();
  console.log("New hardware terminal identity created:", config.terminal_uid);
}

config.last_boot_at = new Date().toISOString();

try {
  persistConfig();
} catch (err) {
  console.error("Failed to persist config.json:", err.message);
  process.exit(1);
}

const validation = validateConfig(config);
for (const warning of validation.warnings) {
  console.warn("[CONFIG]", warning);
}
if (validation.errors.length) {
  for (const error of validation.errors) {
    console.error("[CONFIG]", error);
  }
  if (config.pax_strict_startup) {
    process.exit(1);
  }
}

console.log("Hardware terminal UID:", config.terminal_uid);

export { config };
