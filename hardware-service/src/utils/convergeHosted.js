/**
 * Converge Hosted Payments helpers (Elavon).
 * @see https://api.convergepay.com/hosted-payments (production customer entry)
 */

export function resolveConvergeBaseUrl() {
  const mode = String(process.env.CONVERGE_ENV || "demo").toLowerCase();
  if (process.env.CONVERGE_API_BASE_URL) {
    return process.env.CONVERGE_API_BASE_URL.replace(/\/+$/, "");
  }
  return mode === "production"
    ? "https://api.convergepay.com"
    : "https://api.demo.convergepay.com";
}

export function resolveSslMerchantId() {
  return (
    process.env.CONVERGE_SSL_MERCHANT_ID ||
    process.env.CONVERGE_SSL_ACCOUNT_ID ||
    undefined
  );
}

export function buildDefaultSslAuth() {
  return {
    ssl_merchant_id: resolveSslMerchantId(),
    ssl_user_id: process.env.CONVERGE_SSL_USER_ID || undefined,
    ssl_pin: process.env.CONVERGE_SSL_PIN || undefined,
    ssl_vendor_id: process.env.CONVERGE_SSL_VENDOR_ID || undefined
  };
}

/**
 * Try to build a browser redirect URL after transaction_token succeeds.
 * Param names differ by Converge release — override with CONVERGE_HOSTED_TOKEN_QUERY_PARAM.
 */
export function buildHostedCheckoutUrls(baseUrl, tokenPayload) {
  const root = `${String(baseUrl).replace(/\/+$/, "")}/hosted-payments`;
  const d =
    tokenPayload &&
    typeof tokenPayload === "object" &&
    !Array.isArray(tokenPayload)
      ? tokenPayload
      : {};

  const paramName =
    process.env.CONVERGE_HOSTED_TOKEN_QUERY_PARAM || "ssl_oauth_token";

  const token =
    pickFirst(d, [
      "ssl_txn_auth_token",
      "ssl_oauth_token",
      "sslOAuthToken",
      "oauth_token",
      "OAuthToken",
      "session_token",
      "ssl_session_token"
    ]) || null;

  if (!token) {
    return {
      checkout_redirect_url: null,
      hosted_payments_url: root,
      hint:
        "Token response did not include a known oauth/session field. Open hosted_payments_url manually or pass the token per Elavon Hosted Payment Page docs."
    };
  }

  const u = new URL(root);
  u.searchParams.set(paramName, String(token));
  return {
    checkout_redirect_url: u.toString(),
    hosted_payments_url: root,
    token_field_used: paramName
  };
}

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

/** Converge HPP transaction_token expects application/x-www-form-urlencoded. */
export function encodeConvergeFormBody(payload) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload || {})) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/** Parse JSON or key=value Converge responses. */
export function parseConvergeResponse(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // ignore
  }
  if (raw.includes("=") && !raw.includes("<html")) {
    const out = {};
    for (const part of raw.split("&")) {
      const [k, v] = part.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
    if (Object.keys(out).length) return out;
  }
  return { raw };
}

export function convergeProductionReady() {
  const m = resolveSslMerchantId();
  const u = process.env.CONVERGE_SSL_USER_ID;
  const p = process.env.CONVERGE_SSL_PIN;
  return {
    converge_env: process.env.CONVERGE_ENV || "demo",
    api_base_configured: Boolean(process.env.CONVERGE_API_BASE_URL),
    ssl_credentials_complete: Boolean(m && u && p),
    uses_production_host:
      resolveConvergeBaseUrl().includes("api.convergepay.com") &&
      String(process.env.CONVERGE_ENV || "").toLowerCase() === "production"
  };
}
