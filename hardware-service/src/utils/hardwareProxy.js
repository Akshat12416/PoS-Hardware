import { getActiveTerminalForStore } from "./hardwareRegistry.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";
import logger from "./logger.js";

export async function parseHardwareResponse(hRes) {
  const raw = await hRes.text();
  try {
    return JSON.parse(raw);
  } catch {
    return {
      success: false,
      message: "Invalid response from hardware",
      raw
    };
  }
}

export async function forwardToStoreHardware({
  storeId,
  method = "GET",
  path,
  body = null,
  timeoutMs = 8000,
  logLabel = "CLOUD PROXY"
}) {
  if (!storeId) {
    const err = new Error("Missing x-store-id header");
    err.status = 400;
    throw err;
  }

  const terminal = await getActiveTerminalForStore(storeId);
  if (!terminal) {
    const err = new Error("No active terminal");
    err.status = 404;
    throw err;
  }

  const targetUrl = `${terminal.hardware_url}${path}`;
  logger.info(`[${logLabel}] Forwarding`, { method, targetUrl });

  try {
    const hRes = await fetchWithTimeout(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-terminal-id": terminal.terminal_uid,
        "x-agent-secret": terminal.agent_secret
      },
      body: body != null ? JSON.stringify(body) : undefined,
      timeoutMs
    });
    const data = await parseHardwareResponse(hRes);
    return { status: hRes.status, data, targetUrl };
  } catch (err) {
    const e = new Error("Hardware agent unreachable");
    e.status = 502;
    e.cause = err;
    e.targetUrl = targetUrl;
    throw e;
  }
}

export function sendForwardError(res, err) {
  return res.status(err.status || 502).json({
    success: false,
    message: err.message,
    error: err.cause?.message
  });
}
