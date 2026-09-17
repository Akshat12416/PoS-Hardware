import { Router } from "express";
import {
  getLastWeight,
  getScaleHealth,
  setLastWeight
} from "../devices/scale/scale.service.js";
import { isDemoMode } from "../utils/demoMode.js";
import parseWeight from "../devices/scale/scale.parser.js";

const router = Router();

router.get("/status", (_req, res) => {
  const health = getScaleHealth();
  res.json({
    success: true,
    connected: health.connected,
    ...health
  });
});

router.get("/weight", (_req, res) => {
  const weight = getLastWeight();
  const health = getScaleHealth();
  res.json({
    success: true,
    weight: weight != null ? weight : null,
    unit: "kg",
    last_weight_at: health.last_weight_at,
    connected: health.connected
  });
});

export default router;
