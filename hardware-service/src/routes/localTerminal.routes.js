import express from "express";
import os from "os";
import { config, persistConfig } from "../config.js";
import { verifyCloudAgent } from "../middleware/verifyCloudAgent.js";

const router = express.Router();

router.get("/whoami", (_req, res) => {
  res.json({
    success: true,
    role: "hardware-agent",
    terminal_uid: config.terminal_uid,
    approved: Boolean(config.approved),
    registered: Boolean(config.registered),
    store_id: config.store_id || null
  });
});

router.post("/register", (req, res) => {
  const { terminal_id } = req.body || {};

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

  config.registered = true;
  persistConfig();

  return res.json({
    success: true,
    message: "Terminal registered locally",
    terminal_id,
    store_id: config.store_id
  });
});

router.post("/approve", verifyCloudAgent, (req, res) => {
  const { store_id } = req.body || {};

  if (!store_id) {
    return res.status(400).json({
      success: false,
      message: "store_id is required"
    });
  }

  config.store_id = String(store_id);
  config.approved = true;
  config.registered = true;
  persistConfig();

  res.json({
    success: true,
    message: "Terminal approved",
    terminal_uid: config.terminal_uid,
    store_id: config.store_id
  });
});

router.get("/status", verifyCloudAgent, (_req, res) => {
  res.json({
    success: true,
    terminal_uid: config.terminal_uid,
    store_id: config.store_id,
    approved: config.approved,
    registered: config.registered,
    hostname: os.hostname(),
    platform: os.platform(),
    bind: "127.0.0.1",
    uptime_sec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;
