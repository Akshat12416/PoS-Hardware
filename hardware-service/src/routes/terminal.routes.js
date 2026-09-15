// src/routes/terminal.routes.js
import express from "express";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import fetch from "node-fetch";

import { config, CONFIG_PATH } from "../config.js";
import { verifyCloudAgent } from "../middleware/verifyCloudAgent.js";
import { requireRegisteredTerminal } from "../middleware/requireRegisteredTerminal.js";
import { getTerminalByUid } from "../utils/hardwareRegistry.js";
import { isStrictSecurity } from "../config/production.js";
import { requireCloudApiSecret } from "../middleware/security.js";

const router = express.Router();

/* ----------------------------------------------------
   PUBLIC — no middleware
---------------------------------------------------- */

router.get("/whoami", (req, res) => {
  if (isStrictSecurity()) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  res.json({
    approved: config.approved || false,
    registered: config.registered || false
  });
});

/* ----------------------------------------------------
   BOOTSTRAP — identity only
---------------------------------------------------- */

router.post("/register", requireRegisteredTerminal, async (req, res) => {
  const { terminal_id } = req.body;

  if (!terminal_id) {
    return res.status(400).json({
      success: false,
      message: "Missing terminal_id"
    });
  }

  if (terminal_id !== config.terminal_uid) {
    return res.status(401).json({
      success: false,
      message: "terminal_id does not match this agent"
    });
  }

  if (!config.approved || !config.store_id) {
    return res.status(423).json({
      success: false,
      message: "Terminal is not approved or store is not assigned",
      terminal_id
    });
  }

  const updated = {
    ...config,
    registered: true
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  Object.assign(config, updated);

  return res.json({
    success: true,
    message: "Terminal approved and unlocked",
    terminal_id,
    store_id: config.store_id
  });
});

/* ----------------------------------------------------
   CLOUD → AGENT — cryptographic auth
---------------------------------------------------- */

router.post("/approve", verifyCloudAgent, (req, res) => {
  const { store_id } = req.body;

  if (!store_id) {
    return res.status(400).json({
      success: false,
      message: "store_id is required"
    });
  }

  const updated = {
    ...config,
    store_id,
    approved: true,
    registered: true
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  Object.assign(config, updated);

  res.json({
    success: true,
    message: "Terminal approved",
    terminal_uid: config.terminal_uid,
    store_id
  });
});

router.get("/status", verifyCloudAgent, (req, res) => {
  res.json({
    success: true,
    terminal_uid: config.terminal_uid,
    store_id: config.store_id,
    approved: config.approved,
    registered: config.registered,
    hostname: os.hostname(),
    platform: os.platform(),
    uptime_sec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/* ----------------------------------------------------
   CLOUD-APPROVE — Render proxies approve to hardware
   POST /api/terminal/cloud-approve
   Body: { terminal_uid, store_id }
   Header: x-agent-secret (agent secret of the terminal)
---------------------------------------------------- */
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

  // Look up terminal's hardware URL from the DB registry
  const terminal = await getTerminalByUid(terminal_uid).catch(() => null);

  if (!terminal) {
    return res.status(404).json({
      success: false,
      message: "Terminal not found or heartbeat expired (> 5 min). Make sure hardware agent is running."
    });
  }

  const targetUrl = `${terminal.hardware_url}/api/terminal/approve`;

  try {
    const hwRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": agentSecret
      },
      body: JSON.stringify({ store_id }),
      timeout: 10_000
    });

    const data = await hwRes.json();
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
