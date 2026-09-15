import express from "express";
import logger from "../utils/logger.js";
import {
  forwardToStoreHardware,
  sendForwardError
} from "../utils/hardwareProxy.js";

const router = express.Router();

async function handlePrinterList(req, res) {
  try {
    const result = await forwardToStoreHardware({
      storeId: req.headers["x-store-id"],
      method: "GET",
      path: "/api/printer/list",
      timeoutMs: 8000,
      logLabel: "CLOUD PRINTER"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD PRINTER] List failed", { message: err.message });
    return sendForwardError(res, err);
  }
}

router.get("/printer/list", handlePrinterList);
router.get("/list", handlePrinterList);

router.post("/printer/print", async (req, res) => {
  try {
    const result = await forwardToStoreHardware({
      storeId: req.headers["x-store-id"],
      method: "POST",
      path: "/api/printer/print",
      body: req.body || {},
      timeoutMs: 15000,
      logLabel: "CLOUD PRINTER"
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    logger.error("[CLOUD PRINTER] Print failed", { message: err.message });
    return sendForwardError(res, err);
  }
});

export default router;
