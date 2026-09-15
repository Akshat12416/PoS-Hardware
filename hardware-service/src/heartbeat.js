import fetch from "node-fetch";
import fs from "fs";
import { config, CONFIG_PATH } from "./config.js";

const HEARTBEAT_TIMEOUT_MS = 8000;
const MAX_ERROR_BODY_CHARS = 500;
let heartbeatInFlight = false;

function truncate(value, maxLength = MAX_ERROR_BODY_CHARS) {
  if (typeof value !== "string") return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
}

export async function heartbeat() {
  if (heartbeatInFlight) {
    console.warn("[HEARTBEAT] Previous heartbeat still running; skipping this cycle");
    return;
  }

  heartbeatInFlight = true;
  let timeoutId;

  try {
    if (!process.env.NGROK_URL) {
      console.warn("⚠️ [HEARTBEAT] Skipping — NGROK_URL not set");
      return;
    }

    if (!config.store_id) {
      console.warn("⚠️ [HEARTBEAT] Skipping — terminal not yet approved (no store_id)");
      return;
    }

    console.log("[HEARTBEAT] Sending heartbeat");
    console.log("[HEARTBEAT] NGROK:", process.env.NGROK_URL);

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);

    const res = await fetch(
      `${config.cloud_url}/api/cloud/heartbeat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-terminal-id": config.terminal_uid,
          "x-agent-secret": config.agent_secret
        },
        body: JSON.stringify({
          store_id: config.store_id,
          hardware_url: process.env.NGROK_URL
        }),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    const rawBody = await res.text();
    let data = null;

    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = { success: false, error: rawBody || "Invalid JSON response" };
    }

    if (!res.ok) {
      console.error("[HEARTBEAT] Cloud request failed:", {
        status: res.status,
        body: {
          ...data,
          error: truncate(data?.error)
        }
      });
      return;
    }

    console.log("[HEARTBEAT] Cloud response:", data);

    /* ----------------------------------------------------
       OPTION B – APPLY APPROVAL LOCALLY
    ---------------------------------------------------- */
    /* Local approval only when explicitly enabled (unsafe for production). */
    if (
      process.env.HEARTBEAT_TRUST_CLOUD_APPROVAL === "true" &&
      data.approved &&
      data.store_id
    ) {
      if (!config.approved) {
        console.log("[HEARTBEAT] Applying approval locally");

        config.approved = true;
        config.store_id = data.store_id;

        fs.writeFileSync(
          CONFIG_PATH,
          JSON.stringify(config, null, 2)
        );

        console.log("✅ [HEARTBEAT] Terminal unlocked");
      }
    }

  } catch (err) {
    const reason = err.name === "AbortError"
      ? `Request timed out after ${HEARTBEAT_TIMEOUT_MS}ms`
      : err.message;
    console.error("❌ [HEARTBEAT] Failed:", reason);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    heartbeatInFlight = false;
  }
}
