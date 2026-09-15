/**
 * CWS health check — run on the POS PC where Commerce Web Services is installed.
 *
 *   npm run test:cws
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { CwsPaymentService } from "../pax-bridge/cwsPayment.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const cws = new CwsPaymentService();

async function main() {
  console.log("CWS health check");
  console.log("================");
  console.log(`CWS URL: ${process.env.CWS_BASE_URL || "https://localhost:9790/rest/command"}`);
  console.log(`Terminal: ${process.env.PAYMENT_TERMINAL_TYPE || "ingenico"} ${process.env.PAYMENT_TERMINAL_MODEL || ""} (${process.env.PAYMENT_TERMINAL_CONNECTION || "usb"})`);
  console.log(`Converge merchant: ${process.env.CONVERGE_SSL_MERCHANT_ID || "(not set)"}`);
  console.log(`Vendor ID set: ${cws.vendorIdConfigured() ? "yes" : "NO — waiting on Daniel"}`);
  console.log("");

  try {
    const env = await cws.ping();
    console.log("getEnvironmentInfo: OK");
    console.log(`  CWS version: ${env.cws?.version || env.cws?.cwsVersionInfo?.version || "?"}`);
    console.log(`  ConvergeConnect: ${env.convergeConnect?.version || "?"}`);
  } catch (err) {
    console.error("getEnvironmentInfo: FAILED");
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  const reader = await cws.getCardReaderInfo();
  console.log(`Card reader: ${reader ? JSON.stringify(reader) : "none detected"}`);

  if (cws.vendorIdConfigured()) {
    try {
      const opened = await cws.openPaymentGateway();
      console.log(`openPaymentGateway: OK (id=${opened.paymentGatewayId})`);
    } catch (err) {
      console.error(`openPaymentGateway: FAILED — ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("openPaymentGateway: skipped (set CONVERGE_SSL_VENDOR_ID when Daniel sends it)");
  }

  console.log("");
  console.log("Health check complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
