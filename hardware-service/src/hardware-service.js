import "dotenv/config";
import express from "express";
import printerRoutes from "./routes/printer.routes.js";
import scannerRoutes from "./routes/scanner.routes.js";
import scaleRoutes from "./routes/scale.routes.js";
import cashDrawerRoutes from "./routes/cashDrawer.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import diagnosticsRoutes from "./routes/diagnostics.routes.js";
import keyboardRoutes from "./routes/keyboard.routes.js";
import displayRoutes from "./routes/display.routes.js";
import { initKeyboardWedgeScanner } from "./devices/scanner/scanner.hid.js";
import { initUsbHidScanner } from "./devices/scanner/scanner.usbHid.js";
import { initScanner } from "./devices/scanner/scanner.service.js";
import { verifyHardwareAgent } from "./middleware/verifyHardwareAgent.js";
import { heartbeat } from "./heartbeat.js";
import { config } from "./config.js";
import { initScale } from "./devices/scale/scale.service.js";
import logger from "./utils/logger.js";
import { probePaxBridge } from "./utils/paxBridgeProbe.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

function validatePaxStartupConfig() {
  if (!config.pax_enabled) return;

  const bridgeUrl = String(config.pax_bridge_url || "").trim();
  if (!bridgeUrl) {
    const msg =
      "[PAX] pax_enabled=true but pax_bridge_url is empty — set PAX_BRIDGE_URL or config.json";
    if (config.pax_strict_startup) {
      logger.error(msg);
      process.exit(1);
    }
    logger.warn(msg);
    return;
  }

  const localBridge =
    /^https?:\/\/localhost(?::\d+)?/i.test(bridgeUrl) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?/i.test(bridgeUrl);

  if (localBridge) {
    logger.warn(
      "[PAX] pax_bridge_url uses loopback — normal when the SDK bridge runs on this same PC."
    );
  }
}

async function assertPaxBridgeReachableIfConfigured() {
  if (!config.pax_enabled) return;

  const bridgeUrl = String(config.pax_bridge_url || "").trim();
  if (!bridgeUrl) return;

  const runProbe = config.pax_strict_startup || config.pax_bridge_startup_probe;
  if (!runProbe) return;

  const result = await probePaxBridge(bridgeUrl);
  if (result.ok) {
    logger.info(`[PAX] Bridge reachable (${result.via})`);
    return;
  }

  const msg = `[PAX] Bridge not reachable at ${bridgeUrl.replace(/\/+$/, "")} — ${result.detail || "check PAX_BRIDGE_URL and that the bridge is running"}`;
  if (config.pax_strict_startup) {
    logger.error(msg);
    process.exit(1);
  }
  logger.warn(msg);
}

/* ----------------------------------------------------
   HEALTH (minimal — no secrets)
---------------------------------------------------- */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    approved: Boolean(config.approved)
  });
});

/* ----------------------------------------------------
   LOCK GATE
---------------------------------------------------- */
function lockGate(req, res, next) {
  if (!config.approved || !config.store_id) {
    return res.status(423).json({
      success: false,
      message: "Terminal not approved"
    });
  }
  next();
}

/* ----------------------------------------------------
   HARDWARE ROUTES
---------------------------------------------------- */
app.use("/api/printer", lockGate, verifyHardwareAgent, printerRoutes);
app.use("/api/scanner", lockGate, verifyHardwareAgent, scannerRoutes);
app.use("/api/scale", lockGate, verifyHardwareAgent, scaleRoutes);
app.use("/api/cash-drawer", lockGate, verifyHardwareAgent, cashDrawerRoutes);
app.use("/api/payment", lockGate, verifyHardwareAgent, paymentRoutes);
app.use(
  "/api/terminal/diagnostics",
  lockGate,
  verifyHardwareAgent,
  diagnosticsRoutes
);
app.use("/api/keyboard", lockGate, verifyHardwareAgent, keyboardRoutes);
app.use("/api/display", lockGate, verifyHardwareAgent, displayRoutes);

/* ----------------------------------------------------
   DEVICE INIT (scale: Datalogic / Remote Weight)
---------------------------------------------------- */
initScale({
  path: config.scale_serial_path,
  baudRate: config.scale_baud_rate
}).catch(() => { });

initScanner({
  path: config.scanner_serial_path,
  baudRate: config.scanner_baud_rate
}).catch(() => { });

initUsbHidScanner({
  vendorId: config.scanner_hid_vendor_id,
  productId: config.scanner_hid_product_id
})
  .then((result) => {
    // Keep keyboard wedge fallback only when USB HID listener is unavailable.
    if (!result?.started) {
      const started = initKeyboardWedgeScanner();
      if (!started) {
        logger.warn("[SCANNER] No active scanner input listener (USB HID + wedge unavailable)");
      }
    }
  })
  .catch((err) => {
    logger.warn(`[SCANNER] USB HID init failed (${err.message}); trying keyboard wedge fallback`);
    const started = initKeyboardWedgeScanner();
    if (!started) {
      logger.warn("[SCANNER] No active scanner input listener after fallback");
    }
  });

/* ----------------------------------------------------
   START SERVER
---------------------------------------------------- */
async function startHardwareService() {
  validatePaxStartupConfig();
  await assertPaxBridgeReachableIfConfigured();

  const server = app.listen(3001, "127.0.0.1", () => {
    console.log("🖥️ Hardware agent running on http://127.0.0.1:3001");
    console.log("🌐 NGROK:", process.env.NGROK_URL);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        "❌ Port 3001 is already in use.\n" +
          "   Another instance of this service may be running.\n" +
          "   Run: Get-NetTCPConnection -LocalPort 3001 | Select OwningProcess\n" +
          "   Then: Stop-Process -Id <PID> -Force"
      );
    } else {
      console.error("❌ Server error:", err.message);
    }
    process.exit(1);
  });
}

startHardwareService().catch((err) => {
  console.error("❌ Hardware service failed to start:", err.message);
  process.exit(1);
});

/* ----------------------------------------------------
   HEARTBEAT LOOP
---------------------------------------------------- */
setInterval(heartbeat, 10_000);
