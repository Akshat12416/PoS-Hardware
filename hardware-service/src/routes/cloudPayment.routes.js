/**
 * Cloud proxy for Ingenico/CWS payment: forwards to the active hardware agent.
 */
import express from "express";
import {
  getPaxElavonConfig,
  getPaxElavonConnectionPayload
} from "../config/paxElavon.config.js";
import { config } from "../config.js";
import logger from "../utils/logger.js";
import {
  forwardToStoreHardware,
  sendForwardError
} from "../utils/hardwareProxy.js";
import { paymentForwardTimeoutMs } from "../utils/paymentTimeouts.js";

const router = express.Router();

router.get("/elavon-config", (_req, res) => {
  try {
    const full = getPaxElavonConfig();
    const connection = getPaxElavonConnectionPayload();
    res.json({ success: true, connection, full });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to get Elavon config"
    });
  }
});

async function forwardToHardware(req, res, method, pathSuffix, body = null) {
  const store_id = req.headers["x-store-id"];
  logger.info("[CLOUD PAYMENT] Request", {
    method,
    path: pathSuffix,
    store_id,
    has_header: !!store_id
  });
  try {
    const result = await forwardToStoreHardware({
      storeId: store_id,
      method,
      path: `/api/payment${pathSuffix}`,
      body,
      timeoutMs: paymentForwardTimeoutMs(pathSuffix, config.pax_timeout_ms),
      logLabel: "CLOUD PAYMENT"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD PAYMENT] Forward failed", { message: err.message });
    return sendForwardError(res, err);
  }
}

router.get("/status", (req, res) => forwardToHardware(req, res, "GET", "/status"));
router.post("/initiate", (req, res) =>
  forwardToHardware(req, res, "POST", "/initiate", req.body || {})
);
router.post("/cancel", (req, res) =>
  forwardToHardware(req, res, "POST", "/cancel", req.body || {})
);
router.post("/void", (req, res) =>
  forwardToHardware(req, res, "POST", "/void", req.body || {})
);
router.post("/refund", (req, res) =>
  forwardToHardware(req, res, "POST", "/refund", req.body || {})
);

export default router;
