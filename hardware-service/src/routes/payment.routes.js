/**
 * Payment terminal (Ingenico Lane/3600 via CWS bridge).
 */
import { Router } from "express";
import {
  getPaxStatus,
  initiatePaxPayment,
  cancelPaxPayment,
  voidPaxPayment,
  refundPaxPayment
} from "../devices/payment/pax.service.js";
import {
  getPaxElavonConfig,
  getPaxElavonConnectionPayload
} from "../config/paxElavon.config.js";
import { config } from "../config.js";

const router = Router();

function paymentHttpStatus(err) {
  if (err.code === "PAX_NOT_ENABLED" || err.code === "PAX_BRIDGE_NOT_CONFIGURED") {
    return 503;
  }
  if (err.code === "PAX_INVALID_INPUT") return 400;
  if (err.code === "PAX_DECLINED") return 402;
  if (typeof err.response?.status === "number") return err.response.status;
  return 502;
}

router.get("/elavon-paths", (_req, res) => {
  const base = String(
    process.env.CLOUD_URL || config.cloud_url || ""
  ).replace(/\/+$/, "") || "https://YOUR_RENDER_OR_CLOUD_URL";
  res.json({
    success: true,
    summary:
      "Countertop: POST /api/payment/initiate → CWS bridge → Ingenico (USB). Browser: POST {cloud}/api/converge-hpp/checkout-session",
    converge_hosted_customer_entry_production:
      "https://api.convergepay.com/hosted-payments",
    cloud_endpoints: {
      converge_hpp_config: `${String(base).replace(/\/+$/, "")}/api/converge-hpp/config`,
      converge_checkout_session: `${String(base).replace(/\/+$/, "")}/api/converge-hpp/checkout-session`,
      converge_transaction_token: `${String(base).replace(/\/+$/, "")}/api/converge-hpp/transaction-token`
    },
    hardware_endpoints: {
      payment_initiate:
        "POST /api/payment/initiate (countertop sale via Ingenico + CWS)"
    }
  });
});

/**
 * GET /api/payment/elavon-config
 * Returns Elavon/PAX processor config (TID, MID, hosts, ports) for SDK or bridge setup.
 * No bridge or PAX_ENABLED required.
 */
router.get("/elavon-config", (_req, res) => {
  try {
    const full = getPaxElavonConfig();
    const connection = getPaxElavonConnectionPayload();
    res.json({
      success: true,
      connection,
      full
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to get Elavon config"
    });
  }
});

/**
 * GET /api/payment/status
 * Payment terminal status (via PAX bridge)
 */
router.get("/status", async (_req, res) => {
  try {
    const status = await getPaxStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch PAX status"
    });
  }
});

/**
 * POST /api/payment/initiate
 * Initiate payment
 */
router.post("/initiate", async (req, res) => {
  const { amount, currency = "USD", order_id } = req.body || {};
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "amount (number > 0) is required"
    });
  }

  try {
    const result = await initiatePaxPayment({
      amount: parsedAmount,
      currency,
      order_id
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    const status = paymentHttpStatus(err);
    res.status(status).json({
      success: false,
      message: err.response?.data?.message || err.message || "PAX initiate failed",
      code: err.code || err.response?.data?.code || undefined,
      responseCode: err.responseCode || err.paxResult?.responseCode || undefined,
      paxResult: err.paxResult || undefined,
      error: err.response?.data || undefined
    });
  }
});

/**
 * POST /api/payment/cancel
 * Cancel current transaction
 */
router.post("/cancel", async (_req, res) => {
  try {
    const result = await cancelPaxPayment();
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    const status = paymentHttpStatus(err);
    res.status(status).json({
      success: false,
      message: err.response?.data?.message || err.message || "PAX cancel failed",
      error: err.response?.data || undefined
    });
  }
});

/**
 * POST /api/payment/void
 * Void a transaction by ref_num
 */
router.post("/void", async (req, res) => {
  const { ref_num, amount } = req.body || {};

  if (!ref_num) {
    return res.status(400).json({
      success: false,
      message: "ref_num is required"
    });
  }

  try {
    const result = await voidPaxPayment({ ref_num, amount });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = paymentHttpStatus(err);
    res.status(status).json({
      success: false,
      message: err.message,
      code: err.code || "PAX_ERROR",
      responseCode: err.responseCode
    });
  }
});

/**
 * POST /api/payment/refund
 * Refund (return) a transaction
 */
router.post("/refund", async (req, res) => {
  const { amount, ref_num } = req.body || {};
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "amount (number > 0) is required"
    });
  }

  try {
    const result = await refundPaxPayment({ amount: parsedAmount, ref_num });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = paymentHttpStatus(err);
    res.status(status).json({
      success: false,
      message: err.message,
      code: err.code || "PAX_ERROR",
      responseCode: err.responseCode
    });
  }
});

export default router;
