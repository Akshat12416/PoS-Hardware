import { getPaxElavonConnectionPayload } from "../config/paxElavon.config.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

/**
 * Best-effort reachability check for the CWS payment bridge.
 */
export async function probePaxBridge(bridgeUrl, timeoutMs = 8000) {
  const base = String(bridgeUrl || "").replace(/\/+$/, "");
  if (!base) {
    return { ok: false, via: null, detail: "no bridge URL" };
  }

  const limit = Math.min(Number(timeoutMs) || 8000, 15000);

  async function getOk(path) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`, { timeoutMs: limit });
      return res.ok;
    } catch {
      return false;
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

  return {
    ok: false,
    via: null,
    detail: "bridge did not respond OK to /health or /payment/status"
  };
}
