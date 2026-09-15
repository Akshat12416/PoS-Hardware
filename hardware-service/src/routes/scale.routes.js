import { Router } from "express";
import { getLastWeight } from "../devices/scale/scale.service.js";

const router = Router();

/**
 * GET /api/scale/status
 * Scale connection status
 */
router.get("/status", (_, res) => {
  res.json({ connected: true });
});

/**
 * GET /api/scale/weight
 * Last weight from scale (Datalogic Magellan 9300i / Remote Weight 8300RD)
 */
router.get("/weight", (_, res) => {
  const weight = getLastWeight();
  res.json({
    success: true,
    weight: weight != null ? weight : null,
    unit: "kg"
  });
});

export default router;

