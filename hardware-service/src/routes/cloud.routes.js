import express from "express";
import { registerTerminal } from "../utils/hardwareRegistry.js";

const router = express.Router();

router.post("/heartbeat", (req, res) => {
  const { terminal_uid, store_id, ip } = req.body;

  const agentSecret = req.headers["x-agent-secret"];
  if (!agentSecret) {
    return res.status(401).json({ success: false, message: "Missing agent secret" });
  }

  registerTerminal({
    terminal_uid,
    store_id,
    ip,
    agent_secret: agentSecret
  });

  res.json({ success: true });
});

export default router;
