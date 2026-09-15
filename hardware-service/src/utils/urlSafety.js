/**
 * Validates hardware_url for cloud→hardware fetch (SSRF mitigation).
 */
export function validateHardwareUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, message: "hardware_url is required" };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, message: "Invalid hardware_url" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, message: "hardware_url must use HTTPS" };
  }

  const host = parsed.hostname.toLowerCase();
  if (isBlockedHost(host)) {
    return { ok: false, message: "hardware_url host is not allowed" };
  }

  const allowlist = parseAllowlist(process.env.HARDWARE_URL_HOST_ALLOWLIST);
  if (allowlist.length > 0) {
    const allowed = allowlist.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
    if (!allowed) {
      return { ok: false, message: "hardware_url host not in allowlist" };
    }
  }

  return { ok: true, url: parsed.toString().replace(/\/+$/, "") };
}

function isBlockedHost(host) {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  if (/^(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)) {
    return true;
  }
  return false;
}

function parseAllowlist(raw) {
  if (!raw) {
    // Default: ngrok-free and ngrok paid domains
    return ["ngrok-free.dev", "ngrok.io", "ngrok.app"];
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
