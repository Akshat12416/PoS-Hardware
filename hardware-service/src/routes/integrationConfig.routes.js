/**
 * Integration config API: returns x-store-id, x-terminal-id, x-agent-secret
 * so PAX Android, Laravel, or other clients can use them in headers or body.
 */
import express from "express";
import { getIntegrationConfigForStore } from "../services/integrationConfig.service.js";
import logger from "../utils/logger.js";
import { isStrictSecurity } from "../config/production.js";
import { safeEqual } from "../utils/cryptoSafe.js";

const router = express.Router();

const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || null;

function requireIntegrationSecret(req, res) {
  if (!INTEGRATION_SECRET) {
    if (isStrictSecurity()) {
      res.status(503).json({
        success: false,
        message: "INTEGRATION_SECRET is not configured"
      });
      return false;
    }
    return true;
  }

  const secret =
    req.headers["x-integration-secret"] ||
    req.body?.integration_secret ||
    String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");

  if (!safeEqual(secret, INTEGRATION_SECRET)) {
    logger.warn("[INTEGRATION-CONFIG] Invalid integration secret");
    res.status(401).json({
      success: false,
      message: "Invalid or missing integration secret"
    });
    return false;
  }
  return true;
}

/**
 * GET /api/integration-config
 * Returns header values for the given store. Call once, then use the values in
 * subsequent requests (as headers or in body via integrationHeaders middleware).
 *
 * Auth: x-store-id (required). If INTEGRATION_SECRET is set, also require
 * x-integration-secret or Authorization: Bearer <INTEGRATION_SECRET>.
 *
 * Response: { store_id, terminal_id, agent_secret } or 404 if no active terminal.
 */
router.get("/", async (req, res) => {
  try {
    const storeId =
      req.headers["x-store-id"] ||
      req.body?.store_id ||
      req.body?.x_store_id ||
      req.query?.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message:
          "Store identifier required. Send x-store-id header, or store_id in query/body."
      });
    }

    if (!requireIntegrationSecret(req, res)) return;

    const config = await getIntegrationConfigForStore(storeId);
    if (!config) {
      logger.info("[INTEGRATION-CONFIG] No active terminal", { store_id: storeId });
      return res.status(404).json({
        success: false,
        message: "No active terminal for this store",
        store_id: storeId
      });
    }

    logger.info("[INTEGRATION-CONFIG] Config returned", {
      store_id: config.store_id,
      terminal_id: config.terminal_id
    });
    return res.json({
      success: true,
      store_id: config.store_id,
      terminal_id: config.terminal_id,
      agent_secret: config.agent_secret,
      headers: {
        "x-store-id": config.store_id,
        "x-terminal-id": config.terminal_id,
        "x-agent-secret": config.agent_secret
      }
    });
  } catch (err) {
    logger.error("[INTEGRATION-CONFIG] Error", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to get integration config"
    });
  }
});

/**
 * POST /api/integration-config — same as GET but accepts store_id in body (for clients that cannot set headers).
 */
router.post("/", async (req, res) => {
  try {
    const storeId =
      req.headers["x-store-id"] ||
      req.body?.store_id ||
      req.body?.x_store_id ||
      req.query?.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "store_id required in body, query, or x-store-id header."
      });
    }

    if (!requireIntegrationSecret(req, res)) return;

    const config = await getIntegrationConfigForStore(storeId);
    if (!config) {
      return res.status(404).json({
        success: false,
        message: "No active terminal for this store",
        store_id: storeId
      });
    }

    return res.json({
      success: true,
      store_id: config.store_id,
      terminal_id: config.terminal_id,
      agent_secret: config.agent_secret,
      headers: {
        "x-store-id": config.store_id,
        "x-terminal-id": config.terminal_id,
        "x-agent-secret": config.agent_secret
      }
    });
  } catch (err) {
    logger.error("[INTEGRATION-CONFIG] POST error", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Failed to get integration config"
    });
  }
});

export default router;
