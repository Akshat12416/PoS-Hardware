/**
 * Elavon Converge Hosted Payments (browser checkout).
 *
 * Production customer entry:
 *   https://api.convergepay.com/hosted-payments
 *
 * Hosted checkout runs in a browser — not inside PAX OS. Countertop chip/swipe
 * uses Commerce SDK / bridge
 * 
   * Auth: ssl_merchant_id / ssl_user_id / ssl_pin (+ optional ssl_vendor_id).
 */
import express from "express";
import fetch from "node-fetch";
import logger from "../utils/logger.js";
import {
  resolveConvergeBaseUrl,
  buildDefaultSslAuth,
  buildHostedCheckoutUrls,
  convergeProductionReady,
  encodeConvergeFormBody,
  parseConvergeResponse
} from "../utils/convergeHosted.js";

const router = express.Router();

async function postTransactionToken(payload) {
  const baseUrl = resolveConvergeBaseUrl();
  const url = `${baseUrl}/hosted-payments/transaction_token`;

  const ms = Number(process.env.CONVERGE_REQUEST_TIMEOUT_MS) || 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  let cRes;
  try {
    cRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: encodeConvergeFormBody(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const raw = await cRes.text();
  const data = parseConvergeResponse(raw);

  return { baseUrl, cRes, data };
}

function mergeTransactionPayload(body) {
  const defaults = buildDefaultSslAuth();
  const fromClient = { ...(body || {}) };

  // Never let clients override server-side payment credentials.
  const serverHasCreds =
    defaults.ssl_merchant_id && defaults.ssl_user_id && defaults.ssl_pin;
  if (serverHasCreds) {
    delete fromClient.ssl_merchant_id;
    delete fromClient.ssl_account_id;
    delete fromClient.ssl_user_id;
    delete fromClient.ssl_pin;
    delete fromClient.ssl_vendor_id;
  } else {
    delete fromClient.ssl_pin;
  }

  const payload = {
    ...defaults,
    ...fromClient
  };

  // Converge Account ID (ssl_account_id) is sent as ssl_merchant_id upstream.
  if (!payload.ssl_merchant_id && payload.ssl_account_id) {
    payload.ssl_merchant_id = payload.ssl_account_id;
    delete payload.ssl_account_id;
  }

  if (payload.amount != null && payload.ssl_amount == null) {
    const n = Number(payload.amount);
    if (!Number.isNaN(n)) payload.ssl_amount = n.toFixed(2);
    delete payload.amount;
  }

  if (!payload.ssl_transaction_type) {
    payload.ssl_transaction_type = "ccsale";
  }

  return payload;
}

async function handleTransactionToken(req, res) {
  try {
    const payload = mergeTransactionPayload(req.body || {});

    if (!payload.ssl_merchant_id || !payload.ssl_user_id || !payload.ssl_pin) {
      return res.status(400).json({
        success: false,
        message:
          "Missing Converge credentials. Provide ssl_merchant_id, ssl_user_id, ssl_pin in body or set CONVERGE_SSL_MERCHANT_ID, CONVERGE_SSL_USER_ID, CONVERGE_SSL_PIN on the server.",
        production_ready: convergeProductionReady()
      });
    }

    const { baseUrl, cRes, data } = await postTransactionToken(payload);

    if (!cRes.ok) {
      logger.error("[CONVERGE-HPP] Token request failed", {
        status: cRes.status,
        response: data
      });
      return res.status(cRes.status).json({
        success: false,
        message: data?.message || "Converge token request failed",
        production_ready: convergeProductionReady()
      });
    }

    const urls = buildHostedCheckoutUrls(baseUrl, data);

    return res.status(200).json({
      success: true,
      environment: process.env.CONVERGE_ENV || "demo",
      hosted_payments_url: `${baseUrl}/hosted-payments`,
      checkout_redirect_url: urls.checkout_redirect_url,
      checkout_hint: urls.hint || undefined,
      token_field_used: urls.token_field_used,
      production_ready: convergeProductionReady()
    });
  } catch (err) {
    logger.error("[CONVERGE-HPP] Unhandled error", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to request Converge transaction token",
      error: err.message
    });
  }
}

/**
 * GET /api/converge-hpp/config
 */
router.get("/config", (_req, res) => {
  const baseUrl = resolveConvergeBaseUrl();
  const prod = convergeProductionReady();

  return res.json({
    success: true,
    environment: process.env.CONVERGE_ENV || "demo",
    base_url: baseUrl,
    transaction_token_url: `${baseUrl}/hosted-payments/transaction_token`,
    hosted_payments_entry_url: `${baseUrl}/hosted-payments`,
    production_ready_hints: prod,
    architecture_note:
      "Hosted checkout opens in a browser (hosted_payments_entry_url). PAX countertop uses /api/payment via SDK bridge — same Elavon gateway, different capture path."
  });
});

/**
 * POST /api/converge-hpp/transaction-token
 */
router.post("/transaction-token", handleTransactionToken);

/**
 * POST /api/converge-hpp/checkout-session
 * Same as transaction-token; merges env defaults and maps amount -> ssl_amount.
 */
router.post("/checkout-session", handleTransactionToken);

export default router;
