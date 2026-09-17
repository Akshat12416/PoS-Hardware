/**
 * Software-only checkout demo. No USB/serial/Ingenico required.
 *
 *   npm run demo
 *
 * Starts the hardware agent with DEMO_MODE=true, runs a sample sale
 * (scan → weigh → pay → print → open drawer), then stops the agent.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { fetchWithTimeout } from "../src/utils/fetchWithTimeout.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config.json");
const port = Number(process.env.HARDWARE_PORT || 3011);
const base = `http://127.0.0.1:${port}`;

function ensureConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  const template = JSON.parse(
    fs.readFileSync(path.join(root, "config.template.json"), "utf8")
  );
  template.terminal_uid = "TERM-DEMOLOCAL01";
  template.agent_secret = "demo-local-secret-not-for-production";
  template.store_id = "DEMO-STORE";
  template.approved = true;
  template.registered = true;
  fs.writeFileSync(configPath, JSON.stringify(template, null, 2));
  return template;
}

const config = ensureConfig();
const headers = {
  "Content-Type": "application/json",
  "x-terminal-id": config.terminal_uid,
  "x-agent-secret": config.agent_secret
};

function startAgent() {
  const child = spawn(process.execPath, ["src/hardware-service.js"], {
    cwd: root,
    env: {
      ...process.env,
      DEMO_MODE: "true",
      HARDWARE_PORT: String(port),
      PAX_STRICT_STARTUP: "false",
      PAX_BRIDGE_STARTUP_PROBE: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (buf) => process.stdout.write(`[agent] ${buf}`));
  child.stderr.on("data", (buf) => process.stderr.write(`[agent] ${buf}`));
  return child;
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(`${base}/health`, { timeoutMs: 500 });
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Demo agent did not start on " + base);
}

async function call(label, method, urlPath, body, { expectFailure = false } = {}) {
  const res = await fetchWithTimeout(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    timeoutMs: 8000
  });
  const data = await res.json();
  const ok = res.ok && data.success !== false;
  const passed = expectFailure ? !ok : ok;
  console.log(`${passed ? "PASS" : "FAIL"} ${label} (${res.status})`);
  if (!passed) {
    console.log("     ", JSON.stringify(data));
  }
  return { ok, status: res.status, data };
}

const agent = startAgent();
let failed = 0;

try {
  await waitForHealth();
  console.log("\n=== Software demo checkout (no hardware) ===\n");

  const health = await call("health", "GET", "/health");
  if (!health.data?.demo) {
    console.log("FAIL agent is not in DEMO_MODE");
    failed += 1;
  }

  await call("diagnostics", "GET", "/api/terminal/diagnostics");

  const scan = await call("scan banana barcode", "POST", "/api/scanner/simulate", {
    value: "4011"
  });
  const last = await call("read last scan", "GET", "/api/scanner/last");
  if (last.data?.scan?.value !== "4011") failed += 1;

  await call("set produce weight", "POST", "/api/scale/simulate", { weight: 1.25 });
  const weight = await call("read weight", "GET", "/api/scale/weight");
  if (weight.data?.weight !== 1.25) failed += 1;

  const pay = await call("demo card sale $3.13", "POST", "/api/payment/initiate", {
    amount: 3.13,
    order_id: "DEMO-CART-1"
  });
  if (!pay.data?.approved || !pay.data?.demo) failed += 1;

  const decline = await call(
    "demo decline path (expected HTTP error)",
    "POST",
    "/api/payment/initiate",
    { amount: 1, order_id: "DEMO-DECLINE-1" },
    { expectFailure: true }
  );
  if (decline.ok) {
    console.log("FAIL decline path should not return HTTP success");
    failed += 1;
  }

  const printed = await call("print demo receipt", "POST", "/api/printer/print", {
    items: [{ name: "Bananas", qty: 1, price: 3.13 }],
    total: 3.13,
    payment: {
      card_type: "VISA",
      card_number_masked: "****4242",
      status: "DEMO APPROVED",
      reference: pay.data?.transactionId
    }
  });
  if (!printed.data?.receipt_text) failed += 1;
  else {
    console.log("\n----- demo receipt -----\n");
    console.log(printed.data.receipt_text);
    console.log("------------------------\n");
  }

  const drawer = await call("open cash drawer", "POST", "/api/cash-drawer/open");
  if (!drawer.data?.demo && !drawer.ok) failed += 1;

  if (!scan.ok) failed += 1;
  if (!pay.ok) failed += 1;
  if (!printed.ok) failed += 1;
  if (!drawer.ok) failed += 1;

  console.log(
    failed
      ? `\nDemo finished with ${failed} check(s) failed.`
      : "\nDemo finished: software checkout path works without hardware."
  );
} catch (err) {
  console.error("Demo failed:", err.message);
  failed += 1;
} finally {
  agent.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
}

process.exit(failed ? 1 : 0);
