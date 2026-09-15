import { Router } from "express";
import {
  getLastScan,
  setLastScan,
  getScannerHealth
} from "../devices/scanner/scanner.service.js";

const router = Router();

router.get("/status", (_req, res) => {
  const health = getScannerHealth();
  res.json({
    success: true,
    connected: health.connected,
    ...health
  });
});

router.get("/last", (_req, res) => {
  res.json({
    success: true,
    scan: getLastScan()
  });
});

router.post("/simulate", (req, res) => {
  const value = req.body?.value;
  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({
      success: false,
      message: "body.value (string) required"
    });
  }
  setLastScan(value.trim());
  res.json({
    success: true,
    scan: getLastScan()
  });
});

export default router;
