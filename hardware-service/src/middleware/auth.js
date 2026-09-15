import crypto from "crypto";
import { config } from "../config.js";

/**
 * ----------------------------------------------------
 * verifyAgent Middleware
 * ----------------------------------------------------
 * Enforces:
 * 1) Terminal must be registered & approved
 * 2) Request must contain valid agent signature
 * 3) Request must be fresh (anti-replay)
 * ----------------------------------------------------
 *
 * Required headers from cloud/frontend:
 *
 * X-Terminal-UID: <terminal_uid>
 * X-Timestamp:   <unix_ms>
 * X-Signature:   HMAC_SHA256(
 *   terminal_uid + "|" + timestamp + "|" + method + "|" + path,
 *   agent_secret
 * )
 */

export function verifyAgent(req, res, next) {
  try {
    // -----------------------------
    // 1) Terminal State Checks
    // -----------------------------
    if (!config.terminal_uid) {
      return res.status(423).json({
        success: false,
        message: "Terminal identity not initialized"
      });
    }
    
    if (!config.registered || !config.approved || !config.store_id) {
      return res.status(423).json({
        success: false,
        message: "Terminal is locked or not approved",
        terminal_uid: config.terminal_uid
      });
    }

    // -----------------------------
    // 2) Required Headers
    // -----------------------------
    const terminalUID = req.get("X-Terminal-UID");
    const timestamp = req.get("X-Timestamp");
    const signature = req.get("X-Signature");

    if (!terminalUID || !timestamp || !signature) {
      return res.status(401).json({
        success: false,
        message: "Missing authentication headers"
      });
    }

    // -----------------------------
    // 3) Terminal Identity Match
    // -----------------------------
    if (terminalUID !== config.terminal_uid) {
      return res.status(401).json({
        success: false,
        message: "Terminal UID mismatch"
      });
    }

    // -----------------------------
    // 4) Anti-Replay (±30s window)
    // -----------------------------
    const now = Date.now();
    const ts = Number(timestamp);

    if (!Number.isFinite(ts)) {
      return res.status(401).json({
        success: false,
        message: "Invalid timestamp"
      });
    }

    const delta = Math.abs(now - ts);

    if (delta > 30_000) {
      return res.status(401).json({
        success: false,
        message: "Request expired"
      });
    }

    // -----------------------------
    // 5) Signature Validation
    // -----------------------------
    const method = req.method.toUpperCase();
    const path = req.originalUrl.split("?")[0]; // no querystring

    const payload = `${terminalUID}|${timestamp}|${method}|${path}`;

    const expected = crypto
      .createHmac("sha256", config.agent_secret)
      .update(payload)
      .digest("hex");

    // Prevent timing attacks & length mismatch crashes
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expBuf.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature"
      });
    }

    const valid = crypto.timingSafeEqual(expBuf, sigBuf);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature"
      });
    }

    // -----------------------------
    // 6) Attach Context
    // -----------------------------
    req.terminal = {
      terminal_uid: config.terminal_uid,
      store_id: config.store_id
    };

    next();
  } catch (err) {
    console.error("[AUTH ERROR]", err?.stack || err);

    return res.status(500).json({
      success: false,
      message: "Authentication failure"
    });
  }
}
