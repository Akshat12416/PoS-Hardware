import { Router } from "express";
import { config } from "../config.js";
import { probePaxBridge } from "../utils/paxBridgeProbe.js";
import { getPrinterHealth, listPrinters } from "../devices/printer/printer.windows.js";
import { getScannerHealth } from "../devices/scanner/scanner.service.js";
import { getScaleHealth } from "../devices/scale/scale.service.js";
import { getDrawerHealth } from "../devices/cashDrawer/cashDrawer.service.js";

const router = Router();

function maskBridgeUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(unparseable URL)";
  }
}

router.get("/", async (_req, res) => {
  let bridge = null;
  if (config.pax_enabled && config.pax_bridge_url) {
    try {
      bridge = await probePaxBridge(config.pax_bridge_url);
    } catch (err) {
      bridge = { ok: false, via: null, detail: err.message };
    }
  }

  let printers = [];
  try {
    printers = await listPrinters();
  } catch (err) {
    printers = [];
  }

  const printer = getPrinterHealth();
  const scanner = getScannerHealth();
  const scale = getScaleHealth();
  const drawer = getDrawerHealth(config);

  res.json({
    success: true,
    terminal_uid: config.terminal_uid,
    approved: config.approved,
    store_id: config.store_id || null,
    last_boot_at: config.last_boot_at || null,
    ngrok_url: process.env.NGROK_URL || null,
    printer: {
      ...printer,
      installed_printers: printers
    },
    scanner,
    scale,
    cash_drawer: drawer,
    keyboard: { agent_integrated: false, os_managed: true, device: "Cherry SPOS" },
    display: {
      agent_integrated: false,
      devices: ["Planar WP215BGTCW", "Remote Weight 8300RD"]
    },
    payment: {
      enabled: config.pax_enabled,
      terminal_type: config.payment_terminal_type || "ingenico",
      terminal_model: config.payment_terminal_model || null,
      terminal_serial: config.payment_terminal_serial || null,
      terminal_connection: config.payment_terminal_connection || "usb",
      bridge_url: maskBridgeUrl(config.pax_bridge_url),
      bridge_reachable: bridge?.ok ?? null,
      bridge_probe_via: bridge?.via ?? null,
      bridge_probe_detail: bridge?.detail ?? null,
      timeout_ms: config.pax_timeout_ms
    }
  });
});

export default router;
