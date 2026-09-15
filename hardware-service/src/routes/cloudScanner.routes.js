/**
 * Cloud proxy for scanner: forwards to active hardware terminal.
 * Requires x-store-id. Use from frontend: GET https://your-cloud.com/api/scanner/status
 */
import express from "express";
import fetch from "node-fetch";
import { getActiveTerminalForStore } from "../utils/hardwareRegistry.js";
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
 * Forward GET request to hardware scanner
 */
async function forwardGet(req, res, pathSuffix) {
  const store_id = req.headers["x-store-id"];
  logger.info("[CLOUD SCANNER] Request", { path: pathSuffix, store_id, has_header: !!store_id });
  if (!store_id) {
    return res.status(400).json({ success: false, message: "Missing x-store-id header" });
  }
  const terminal = await getActiveTerminalForStore(store_id);
  if (!terminal) {
    logger.error("[CLOUD SCANNER] No active terminal", { store_id });
    return res.status(404).json({ success: false, message: "No active terminal" });
  }
  const { terminal_uid, hardware_url, agent_secret } = terminal;
  const targetUrl = `${hardware_url}/api/scanner${pathSuffix}`;
  logger.info("[CLOUD SCANNER] Forwarding", { targetUrl });
  try {
    const hRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-terminal-id": terminal_uid,
        "x-agent-secret": agent_secret
      },
      timeout: 8000
    });
    const data = await parseHardwareResponse(hRes);
    return res.status(hRes.status).json(data);
  } catch (err) {
    logger.error("[CLOUD SCANNER] Forward failed", { message: err.message });
    return res.status(502).json({ success: false, message: "Hardware agent unreachable", error: err.message });
  }
}

/**
 * POST /api/scanner/simulate - forward to hardware
 */
async function forwardSimulate(req, res) {
  const store_id = req.headers["x-store-id"];
  logger.info("[CLOUD SCANNER] POST simulate", { store_id, has_header: !!store_id });
  if (!store_id) {
    return res.status(400).json({ success: false, message: "Missing x-store-id header" });
  }
  const terminal = await getActiveTerminalForStore(store_id);
  if (!terminal) {
    return res.status(404).json({ success: false, message: "No active terminal" });
  }
  const { terminal_uid, hardware_url, agent_secret } = terminal;
  const targetUrl = `${hardware_url}/api/scanner/simulate`;
  try {
    const hRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-terminal-id": terminal_uid,
        "x-agent-secret": agent_secret
      },
      body: JSON.stringify(req.body || {}),
      timeout: 8000
    });
    const data = await parseHardwareResponse(hRes);
    return res.status(hRes.status).json(data);
  } catch (err) {
    logger.error("[CLOUD SCANNER] Simulate forward failed", { message: err.message });
    return res.status(502).json({ success: false, message: "Hardware agent unreachable", error: err.message });
  }
}

router.get("/status", (req, res) => forwardGet(req, res, "/status"));
router.get("/last", (req, res) => forwardGet(req, res, "/last"));
router.post("/simulate", forwardSimulate);

export default router;
