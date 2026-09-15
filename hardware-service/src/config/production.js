/** Render sets NODE_ENV=production automatically — that alone does not enable strict security. */
export function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/** Opt-in strict mode: fail startup if secrets missing; enforce auth on all protected routes. */
export function isStrictSecurity() {
  return process.env.REQUIRE_PRODUCTION_SECURITY === "true";
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(v).trim();
}

/** Fail fast only when REQUIRE_PRODUCTION_SECURITY=true. Otherwise warn and start. */
export function assertCloudProductionSecurity() {
  const missing = [];
  if (!process.env.INTEGRATION_SECRET?.trim()) missing.push("INTEGRATION_SECRET");
  if (!process.env.CLOUD_API_SECRET?.trim()) missing.push("CLOUD_API_SECRET");
  if (!process.env.ELAVON_PAYMENTS_SERVER_SECRET?.trim()) {
    missing.push("ELAVON_PAYMENTS_SERVER_SECRET (optional but recommended)");
  }

  if (isStrictSecurity()) {
    requireEnv("INTEGRATION_SECRET");
    requireEnv("CLOUD_API_SECRET");
    if (!process.env.ELAVON_PAYMENTS_SERVER_SECRET?.trim()) {
      console.warn(
        "[SECURITY] ELAVON_PAYMENTS_SERVER_SECRET not set — /api/elavon-payments/gateway is open"
      );
    }
    console.log("[SECURITY] Strict production security enabled");
    return;
  }

  if (isProduction() && missing.length) {
    console.warn(
      "[SECURITY] Cloud is running without full secrets. Set on Render then enable REQUIRE_PRODUCTION_SECURITY=true:",
      missing.join(", ")
    );
  }
}
