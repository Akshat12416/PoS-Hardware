/**
 * Cloud proxy for scanner: forwards to the active hardware agent.
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
  logger.info("[CLOUD SCANNER] Request", { path: pathSuffix, store_id });
  try {
    const result = await forwardToStoreHardware({
      storeId: store_id,
      method: "GET",
      path: `/api/scanner${pathSuffix}`,
      timeoutMs: 8000,
      logLabel: "CLOUD SCANNER"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD SCANNER] Forward failed", { message: err.message });
    return sendForwardError(res, err);
  }
}

router.get("/status", (req, res) => forwardGet(req, res, "/status"));
router.get("/last", (req, res) => forwardGet(req, res, "/last"));
router.post("/simulate", async (req, res) => {
  try {
    const result = await forwardToStoreHardware({
      storeId: req.headers["x-store-id"],
      method: "POST",
      path: "/api/scanner/simulate",
      body: req.body || {},
      timeoutMs: 8000,
      logLabel: "CLOUD SCANNER"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD SCANNER] Simulate forward failed", {
      message: err.message
    });
    return sendForwardError(res, err);
  }
});

export default router;
