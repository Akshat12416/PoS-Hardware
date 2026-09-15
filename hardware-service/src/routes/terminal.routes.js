/**
 * Cloud-only terminal routes. Do not write POS config.json from the cloud process.
 * Local approve/status live on the hardware agent (localTerminal.routes.js).
 */
import express from "express";
import { getTerminalByUid } from "../utils/hardwareRegistry.js";
import { requireCloudApiSecret } from "../middleware/security.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";

const router = express.Router();

/**
 * POST /api/terminal/cloud-approve
 * Body: { terminal_uid, store_id }
 * Header: x-agent-secret (agent secret of the terminal)
 */
router.post("/cloud-approve", requireCloudApiSecret, async (req, res) => {
  const { terminal_uid, store_id } = req.body || {};
  const agentSecret = req.headers["x-agent-secret"];

  if (!terminal_uid || !store_id) {
    return res.status(400).json({
      success: false,
      message: "terminal_uid and store_id are required"
    });
  }

  if (!agentSecret) {
    return res.status(401).json({
      success: false,
      message: "Missing x-agent-secret header"
    });
  }

  const terminal = await getTerminalByUid(terminal_uid).catch(() => null);

  if (!terminal) {
    return res.status(404).json({
      success: false,
      message:
        "Terminal not found or heartbeat expired (> 5 min). Make sure hardware agent is running."
    });
  }

  const targetUrl = `${terminal.hardware_url}/api/terminal/approve`;

  try {
    const hwRes = await fetchWithTimeout(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-agent-secret": agentSecret
      },
      body: JSON.stringify({ store_id }),
      timeoutMs: 10_000
    });

    const raw = await hwRes.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { success: false, message: raw || "Invalid hardware response" };
    }

    return res.status(hwRes.status).json({
      ...data,
      forwarded_to: targetUrl
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: "Hardware agent unreachable",
      hardware_url: terminal.hardware_url,
      error: err.message
    });
  }
});

export default router;
