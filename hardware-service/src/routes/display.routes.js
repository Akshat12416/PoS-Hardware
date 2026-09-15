/**
 * Planar touchscreen and 8300RD customer display are OS/device-managed.
 * Weight shown on 8300RD comes from the scale serial stream, not this API.
 */
import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    success: true,
    devices: [
      {
        name: "Planar WP215BGTCW",
        role: "operator_touchscreen",
        agent_integrated: false,
        os_managed: true
      },
      {
        name: "Remote Weight 8300RD",
        role: "customer_weight_display",
        agent_integrated: false,
        data_source: "GET /api/scale/weight"
      }
    ],
    message:
      "Touchscreen is Windows display/touch. 8300RD is driven by the scale; use GET /api/scale/weight for weight data."
  });
});

export default router;
