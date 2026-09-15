/**
 * Countertop payment via local CWS bridge (Ingenico Lane/3600).
 *
 * The hardware-service delegates payment operations to pax-bridge, which
 * calls Elavon Commerce Web Services (CWS) on the register PC.
 */

import { fetchWithTimeout } from "../../utils/fetchWithTimeout.js";
import { config } from "../../config.js";
import { getPaxElavonConnectionPayload } from "../../config/paxElavon.config.js";
import { bridgeCallTimeoutMs } from "../../utils/paymentTimeouts.js";

/* ============================================================
   PUBLIC API
============================================================ */

/**
 * Ensure PAX is enabled. Throws with a clean error code if not.
 */
function ensurePaxEnabled() {
  if (!config.pax_enabled) {
    const err = new Error("PAX payment terminal is not enabled");
    err.code = "PAX_NOT_ENABLED";
    throw err;
  }
  if (!String(config.pax_bridge_url || "").trim()) {
    const err = new Error(
      "PAX bridge URL is not configured (set PAX_BRIDGE_URL or pax_bridge_url in config.json)"
    );
    err.code = "PAX_BRIDGE_NOT_CONFIGURED";
    throw err;
  }
}

function getBridgeBaseUrl() {
  return String(config.pax_bridge_url || "").replace(/\/+$/, "");
}

async function callBridge(path, { method = "GET", body } = {}) {
  const base = getBridgeBaseUrl();
  if (!base) {
    const err = new Error(
      "PAX bridge URL is not configured (set PAX_BRIDGE_URL or pax_bridge_url in config.json)"
    );
    err.code = "PAX_BRIDGE_NOT_CONFIGURED";
    throw err;
  }

  let res;
  try {
    res = await fetchWithTimeout(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      timeoutMs: bridgeCallTimeoutMs(path, config.pax_timeout_ms)
    });
  } catch (err) {
    const e = new Error(`PAX bridge unreachable at ${base}: ${err.message}`);
    e.code = "PAX_BRIDGE_UNREACHABLE";
    throw e;
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { success: false, message: text || "Invalid JSON response from bridge" };
  }

  if (!res.ok || data?.success === false) {
    const e = new Error(data?.message || `PAX bridge request failed (${res.status})`);
    e.code = data?.code || "PAX_BRIDGE_ERROR";
    e.responseCode = data?.responseCode;
    e.paxResult = data?.paxResult;
    e.response = { status: res.status, data };
    throw e;
  }

  return data;
}

/**
 * GET /api/payment/status
 */
export async function getPaxStatus() {
  if (!config.pax_enabled) {
    return {
      success: true,
      configured: false,
      enabled: false,
      message: "Payment terminal not enabled (set pax_enabled: true in config.json)",
      terminal_type: config.payment_terminal_type || "ingenico",
      terminal_model: config.payment_terminal_model || null,
      terminal_serial: config.payment_terminal_serial || null,
      terminal_connection: config.payment_terminal_connection || "usb",
    };
  }

  try {
    const elavon = getPaxElavonConnectionPayload();
    const status = await callBridge(
      `/payment/status?tid=${encodeURIComponent(elavon.tid)}&mid=${encodeURIComponent(elavon.mid)}`
    );
    return {
      ...status,
      bridge_online: status.bridge_online ?? true,
      sdk_integrated: status.sdk_integrated ?? status.mode !== "sdk_required",
      elavon,
      payment_paths: {
        countertop:
          "POST /api/payment/initiate — pax-bridge → CWS → Ingenico (USB)",
        browser_checkout:
          "POST {cloud}/api/converge-hpp/checkout-session — Converge hosted page"
      }
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      enabled: true,
      online: false,
      terminal_ip: config.pax_terminal_ip,
      message: err.message,
      code: err.code || "PAX_ERROR"
    };
  }
}

/**
 * POST /api/payment/initiate
 * @param {{ amount: number, currency?: string, order_id?: string }} params
 */
export async function initiatePaxPayment({ amount, currency = "USD", order_id }) {
  ensurePaxEnabled();

  const elavon = getPaxElavonConnectionPayload();
  try {
    return await callBridge("/payment/initiate", {
      method: "POST",
      body: {
        amount,
        currency,
        orderId: order_id || null,
        terminalId: config.pax_terminal_id || null,
        elavon
      }
    });
  } catch (err) {
    const e = new Error(err.message || "PAX transaction declined");
    e.code = err.code || "PAX_DECLINED";
    e.responseCode = err.responseCode;
    e.paxResult = err.paxResult;
    throw e;
  }
}

/**
 * POST /api/payment/cancel
 */
export async function cancelPaxPayment() {
  ensurePaxEnabled();

  try {
    return await callBridge("/payment/cancel", {
      method: "POST",
      body: {
        terminalId: config.pax_terminal_id || null
      }
    });
  } catch (err) {
    const e = new Error(err.message || "PAX cancel failed");
    e.code = err.code || "PAX_CANCEL_FAILED";
    throw e;
  }
}

/**
 * POST /api/payment/void
 * @param {{ ref_num: string, amount?: number }} params
 */
export async function voidPaxPayment({ ref_num, amount }) {
  ensurePaxEnabled();

  if (!ref_num) {
    const err = new Error("ref_num is required for void");
    err.code = "PAX_INVALID_INPUT";
    throw err;
  }

  try {
    return await callBridge("/payment/void", {
      method: "POST",
      body: {
        ref_num,
        amount,
        terminalId: config.pax_terminal_id || null,
        elavon: getPaxElavonConnectionPayload()
      }
    });
  } catch (err) {
    const e = new Error(err.message || "PAX void failed");
    e.code = err.code || "PAX_VOID_FAILED";
    e.responseCode = err.responseCode;
    throw e;
  }
}

/**
 * POST /api/payment/refund
 * @param {{ amount: number, ref_num?: string }} params
 */
export async function refundPaxPayment({ amount, ref_num }) {
  ensurePaxEnabled();

  try {
    return await callBridge("/payment/refund", {
      method: "POST",
      body: {
        amount,
        ref_num,
        terminalId: config.pax_terminal_id || null,
        elavon: getPaxElavonConnectionPayload()
      }
    });
  } catch (err) {
    const e = new Error(err.message || "PAX refund failed");
    e.code = err.code || "PAX_REFUND_FAILED";
    e.responseCode = err.responseCode;
    throw e;
  }
}
