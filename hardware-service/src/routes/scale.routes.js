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
    connected: health.connected,
    demo: Boolean(health.demo)
  });
});

router.post("/simulate", (req, res) => {
  if (!isDemoMode()) {
    return res.status(403).json({
      success: false,
      message: "Scale simulate is only available when DEMO_MODE=true"
    });
  }
  const raw = req.body?.weight ?? req.body?.value;
  const weight = typeof raw === "number" ? raw : parseWeight(String(raw ?? ""));
  if (weight == null || Number.isNaN(weight)) {
    return res.status(400).json({
      success: false,
      message: "body.weight (number) required"
    });
  }
  setLastWeight(weight);
  res.json({
    success: true,
    demo: true,
    weight,
    unit: "kg"
  });
});

export default router;
