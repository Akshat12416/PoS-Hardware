import { Router } from "express";
import { config } from "../config.js";
import { openDrawer, isConfigured } from "../devices/cashDrawer/cashDrawer.serial.js";

const router = Router();

/**
 * GET /api/cash-drawer/status
 * Whether cash drawer (M-S CF-405BX-M-B) is configured
 */
router.get("/status", (_, res) => {
  const configured = isConfigured(config.cash_drawer_serial_path);
  res.json({
    success: true,
    configured,
    message: configured
      ? "Cash drawer serial path configured"
      : "Set CASH_DRAWER_SERIAL_PATH for serial open"
  });
});

/**
 * POST /api/cash-drawer/open
 * Sends open command to cash drawer via serial
 */
router.post("/open", async (req, res) => {
  try {
    if (!isConfigured(config.cash_drawer_serial_path)) {
      return res.status(503).json({
        success: false,
        message: "Cash drawer not configured",
        hint: "Set CASH_DRAWER_SERIAL_PATH in config or environment"
      });
    }
    await openDrawer(config.cash_drawer_serial_path);
    res.json({
      success: true,
      message: "Cash drawer open command sent"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to open cash drawer",
      error: err.message
    });
  }
});

export default router;
