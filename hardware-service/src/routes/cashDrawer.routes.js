import { Router } from "express";
import { config } from "../config.js";
import {
  openDrawer,
  isDrawerReady,
  getDrawerHealth
} from "../devices/cashDrawer/cashDrawer.service.js";

const router = Router();

router.get("/status", (_req, res) => {
  const health = getDrawerHealth(config);
  res.json({
    success: true,
    ...health,
    message: health.configured
      ? `Cash drawer mode=${health.mode}`
      : health.discovery_hint
  });
});

router.post("/open", async (_req, res) => {
  try {
    if (!isDrawerReady(config)) {
      return res.status(503).json({
        success: false,
        message: "Cash drawer not configured",
        hint: "Complete docs/CASH_DRAWER_DISCOVERY.md and set cash_drawer_mode to serial or printer"
      });
    }
    const result = await openDrawer(config);
    res.json({
      success: true,
      message: "Cash drawer open command sent",
      mode: result.mode
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
