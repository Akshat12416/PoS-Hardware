/**
 * Rotate the local agent_secret in config.json.
 * Run on the POS PC if the previous secret was shared or committed.
 *
 *   node scripts/rotate-agent-secret.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config.json");

if (!fs.existsSync(configPath)) {
  console.error("config.json not found");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.agent_secret = crypto.randomBytes(32).toString("hex");
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Rotated agent_secret for", config.terminal_uid);
console.log("Update any POS/cloud pairing that stored the old secret.");
