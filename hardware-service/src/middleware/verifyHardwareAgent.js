// src/middleware/verifyHardwareAgent.js
import { config } from "../config.js";
import { safeEqual } from "../utils/cryptoSafe.js";
import logger from "../utils/logger.js";
import { isDemoMode } from "../utils/demoMode.js";

export function verifyHardwareAgent(req, res, next) {
  const terminalId = req.headers["x-terminal-id"];
  const agentSecret = req.headers["x-agent-secret"];

  if (!terminalId || !agentSecret) {
    logger.warn("[HARDWARE AUTH] Missing headers", { path: req.originalUrl });
    return res.status(401).json({
      success: false,
      message: "Missing authentication headers"
    });
  }

  if (
    !safeEqual(terminalId, config.terminal_uid) ||
    !safeEqual(agentSecret, config.agent_secret)
  ) {
    logger.warn("[HARDWARE AUTH] Invalid credentials", { path: req.originalUrl });
    return res.status(401).json({
      success: false,
      message: "Invalid terminal credentials"
    });
  }

  if (!isDemoMode() && (!config.approved || !config.store_id)) {
    return res.status(403).json({
      success: false,
      message: "Terminal not approved"
    });
  }

  req.terminal = {
    terminal_uid: config.terminal_uid,
    store_id: config.store_id || (isDemoMode() ? "DEMO-STORE" : null)
  };
  next();
}
