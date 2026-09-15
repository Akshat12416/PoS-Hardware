/**
 * Cloud proxy for payment (PAX A35): forwards to active hardware terminal.
 * Requires x-store-id. Use from frontend: GET https://your-cloud.com/api/payment/status
 */
import express from "express";
import fetch from "node-fetch";
import { getActiveTerminalForStore } from "../utils/hardwareRegistry.js";
import {
  getPaxElavonConfig,
  getPaxElavonConnectionPayload
} from "../config/paxElavon.config.js";
import logger from "../utils/logger.js";

const router = express.Router();

async function parseHardwareResponse(hRes) {
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

/**
 * GET /api/payment/elavon-config
 * Returns Elavon/PAX processor config (TID, MID, hosts, ports).
 * Static config — no store_id or active terminal required.
 */
router.get("/elavon-config", (_req, res) => {
  try {
    const full = getPaxElavonConfig();
    const connection = getPaxElavonConnectionPayload();
    res.json({ success: true, connection, full });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to get Elavon config"
    });
  }
});

async function forwardToHardware(req, res, method, pathSuffix, body = null) {
  const store_id = req.headers["x-store-id"];
  logger.info("[CLOUD PAYMENT] Request", { method, path: pathSuffix, store_id, has_header: !!store_id });
  if (!store_id) {
    return res.status(400).json({ success: false, message: "Missing x-store-id header" });
  }
  const terminal = await getActiveTerminalForStore(store_id);
  if (!terminal) {
    logger.error("[CLOUD PAYMENT] No active terminal", { store_id });
    return res.status(404).json({ success: false, message: "No active terminal" });
  }
  const { terminal_uid, hardware_url, agent_secret } = terminal;
  const targetUrl = `${hardware_url}/api/payment${pathSuffix}`;
  logger.info("[CLOUD PAYMENT] Forwarding", { targetUrl });
  try {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-terminal-id": terminal_uid,
        "x-agent-secret": agent_secret
      },
      timeout: 8000
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const hRes = await fetch(targetUrl, opts);
    const data = await parseHardwareResponse(hRes);
    return res.status(hRes.status).json(data);
  } catch (err) {
    logger.error("[CLOUD PAYMENT] Forward failed", { message: err.message });
    return res.status(502).json({ success: false, message: "Hardware agent unreachable", error: err.message });
  }
}

router.get("/status", (req, res) => forwardToHardware(req, res, "GET", "/status"));
router.post("/initiate", (req, res) => forwardToHardware(req, res, "POST", "/initiate", req.body || {}));
router.post("/cancel", (req, res) => forwardToHardware(req, res, "POST", "/cancel", req.body || {}));
router.post("/void", (req, res) => forwardToHardware(req, res, "POST", "/void", req.body || {}));
router.post("/refund", (req, res) => forwardToHardware(req, res, "POST", "/refund", req.body || {}));

export default router;