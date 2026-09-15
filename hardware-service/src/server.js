import "dotenv/config";
import express from "express";
import cors from "cors";
import cloudPrinterRoutes from "./routes/cloudPrinter.routes.js";
import cloudHeartbeatRoutes from "./routes/cloudHeartbeat.routes.js";
import cloudScannerRoutes from "./routes/cloudScanner.routes.js";
import cloudScaleRoutes from "./routes/cloudScale.routes.js";
import cloudCashDrawerRoutes from "./routes/cloudCashDrawer.routes.js";
import cloudPaymentRoutes from "./routes/cloudPayment.routes.js";
import terminalRoutes from "./routes/terminal.routes.js";
import integrationConfigRoutes from "./routes/integrationConfig.routes.js";
import convergeHppRoutes from "./routes/convergeHpp.routes.js";
import elavonDeveloperPaymentsRoutes from "./routes/elavonDeveloperPayments.routes.js";
import { integrationHeaders } from "./middleware/integrationHeaders.js";
import {
  securityHeaders,
  rateLimit,
  requireCloudApiSecret,
  requireCloudStoreAuth
} from "./middleware/security.js";
import { isProduction, isStrictSecurity } from "./config/production.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "x-store-id",
      "x-terminal-id",
      "x-agent-secret",
      "x-integration-secret",
      "x-cloud-api-secret",
      "Authorization"
    ]
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.use(integrationHeaders);

app.use("/api/integration-config", integrationConfigRoutes);

app.use("/api/converge-hpp", requireCloudApiSecret, convergeHppRoutes);
app.use("/api/elavon-payments", elavonDeveloperPaymentsRoutes);

app.use("/api/cloud", cloudHeartbeatRoutes);
app.use("/api/cloud", requireCloudStoreAuth, cloudPrinterRoutes);
app.use("/api/cloudprinter", requireCloudStoreAuth, cloudPrinterRoutes);
app.use("/api/scanner", requireCloudStoreAuth, cloudScannerRoutes);
app.use("/api/scale", requireCloudStoreAuth, cloudScaleRoutes);
app.use("/api/cash-drawer", requireCloudStoreAuth, cloudCashDrawerRoutes);
app.use("/api/payment", requireCloudStoreAuth, cloudPaymentRoutes);

app.use("/api/terminal", terminalRoutes);

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    production_security: isStrictSecurity()
  });
});

export default app;
