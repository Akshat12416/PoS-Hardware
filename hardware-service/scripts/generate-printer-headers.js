#!/usr/bin/env node
/**
 * Generate X-Terminal-UID, X-Timestamp, X-Signature for Postman (printer routes).
 * Usage: node scripts/generate-printer-headers.js GET /api/printer/list
 * Or:    node scripts/generate-printer-headers.js POST /api/printer/print
 *
 * Set terminal_uid and agent_secret in config.json (or pass as env).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

const configPath = path.resolve(process.cwd(), "config.json");
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : {};
const terminalUid = process.env.TERMINAL_UID || config.terminal_uid;
const agentSecret = process.env.AGENT_SECRET || config.agent_secret;

const method = (process.argv[2] || "GET").toUpperCase();
const pathOnly = process.argv[3] || "/api/printer/list";

if (!terminalUid || !agentSecret) {
  console.error("Set terminal_uid and agent_secret in config.json or TERMINAL_UID, AGENT_SECRET env");
  process.exit(1);
}

const timestamp = Date.now().toString();
const payload = `${terminalUid}|${timestamp}|${method}|${pathOnly}`;
const signature = crypto.createHmac("sha256", agentSecret).update(payload).digest("hex");

console.log("Add these headers in Postman:\n");
console.log("X-Terminal-UID:", terminalUid);
console.log("X-Timestamp:", timestamp);
console.log("X-Signature:", signature);
