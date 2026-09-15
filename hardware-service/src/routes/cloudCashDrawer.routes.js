/**
 * Cloud proxy for cash drawer: forwards to the active hardware agent.
 */
import express from "express";
import logger from "../utils/logger.js";
import {
  forwardToStoreHardware,
  sendForwardError
} from "../utils/hardwareProxy.js";

const router = express.Router();

async function forward(req, res, method, pathSuffix, body = null) {
  logger.info("[CLOUD CASH-DRAWER] Request", {
    method,
    path: pathSuffix,
    store_id: req.headers["x-store-id"]
  });
  try {
    const result = await forwardToStoreHardware({
      storeId: req.headers["x-store-id"],
      method,
      path: `/api/cash-drawer${pathSuffix}`,
      body,
      timeoutMs: 8000,
      logLabel: "CLOUD CASH-DRAWER"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD CASH-DRAWER] Forward failed", { message: err.message });
    return sendForwardError(res, err);
  }
}

router.get("/status", (req, res) => forward(req, res, "GET", "/status"));
router.post("/open", (req, res) => forward(req, res, "POST", "/open", req.body || {}));

export default router;
