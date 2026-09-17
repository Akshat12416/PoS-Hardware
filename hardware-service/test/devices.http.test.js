import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchWithTimeout } from "../src/utils/fetchWithTimeout.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
const port = Number(process.env.HARDWARE_TEST_PORT || 3013);
const base = `http://127.0.0.1:${port}`;
const headers = {
  "Content-Type": "application/json",
  "x-terminal-id": config.terminal_uid,
  "x-agent-secret": config.agent_secret
};

let agent = null;

async function call(method, urlPath, body, extraHeaders = {}) {
  const res = await fetchWithTimeout(`${base}${urlPath}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
    timeoutMs: 8000
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(`${base}/health`, { timeoutMs: 400 });
      if (res.ok) return await res.json();
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Test agent did not start on ${base}: ${lastError?.message || "no response"}`
  );
}

function stopAgent() {
  if (!agent || agent.killed) return;
  try {
    agent.kill("SIGTERM");
  } catch {
    // ignore
  }
}

before(async () => {
  agent = spawn(process.execPath, ["src/hardware-service.js"], {
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
  let startup = "";
  agent.stderr.on("data", (buf) => {
    startup += buf.toString();
  });
  agent.stdout.on("data", (buf) => {
    startup += buf.toString();
  });
  agent.on("exit", (code, signal) => {
    if (code && code !== 0) {
      startup += `\n[agent exit ${code} ${signal || ""}]`;
    }
  });
  try {
    await waitForHealth();
  } catch (err) {
    stopAgent();
    throw new Error(`${err.message}\n${startup.slice(-2000)}`);
  }
});

after(async () => {
  stopAgent();
  await new Promise((r) => setTimeout(r, 400));
  if (agent && !agent.killed) {
    try {
      agent.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
});

test("health reports demo agent", async () => {
  const { status, data } = await call("GET", "/health");
  assert.equal(status, 200);
  assert.equal(data.demo, true);
  assert.equal(data.role, "hardware-agent");
});

test("device APIs reject missing credentials", async () => {
  const res = await fetchWithTimeout(`${base}/api/scanner/status`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    timeoutMs: 5000
  });
  assert.equal(res.status, 401);
});

test("scanner simulate and last scan", async () => {
  const status = await call("GET", "/api/scanner/status");
  assert.equal(status.data.connected, true);
  assert.equal(status.data.demo, true);

  const bad = await call("POST", "/api/scanner/simulate", { value: "  " });
  assert.equal(bad.status, 400);

  const scan = await call("POST", "/api/scanner/simulate", { value: "4011" });
  assert.equal(scan.status, 200);
  assert.equal(scan.data.scan.value, "4011");

  const last = await call("GET", "/api/scanner/last");
  assert.equal(last.data.scan.value, "4011");
});

test("scale simulate and weight", async () => {
  const status = await call("GET", "/api/scale/status");
  assert.equal(status.data.connected, true);
  assert.equal(status.data.demo, true);

  const set = await call("POST", "/api/scale/simulate", { weight: 1.25 });
  assert.equal(set.status, 200);
  assert.equal(set.data.weight, 1.25);

  const fromString = await call("POST", "/api/scale/simulate", {
    value: "WT: 2.500 kg"
  });
  assert.equal(fromString.status, 200);
  assert.equal(fromString.data.weight, 2.5);

  const weight = await call("GET", "/api/scale/weight");
  assert.equal(weight.data.weight, 2.5);
  assert.equal(weight.data.unit, "kg");
});

test("printer list and demo receipt", async () => {
  const list = await call("GET", "/api/printer/list");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.printers));
  assert.ok(list.data.printers.length >= 1);

  const printed = await call("POST", "/api/printer/print", {
    items: [{ name: "Bananas", qty: "1", price: "3.13" }],
    total: "3.13"
  });
  assert.equal(printed.status, 200);
  assert.equal(printed.data.demo, true);
  assert.match(printed.data.receipt_text, /Bananas/);
  assert.ok(printed.data.receipt_file);
  assert.equal(fs.existsSync(printed.data.receipt_file), true);
});

test("cash drawer demo open", async () => {
  const status = await call("GET", "/api/cash-drawer/status");
  assert.equal(status.data.configured, true);
  assert.equal(status.data.mode, "demo");

  const opened = await call("POST", "/api/cash-drawer/open");
  assert.equal(opened.status, 200);
  assert.equal(opened.data.demo, true);
  assert.equal(opened.data.mode, "demo");
});

test("payment sale, decline, void, refund, and cancel", async () => {
  const status = await call("GET", "/api/payment/status");
  assert.equal(status.data.demo, true);
  assert.equal(status.data.ready, true);

  const sale = await call("POST", "/api/payment/initiate", {
    amount: "3.13",
    order_id: "DEMO-CART-1"
  });
  assert.equal(sale.status, 200);
  assert.equal(sale.data.approved, true);
  assert.equal(sale.data.demo, true);
  assert.ok(sale.data.transactionId);

  const decline = await call("POST", "/api/payment/initiate", {
    amount: 1,
    order_id: "DEMO-DECLINE-1"
  });
  assert.equal(decline.status, 402);
  assert.equal(decline.data.code, "PAX_DECLINED");

  const invalid = await call("POST", "/api/payment/initiate", { amount: 0 });
  assert.equal(invalid.status, 400);

  const missingVoid = await call("POST", "/api/payment/void", {});
  assert.equal(missingVoid.status, 400);

  const voided = await call("POST", "/api/payment/void", {
    ref_num: sale.data.transactionId
  });
  assert.equal(voided.status, 200);
  assert.equal(voided.data.demo, true);

  const refund = await call("POST", "/api/payment/refund", {
    amount: "3.13",
    ref_num: sale.data.transactionId
  });
  assert.equal(refund.status, 200);
  assert.equal(refund.data.demo, true);
  assert.equal(refund.data.amount, 3.13);

  const cancel = await call("POST", "/api/payment/cancel");
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.cancelled, true);
});

test("keyboard and display stay OS-managed", async () => {
  const keyboard = await call("GET", "/api/keyboard/status");
  assert.equal(keyboard.status, 200);
  assert.equal(keyboard.data.os_managed, true);
  assert.equal(keyboard.data.agent_integrated, false);

  const display = await call("GET", "/api/display/status");
  assert.equal(display.status, 200);
  assert.equal(display.data.devices.length, 2);
});

test("diagnostics includes every device", async () => {
  const diag = await call("GET", "/api/terminal/diagnostics");
  assert.equal(diag.status, 200);
  assert.equal(diag.data.demo, true);
  assert.equal(diag.data.printer.demo, true);
  assert.equal(diag.data.scanner.connected, true);
  assert.equal(diag.data.scale.connected, true);
  assert.equal(diag.data.cash_drawer.mode, "demo");
  assert.equal(diag.data.keyboard.os_managed, true);
  assert.ok(diag.data.display.devices.length >= 1);
  assert.equal(diag.data.payment.enabled, true);
});
