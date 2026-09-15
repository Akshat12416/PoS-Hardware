import { fetchWithTimeout } from "./fetchWithTimeout.js";

/**
 * Best-effort reachability check for the PAX bridge (production ops / diagnostics).
 */
export async function probePaxBridge(bridgeUrl) {
  const base = String(bridgeUrl || "").replace(/\/+$/, "");
  if (!base) {
    return { ok: false, via: null, detail: "no bridge URL" };
  }

  const timeoutMs = Math.min(Number(config.pax_timeout_ms) || 30000, 15000);

  async function getOk(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, { signal: controller.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  if (await getOk("/health")) {
    return { ok: true, via: "GET /health" };
  }

  try {
    const elavon = getPaxElavonConnectionPayload();
    const q = `tid=${encodeURIComponent(elavon.tid)}&mid=${encodeURIComponent(elavon.mid)}`;
    if (await getOk(`/payment/status?${q}`)) {
      return { ok: true, via: "GET /payment/status" };
    }
  } catch {
    // fall through
  }

  return { ok: false, via: null, detail: "bridge did not respond OK to /health or /payment/status" };
}
