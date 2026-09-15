import { isStrictSecurity } from "../config/production.js";
import { safeEqual } from "../utils/cryptoSafe.js";
import { getActiveTerminalForStore } from "../utils/hardwareRegistry.js";
import logger from "../utils/logger.js";

const hitBuckets = new Map();

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  res.removeHeader("X-Powered-By");
  next();
}

export function rateLimit({ windowMs = 60_000, max = 120, keyPrefix = "" } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let bucket = hitBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      hitBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests"
      });
    }
    next();
  };
}

function readBearer(req) {
  return String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
}

/** Protects payment/HPP/elavon routes on the cloud server. */
export function requireCloudApiSecret(req, res, next) {
  const secret = process.env.CLOUD_API_SECRET;
  if (!secret) {
    if (isStrictSecurity()) {
      return res.status(503).json({
        success: false,
        message: "CLOUD_API_SECRET is not configured"
      });
    }
    return next();
  }

  const sent =
    req.headers["x-cloud-api-secret"] ||
    req.headers["x-integration-secret"] ||
    readBearer(req);

  if (!safeEqual(sent, secret)) {
    logger.warn("[SECURITY] Invalid cloud API secret", { path: req.path });
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }
  next();
}

/** Cloud hardware proxy: store_id + agent_secret must match active terminal registry. */
export async function requireCloudStoreAuth(req, res, next) {
  if (!isStrictSecurity() && process.env.REQUIRE_STORE_AUTH !== "true") {
    return next();
  }

  const store_id = req.headers["x-store-id"];
  const agent_secret = req.headers["x-agent-secret"];

  if (!store_id) {
    return res.status(400).json({
      success: false,
      message: "Missing x-store-id header"
    });
  }
  if (!agent_secret) {
    return res.status(401).json({
      success: false,
      message: "Missing x-agent-secret header"
    });
  }

  try {
    const terminal = await getActiveTerminalForStore(store_id);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "No active terminal"
      });
    }
    if (!safeEqual(agent_secret, terminal.agent_secret)) {
      logger.warn("[SECURITY] Invalid agent secret for store", { store_id });
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }
    req.cloudTerminal = terminal;
    next();
  } catch (err) {
    logger.error("[SECURITY] Store auth failed", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
}
