import express from "express";
import fetch from "node-fetch";
import { getActiveTerminalForStore } from "../utils/hardwareRegistry.js";
import logger from "../utils/logger.js";

const router = express.Router();

async function parseHardwareResponse(hRes) {
  const raw = await hRes.text();
  try {
    return JSON.parse(raw);
  } catch {
    return {
      success: false,
      message: "Invalid response from hardware"
    };
  }
}

async function handlePrinterList(req, res) {
  try {
    const store_id = req.headers["x-store-id"];
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: "Missing x-store-id"
      });
    }

    const terminal = await getActiveTerminalForStore(store_id);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "No active terminal"
      });
    }

    const { terminal_uid, hardware_url, agent_secret } = terminal;
    const targetUrl = `${hardware_url}/api/printer/list`;

    let hardwareRes;
    try {
      hardwareRes = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          "x-terminal-id": terminal_uid,
          "x-agent-secret": agent_secret
        },
        timeout: 8000
      });
    } catch (netErr) {
      return res.status(502).json({
        success: false,
        message: "Hardware agent unreachable"
      });
    }

    const data = await parseHardwareResponse(hardwareRes);
    return res.status(hardwareRes.status).json(data);
  } catch (err) {
    logger.error("[CLOUD PRINTER] List failed", { message: err.message });
    return res.status(500).json({
      success: false,
      message: "Request failed"
    });
  }
}

router.get("/printer/list", handlePrinterList);
router.get("/list", handlePrinterList);

router.post("/printer/print", async (req, res) => {
  try {
    const store_id = req.headers["x-store-id"];
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: "Missing x-store-id"
      });
    }

    const terminal = await getActiveTerminalForStore(store_id);
    if (!terminal) {
      return res.status(404).json({
        success: false,
        message: "No active terminal"
      });
    }

    const { terminal_uid, hardware_url, agent_secret } = terminal;
    const targetUrl = `${hardware_url}/api/printer/print`;

    const hardwareRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "x-terminal-id": terminal_uid,
        "x-agent-secret": agent_secret
      },
      body: JSON.stringify(req.body),
      timeout: 15_000
    });

    const data = await parseHardwareResponse(hardwareRes);
    return res.status(hardwareRes.status).json(data);
  } catch (err) {
    logger.error("[CLOUD PRINTER] Print failed", { message: err.message });
    return res.status(500).json({
      success: false,
      message: "Request failed"
    });
  }
});

export default router;
