// src/middleware/verifyCloudAgent.js
import { config } from "../config.js";
import { safeEqual } from "../utils/cryptoSafe.js";

export function verifyCloudAgent(req, res, next) {
  const agentSecret = req.headers["x-agent-secret"];

  if (!agentSecret) {
    return res.status(401).json({
      success: false,
      message: "Missing authentication headers"
    });
  }

  if (!safeEqual(agentSecret, config.agent_secret)) {
    return res.status(401).json({
      success: false,
      message: "Invalid agent secret"
    });
  }

  next();
}
