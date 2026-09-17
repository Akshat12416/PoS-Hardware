// src/middleware/requireOperationalTerminal.js
import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";
import { safeEqual } from "../utils/cryptoSafe.js";
import { isDemoMode } from "../utils/demoMode.js";

const CONFIG_PATH = path.join(process.cwd(), "config.json");

export function requireOperationalTerminal(req, res, next) {
  logger.info("[AUTH] requireOperationalTerminal", {
    path: req.originalUrl,
    method: req.method,
    has_x_terminal_id: !!req.headers["x-terminal-id"],
    has_x_agent_secret: !!req.headers["x-agent-secret"]
  });

  if (!fs.existsSync(CONFIG_PATH)) {
    logger.error("[AUTH] Terminal not initialized - config.json missing");
    return res.status(401).json({
      success: false,
      message: "Terminal not initialized"
    });
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const terminalId = req.headers["x-terminal-id"];
  const agentSecret = req.headers["x-agent-secret"];

  if (!terminalId || !agentSecret) {
    logger.error("[AUTH] Missing auth headers", {
      has_terminal_id: !!terminalId,
      has_agent_secret: !!agentSecret
    });
    return res.status(401).json({
      success: false,
      message: "Missing authentication headers"
    });
  }

  if (
    !safeEqual(terminalId, config.terminal_uid) ||
    !safeEqual(agentSecret, config.agent_secret)
  ) {
    logger.error("[AUTH] Invalid terminal credentials", {
      terminal_match: terminalId === config.terminal_uid
    });
    return res.status(401).json({
      success: false,
      message: "Invalid terminal credentials"
    });
  }

  if (!config.approved) {
    logger.warn("[AUTH] Terminal not approved");
    return res.status(403).json({
      success: false,
      message: "Terminal not approved by admin"
    });
  }

  if (!config.store_id) {
    logger.warn("[AUTH] Terminal not assigned to store");
    return res.status(403).json({
      success: false,
      message: "Terminal not assigned to any store"
    });
  }

  req.terminal = {
    terminal_uid: config.terminal_uid,
    store_id: config.store_id
  };
  logger.info("[AUTH] requireOperationalTerminal OK", { terminal_uid: config.terminal_uid });
  next();
}
