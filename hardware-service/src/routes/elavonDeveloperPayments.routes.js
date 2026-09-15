/**
 * Server-side proxy to Elavon Developer Payments / Hosted flows
 * (e.g. https://api.sandbox.elavonpayments.com).
 *
 * Keeps ELAVON_SECRET_KEY off the browser. Path and auth follow your Elavon
 * API reference — set ELAVON_AUTH_MODE and path allowlist accordingly.
 */
import express from "express";
import fetch from "node-fetch";
import logger from "../utils/logger.js";
import { isStrictSecurity } from "../config/production.js";
import { safeEqual } from "../utils/cryptoSafe.js";

const router = express.Router();

const POST_SECRET = process.env.ELAVON_PAYMENTS_SERVER_SECRET || null;

function requirePostSecret(req, res, next) {
  if (!POST_SECRET) {
    if (isStrictSecurity()) {
      return res.status(503).json({
        success: false,
        message: "ELAVON_PAYMENTS_SERVER_SECRET is not configured"
      });
    }
    return next();
  }
  const sent =
    req.headers["x-elavon-payments-secret"] ||
    String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(sent, POST_SECRET)) {
    return res.status(401).json({
      success: false,
      message:
        "Missing or invalid ELAVON payments proxy secret (x-elavon-payments-secret or Authorization: Bearer)."
    });
  }
  next();
}

function getBaseUrl() {
  return String(
    process.env.ELAVON_PAYMENTS_API_BASE_URL ||
      "https://api.sandbox.elavonpayments.com"
  ).replace(/\/+$/, "");
}

function buildAuthHeader() {
  const mode = String(process.env.ELAVON_AUTH_MODE || "basic_pk_sk").toLowerCase();
  const pk = process.env.ELAVON_PUBLIC_KEY || "";
  const sk = process.env.ELAVON_SECRET_KEY || "";

  if (mode === "bearer_sk" || mode === "bearer") {
    if (!sk) return null;
    return `Bearer ${sk}`;
  }
  if (mode === "basic_sk_only") {
    if (!sk) return null;
    const b64 = Buffer.from(`${sk}:`, "utf8").toString("base64");
    return `Basic ${b64}`;
  }
  // default: HTTP Basic with public key as user, secret as password (common pattern)
  if (!pk || !sk) return null;
  const b64 = Buffer.from(`${pk}:${sk}`, "utf8").toString("base64");
  return `Basic ${b64}`;
}

function defaultPathPrefixes() {
  const raw =
    process.env.ELAVON_PAYMENTS_PATH_PREFIX_ALLOWLIST ||
    "/v1/,/v2/,/payments/,/payment/,/commerce/";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPathAllowed(path) {
  const raw = String(path || "");
  const pathOnly = raw.split("?")[0];
  if (!pathOnly.startsWith("/") || raw.includes("..") || raw.length > 512) {
    return false;
  }
  const prefixes = defaultPathPrefixes();
  return prefixes.some((prefix) => {
    const norm = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return pathOnly === norm || pathOnly.startsWith(`${norm}/`);
  });
}

function optionalAccountHeaders() {
  const h = {};
  const g = process.env.ELAVON_GATEWAY_MERCHANT_ID;
  const proc = process.env.ELAVON_PROCESSOR_ACCOUNT_ID;
  const alias = process.env.ELAVON_MERCHANT_ALIAS;
  if (g) h["X-Gateway-Merchant-Id"] = g;
  if (proc) h["X-Processor-Account-Id"] = proc;
  if (alias) h["X-Merchant-Alias"] = alias;
  return h;
}

/**
 * GET /api/elavon-payments/config
 * Safe for frontend: no secret. Adjust exposure if your product treats IDs as sensitive.
 */
router.get("/config", requirePostSecret, (_req, res) => {
  const baseUrl = getBaseUrl();
  res.json({
    success: true,
    payments_api_base_url: baseUrl,
    auth_mode: process.env.ELAVON_AUTH_MODE || "basic_pk_sk",
    credentials_configured: Boolean(buildAuthHeader()),
    post_proxy_protected: Boolean(POST_SECRET) || isStrictSecurity()
  });
});

/**
 * POST /api/elavon-payments/gateway
 * Body: { "method": "POST", "path": "/v1/...", "json": { ... } }
 * Forwards to ELAVON_PAYMENTS_API_BASE_URL + path with server-side auth.
 *
 * Set ELAVON_PAYMENTS_PATH_PREFIX_ALLOWLIST to match paths from Elavon docs.
 * Set ELAVON_PAYMENTS_SERVER_SECRET and send x-elavon-payments-secret on the POS cloud.
 */
router.post("/gateway", requirePostSecret, async (req, res) => {
  const auth = buildAuthHeader();
  if (!auth) {
    return res.status(503).json({
      success: false,
      message:
        "Elavon Payments env not configured (ELAVON_PUBLIC_KEY + ELAVON_SECRET_KEY, or set ELAVON_AUTH_MODE=bearer_sk and ELAVON_SECRET_KEY)."
    });
  }

  const method = String(req.body?.method || "POST").toUpperCase();
  const path = String(req.body?.path || "").trim();
  const jsonBody = req.body?.json;

  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return res.status(400).json({ success: false, message: "Invalid method" });
  }
  if (!isPathAllowed(path)) {
    return res.status(400).json({
      success: false,
      message:
        "Path not allowed. Set ELAVON_PAYMENTS_PATH_PREFIX_ALLOWLIST to prefixes permitted by your Elavon API reference.",
      path,
      allowlist: defaultPathPrefixes()
    });
  }

  const url = `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    ...optionalAccountHeaders(),
    Authorization: auth
  };
  if (jsonBody !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body:
        jsonBody !== undefined && method !== "GET"
          ? JSON.stringify(jsonBody)
          : undefined,
      timeout: Number(process.env.ELAVON_PAYMENTS_TIMEOUT_MS) || 30000
    });

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!upstream.ok) {
      logger.warn("[ELAVON-PAYMENTS] Upstream error", {
        status: upstream.status,
        path
      });
      return res.status(upstream.status).json({
        success: false,
        message: data?.message || "Elavon API error"
      });
    }

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("[ELAVON-PAYMENTS] Request failed", { error: err.message });
    return res.status(502).json({
      success: false,
      message: err.message || "Elavon request failed"
    });
  }
});

export default router;
