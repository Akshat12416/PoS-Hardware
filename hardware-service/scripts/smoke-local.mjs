/**
 * Local agent smoke test. Requires the hardware agent on 127.0.0.1:3001
 * and config.json with terminal_uid / agent_secret.
 *
 *   node scripts/smoke-local.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchWithTimeout } from "../src/utils/fetchWithTimeout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const configPath = path.join(root, "config.json");
const base = process.env.HARDWARE_URL || "http://127.0.0.1:3001";

if (!fs.existsSync(configPath)) {
  console.error("config.json not found. Copy config.template.json first.");
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const headers = {
  "Content-Type": "application/json",
  "x-terminal-id": config.terminal_uid,
  "x-agent-secret": config.agent_secret
};

const requestId = `smoke-${Date.now()}`;
const results = [];

async function call(name, method, urlPath, body) {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(`${base}${urlPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: 8000
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    const row = {
      name,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      data
    };
    results.push(row);
    console.log(`${row.ok ? "PASS" : "FAIL"} ${name} (${row.status}, ${row.ms}ms)`);
    return row;
  } catch (err) {
    const row = { name, ok: false, error: err.message };
    results.push(row);
    console.log(`FAIL ${name} ${err.message}`);
    return row;
  }
}

const health = await call("health", "GET", "/health");
if (!health.ok) {
  console.error("Hardware agent is not reachable at", base);
  process.exit(2);
}

await call("whoami", "GET", "/api/terminal/whoami");
await call("diagnostics", "GET", "/api/terminal/diagnostics");
await call("printer.list", "GET", "/api/printer/list");
await call("scanner.status", "GET", "/api/scanner/status");
await call("scanner.simulate", "POST", "/api/scanner/simulate", {
  value: `${requestId}-barcode`
});
await call("scanner.last", "GET", "/api/scanner/last");
await call("scale.status", "GET", "/api/scale/status");
await call("scale.weight", "GET", "/api/scale/weight");
await call("drawer.status", "GET", "/api/cash-drawer/status");
await call("keyboard.status", "GET", "/api/keyboard/status");
await call("display.status", "GET", "/api/display/status");
await call("payment.status", "GET", "/api/payment/status");

const failed = results.filter((r) => !r.ok);
console.log("");
console.log(`request_id=${requestId} passed=${results.length - failed.length} failed=${failed.length}`);
if (failed.length) process.exit(1);
