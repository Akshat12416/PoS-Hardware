/**
 * Cherry SPOS keyboard is OS HID input. The agent does not capture keys.
 */
import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    success: true,
    device: "Cherry SPOS",
    agent_integrated: false,
    os_managed: true,
    message:
      "Keyboard input is handled by Windows. The hardware agent does not capture Cherry SPOS keys."
  });
});

export default router;
