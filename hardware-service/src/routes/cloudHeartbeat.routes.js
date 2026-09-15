import express from "express";
import {
  registerHeartbeat,
  getTerminalRecordByStore,
  getTerminalRecordByUid
} from "../utils/hardwareRegistry.js";
import logger from "../utils/logger.js";
import { safeEqual } from "../utils/cryptoSafe.js";
import { validateHardwareUrl } from "../utils/urlSafety.js";

const router = express.Router();

router.post("/heartbeat", async (req, res) => {
  try {
    const terminal_uid = req.headers["x-terminal-id"];
    const agent_secret = req.headers["x-agent-secret"];
    const { store_id, hardware_url } = req.body || {};

    if (!terminal_uid || !agent_secret) {
      return res.status(401).json({
        success: false,
        message: "Missing authentication headers"
      });
    }

    if (!store_id || !hardware_url) {
      return res.status(400).json({
        success: false,
        message: "store_id and hardware_url are required"
      });
    }

    const urlCheck = validateHardwareUrl(hardware_url);
    if (!urlCheck.ok) {
      logger.warn("[HEARTBEAT] Rejected hardware_url", { reason: urlCheck.message });
      return res.status(400).json({
        success: false,
        message: urlCheck.message
      });
    }

    const byStore = await getTerminalRecordByStore(store_id);
    if (byStore) {
      if (!safeEqual(byStore.terminal_uid, terminal_uid)) {
        return res.status(403).json({
          success: false,
          message: "Store is registered to a different terminal"
        });
      }
      if (!safeEqual(byStore.agent_secret, agent_secret)) {
        return res.status(401).json({
          success: false,
          message: "Invalid agent secret"
        });
      }
    }

    const byUid = await getTerminalRecordByUid(terminal_uid);
    if (byUid && !safeEqual(byUid.store_id, store_id)) {
      return res.status(403).json({
        success: false,
        message: "Terminal is registered to a different store"
      });
    }
    if (byUid && !safeEqual(byUid.agent_secret, agent_secret)) {
      return res.status(401).json({
        success: false,
        message: "Invalid agent secret"
      });
    }

    await registerHeartbeat({
      terminal_uid,
      store_id,
      hardware_url: urlCheck.url,
      agent_secret
    });

    logger.info("[HEARTBEAT] Terminal registered / refreshed", {
      terminal_uid,
      store_id
    });

    return res.json({ success: true, store_id });
  } catch (err) {
    logger.error("[HEARTBEAT] Unhandled exception", { message: err.message });
    return res.status(500).json({
      success: false,
      message: "Heartbeat failed"
    });
  }
});

export default router;
