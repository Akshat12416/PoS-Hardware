/**
 * Payment bridge — Elavon Commerce Web Services (CWS).
 * Countertop: Ingenico Lane/3600 (USB). Legacy network path: PAYMENT_TERMINAL_TYPE=pax.
 *
 * Proxies payment requests from the hardware agent to CWS on the POS PC:
 *   POST https://localhost:9790/rest/command
 *
 * Run from hardware-service directory:
 *   npm run start:pax-bridge
 *
 * Env (see .env.production.example):
 *   PAX_BRIDGE_PORT, CWS_BASE_URL, CONVERGE_SSL_*, CONVERGE_SSL_VENDOR_ID, PAX_TERMINAL_IP
 */

import http from "http";
import { URL, fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { CwsPaymentService } from "./cwsPayment.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PAX_BRIDGE_PORT || process.env.PORT || 7001);
const cws = new CwsPaymentService();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function mapError(err) {
  const code = err.code || "CWS_ERROR";
  const status =
    code === "CWS_VENDOR_ID_REQUIRED" ||
    code === "CWS_CONVERGE_CREDENTIALS_MISSING"
      ? 503
      : code === "PAX_DECLINED" || code === "CWS_TRANSACTION_FAILED"
        ? 402
        : 502;
  return {
    status,
    body: {
      success: false,
      code,
      message: err.message,
      paxResult: err.paxResult || undefined,
      response: err.response || undefined
    }
  };
}

async function warmGateway() {
  if (!cws.vendorIdConfigured()) {
    console.warn(
      "[pax-bridge] CONVERGE_SSL_VENDOR_ID not set — gateway will open after Daniel provides vendor id"
    );
    return;
  }
  try {
    const opened = await cws.openPaymentGateway();
    console.log(
      `[pax-bridge] Converge gateway open (paymentGatewayId=${opened.paymentGatewayId})`
    );
  } catch (err) {
    console.warn(`[pax-bridge] Gateway warmup failed: ${err.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
  } catch {
    return sendJson(res, 400, { success: false, message: "Bad URL" });
  }

  if (req.method === "GET" && pathname === "/health") {
    let status = null;
    try {
      status = await cws.getBridgeStatus();
    } catch (err) {
      status = { cws_reachable: false, cws_error: err.message };
    }
    return sendJson(res, 200, {
      ok: true,
      service: "pax-bridge",
      mode: "cws",
      vendor_id_configured: cws.vendorIdConfigured(),
      ...status
    });
  }

  if (req.method === "GET" && pathname === "/payment/status") {
    try {
      const status = await cws.getBridgeStatus();
      return sendJson(res, 200, status);
    } catch (err) {
      const mapped = mapError(err);
      return sendJson(res, mapped.status, mapped.body);
    }
  }

  try {
    if (req.method === "POST" && pathname === "/payment/initiate") {
      const body = await readJsonBody(req);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return sendJson(res, 400, {
          success: false,
          message: "amount (number > 0) is required"
        });
      }
      try {
        const result = await cws.runSale({
          amount,
          currency: body.currency || "USD",
          orderId: body.orderId || body.order_id || null
        });
        return sendJson(res, 200, result);
      } catch (err) {
        const mapped = mapError(err);
        return sendJson(res, mapped.status, mapped.body);
      }
    }

    if (req.method === "POST" && pathname === "/payment/cancel") {
      await readJsonBody(req);
      try {
        const result = await cws.cancelCurrent();
        return sendJson(res, 200, result);
      } catch (err) {
        const mapped = mapError(err);
        return sendJson(res, mapped.status, mapped.body);
      }
    }

    if (req.method === "POST" && pathname === "/payment/void") {
      const body = await readJsonBody(req);
      if (!body.ref_num) {
        return sendJson(res, 400, {
          success: false,
          message: "ref_num is required"
        });
      }
      try {
        const result = await cws.voidTransaction({
          ref_num: body.ref_num,
          amount: body.amount
        });
        return sendJson(res, 200, result);
      } catch (err) {
        const mapped = mapError(err);
        return sendJson(res, mapped.status, mapped.body);
      }
    }

    if (req.method === "POST" && pathname === "/payment/refund") {
      const body = await readJsonBody(req);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return sendJson(res, 400, {
          success: false,
          message: "amount (number > 0) is required"
        });
      }
      try {
        const result = await cws.refundTransaction({
          amount,
          ref_num: body.ref_num || null
        });
        return sendJson(res, 200, result);
      } catch (err) {
        const mapped = mapError(err);
        return sendJson(res, mapped.status, mapped.body);
      }
    }
  } catch {
    return sendJson(res, 400, { success: false, message: "Invalid JSON body" });
  }

  if (req.method === "GET" && pathname.startsWith("/payment/result/")) {
    const id = pathname.slice("/payment/result/".length);
    if (cws.lastTransaction && (cws.lastTransaction.orderId === id || cws.lastTransaction.transactionId === id)) {
      return sendJson(res, 200, { success: true, ...cws.lastTransaction });
    }
    return sendJson(res, 404, {
      success: false,
      message: "No transaction result for that id"
    });
  }

  return sendJson(res, 404, { success: false, message: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[pax-bridge] CWS bridge listening on http://127.0.0.1:${PORT}`);
  warmGateway();
});
