/**
 * Cloud proxy for scale: forwards to the active hardware agent.
 */
import express from "express";
import logger from "../utils/logger.js";
import {
  forwardToStoreHardware,
  sendForwardError
} from "../utils/hardwareProxy.js";

const router = express.Router();

async function forwardGet(req, res, pathSuffix) {
  const store_id = req.headers["x-store-id"];
  logger.info("[CLOUD SCALE] Request", { path: pathSuffix, store_id });
  try {
    const result = await forwardToStoreHardware({
      storeId: store_id,
      method: "GET",
      path: `/api/scale${pathSuffix}`,
      timeoutMs: 8000,
      logLabel: "CLOUD SCALE"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD SCALE] Forward failed", { message: err.message });
    return sendForwardError(res, err);
  }
}

router.get("/status", (req, res) => forwardGet(req, res, "/status"));
router.get("/weight", (req, res) => forwardGet(req, res, "/weight"));

export default router;
