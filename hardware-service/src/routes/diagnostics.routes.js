import { Router } from "express";
import { config } from "../config.js";
import { probePaxBridge } from "../utils/paxBridgeProbe.js";

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

  res.json({
    success: true,
    terminal_uid: config.terminal_uid,
    approved: config.approved,
    store_id: config.store_id || null,
    last_boot_at: config.last_boot_at || null,
    ngrok_url: process.env.NGROK_URL || null,
    pax: {
      enabled: config.pax_enabled,
      bridge_url: maskBridgeUrl(config.pax_bridge_url),
      strict_startup: config.pax_strict_startup,
      startup_probe_env: config.pax_bridge_startup_probe,
      bridge_reachable: bridge?.ok ?? null,
      bridge_probe_via: bridge?.via ?? null,
      bridge_probe_detail: bridge?.detail ?? null,
      terminal_type: config.payment_terminal_type || "ingenico",
      terminal_model: config.payment_terminal_model || null,
      terminal_serial: config.payment_terminal_serial || null,
      terminal_connection: config.payment_terminal_connection || "usb",
      terminal_ip: config.pax_terminal_ip || null,
      timeout_ms: config.pax_timeout_ms
    },
    devices: {
      scale_serial_path: config.scale_serial_path || null,
      scanner_serial_path: config.scanner_serial_path || null,
      scanner_hid_vendor_id: config.scanner_hid_vendor_id || null,
      scanner_hid_product_id: config.scanner_hid_product_id || null,
      cash_drawer_serial_path: config.cash_drawer_serial_path || null
    }
  });
});

export default router;
