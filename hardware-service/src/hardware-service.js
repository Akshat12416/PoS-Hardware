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
import localTerminalRoutes from "./routes/localTerminal.routes.js";
import { initScannerInput, closeScanner } from "./devices/scanner/scanner.service.js";
import { verifyHardwareAgent } from "./middleware/verifyHardwareAgent.js";
import { heartbeat } from "./heartbeat.js";
import { config } from "./config.js";
import { initScale, closeScale } from "./devices/scale/scale.service.js";
import logger from "./utils/logger.js";
import { probePaxBridge } from "./utils/paxBridgeProbe.js";
import { validateConfig } from "./config/validateConfig.js";
import { isDemoMode, demoBanner } from "./utils/demoMode.js";

const BIND_HOST = "127.0.0.1";
const PORT = Number(process.env.HARDWARE_PORT || 3001);

const app = express();
app.use(express.json({ limit: "100kb" }));

function validatePaxStartupConfig() {
  if (!config.pax_enabled) return;

  const bridgeUrl = String(config.pax_bridge_url || "").trim();
  if (!bridgeUrl) {
    const msg =
      "[PAYMENT] pax_enabled=true but pax_bridge_url is empty — set PAX_BRIDGE_URL or config.json";
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
    logger.info(
      "[PAYMENT] pax_bridge_url uses loopback — expected when the CWS bridge runs on this PC."
    );
  }
}

async function assertPaxBridgeReachableIfConfigured() {
  if (!config.pax_enabled) return;

  const bridgeUrl = String(config.pax_bridge_url || "").trim();
  if (!bridgeUrl) return;

  const runProbe = config.pax_strict_startup || config.pax_bridge_startup_probe;
  if (!runProbe) return;

  const result = await probePaxBridge(bridgeUrl, config.pax_timeout_ms);
  if (result.ok) {
    logger.info(`[PAYMENT] CWS bridge reachable (${result.via})`);
    return;
  }

  const msg = `[PAYMENT] Bridge not reachable at ${bridgeUrl.replace(/\/+$/, "")} — ${result.detail || "start npm run start:pax-bridge"}`;
  if (config.pax_strict_startup) {
    logger.error(msg);
    process.exit(1);
  }
  logger.warn(msg);
}

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    approved: Boolean(config.approved) || isDemoMode(),
    role: "hardware-agent",
    demo: isDemoMode(),
    bind: `${BIND_HOST}:${PORT}`
  });
});

function lockGate(req, res, next) {
  if (isDemoMode()) return next();
  if (!config.approved || !config.store_id) {
    return res.status(423).json({
      success: false,
      message: "Terminal not approved"
    });
  }
  next();
}

app.use("/api/terminal/diagnostics", lockGate, verifyHardwareAgent, diagnosticsRoutes);
app.use("/api/terminal", localTerminalRoutes);
app.use("/api/printer", lockGate, verifyHardwareAgent, printerRoutes);
app.use("/api/scanner", lockGate, verifyHardwareAgent, scannerRoutes);
app.use("/api/scale", lockGate, verifyHardwareAgent, scaleRoutes);
app.use("/api/cash-drawer", lockGate, verifyHardwareAgent, cashDrawerRoutes);
app.use("/api/payment", lockGate, verifyHardwareAgent, paymentRoutes);
app.use("/api/keyboard", lockGate, verifyHardwareAgent, keyboardRoutes);
app.use("/api/display", lockGate, verifyHardwareAgent, displayRoutes);

async function initDevices() {
  if (isDemoMode()) {
    logger.warn(demoBanner());
    await initScale({ demo: true });
    await initScannerInput({ mode: "demo" });
    return;
  }

  await initScale({
    path: config.scale_serial_path,
    baudRate: config.scale_baud_rate
  });

  await initScannerInput({
    mode: config.scanner_mode,
    path: config.scanner_serial_path,
    baudRate: config.scanner_baud_rate,
    vendorId: config.scanner_hid_vendor_id,
    productId: config.scanner_hid_product_id,
    allowKeyboardWedge: config.scanner_allow_keyboard_wedge
  });
}

let server = null;
let heartbeatTimer = null;

async function shutdown(signal) {
  logger.info(`[AGENT] Shutting down (${signal})`);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await Promise.allSettled([closeScale(), closeScanner()]);
  await new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  process.exit(0);
}

async function startHardwareService() {
  const validation = validateConfig({
    ...config,
    demo_mode: isDemoMode()
  });
  for (const warning of validation.warnings) logger.warn(`[CONFIG] ${warning}`);
  for (const error of validation.errors) logger.error(`[CONFIG] ${error}`);
  if (validation.errors.length && config.pax_strict_startup) {
    process.exit(1);
  }

  validatePaxStartupConfig();
  if (!isDemoMode()) {
    await assertPaxBridgeReachableIfConfigured();
  }
  await initDevices();

  server = app.listen(PORT, BIND_HOST, () => {
    console.log(`Hardware agent running on http://${BIND_HOST}:${PORT}`);
    if (isDemoMode()) {
      console.log(demoBanner());
    }
    console.log("NGROK:", process.env.NGROK_URL || "(not set — local tests do not need it)");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use.\n` +
          "   Another instance of this service may be running.\n" +
          `   Run: Get-NetTCPConnection -LocalPort ${PORT} | Select OwningProcess\n` +
          "   Then: Stop-Process -Id <PID> -Force"
      );
    } else {
      console.error("Server error:", err.message);
    }
    process.exit(1);
  });

  heartbeatTimer = setInterval(heartbeat, 10_000);
  if (isDemoMode()) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startHardwareService().catch((err) => {
  console.error("Hardware service failed to start:", err.message);
  process.exit(1);
});
