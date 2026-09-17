/**
 * Software-only demo mode. Never talks to USB/serial/Elavon.
 * Enable with DEMO_MODE=true. Disabled in production unless ALLOW_DEMO_IN_PRODUCTION=true.
 */
export function isDemoMode() {
  if (String(process.env.DEMO_MODE || "").toLowerCase() !== "true") {
    return false;
  }
  if (
    String(process.env.NODE_ENV || "").toLowerCase() === "production" &&
    String(process.env.ALLOW_DEMO_IN_PRODUCTION || "").toLowerCase() !== "true"
  ) {
    return false;
  }
  return true;
}

export function demoBanner() {
  return "DEMO MODE — no physical hardware; responses are simulated";
}
