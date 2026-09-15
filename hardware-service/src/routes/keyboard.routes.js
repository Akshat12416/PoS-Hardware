/**
 * POS Keyboard (Cherry SPOS) - status stub.
 * Keyboard is typically used for hotkeys/shortcuts; no driver needed for standard input.
 */
import { Router } from "express";

const router = Router();

/**
 * GET /api/keyboard/status
 * Keyboard integration status (stub)
 */
router.get("/status", (_, res) => {
  res.json({
    success: true,
    message: "Cherry SPOS: use as standard keyboard; optional hotkey capture can be added",
    configured: true
  });
});

export default router;
