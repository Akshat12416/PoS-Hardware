/**
 * Touchscreen (Planar WP215BGTCW) / Remote Weight Screen (8300RD).
 * Display devices: no driver required; weight display uses scale API.
 */
import { Router } from "express";

const router = Router();

/**
 * GET /api/display/status
 * Touchscreen and remote weight screen status (stub)
 */
router.get("/status", (_, res) => {
  res.json({
    success: true,
    message:
      "Touchscreen (Planar) and Remote Weight (8300RD): display only; use GET /api/scale/weight for weight display",
    configured: true
  });
});

export default router;
