import { Router } from "express";
import { getLastScan, setLastScan } from "../devices/scanner/scanner.service.js";

const router = Router();

/**
 * GET /api/scanner/status
 * Scanner (Zebra DS2278) status
 */
router.get("/status", (_, res) => {
  res.json({ connected: true });
});

/**
 * GET /api/scanner/last
 * Last scanned barcode from Zebra DS2278
 */
router.get("/last", (_, res) => {
  const scan = getLastScan();
  res.json({
    success: true,
    scan: scan ?? null
  });
});

/**
 * POST /api/scanner/simulate
 * Body: { value: "barcode" } - for testing when HID not attached
 */
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
