/**
 * Simulated Ingenico/CWS responses for DEMO_MODE only.
 * These never contact Elavon. Use order_id containing DECLINE to test a decline.
 */
export function demoPaymentStatus() {
  return {
    success: true,
    demo: true,
    enabled: true,
    configured: true,
    ready: true,
    bridge_online: true,
    cws_reachable: true,
    reader_detected: true,
    gateway_ready: true,
    status: "idle",
    mode: "demo",
    terminal_type: "ingenico",
    terminal_model: "LAN360-USPOS16A",
    terminal_connection: "usb",
    card_reader: { product: "DEMO Ingenico Lane/3600" },
    message: "DEMO MODE — payment is simulated, not sent to Elavon"
  };
}

export function demoSale({ amount, currency = "USD", order_id }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error("amount (number > 0) is required");
    err.code = "PAX_INVALID_INPUT";
    throw err;
  }

  const decline =
    String(order_id || "").toUpperCase().includes("DECLINE") || n === 0.01;

  const payload = {
    demo: true,
    amount: n,
    currency,
    orderId: order_id || null,
    transactionId: `DEMO-${Date.now()}`,
    authCode: decline ? null : "DEMOOK",
    cardBrand: "VISA",
    last4: "4242"
  };

  if (decline) {
    const err = new Error("DEMO declined — not sent to Elavon");
    err.code = "PAX_DECLINED";
    err.paxResult = payload;
    err.response = { success: false, approved: false, ...payload };
    throw err;
  }

  return {
    success: true,
    approved: true,
    status: "approved",
    message: "DEMO approval — not sent to Elavon",
    ...payload
  };
}

export function demoCancel() {
  return {
    success: true,
    demo: true,
    cancelled: true,
    message: "DEMO cancel"
  };
}

export function demoVoid({ ref_num }) {
  if (!ref_num) {
    const err = new Error("ref_num is required for void");
    err.code = "PAX_INVALID_INPUT";
    throw err;
  }
  return {
    success: true,
    demo: true,
    approved: true,
    transactionId: ref_num,
    message: "DEMO void — not sent to Elavon"
  };
}

export function demoRefund({ amount, ref_num }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error("amount (number > 0) is required");
    err.code = "PAX_INVALID_INPUT";
    throw err;
  }
  return {
    success: true,
    demo: true,
    approved: true,
    amount: n,
    transactionId: ref_num || `DEMO-REFUND-${Date.now()}`,
    message: "DEMO refund — not sent to Elavon"
  };
}
