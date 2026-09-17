import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemoMode } from "../src/utils/demoMode.js";
import { demoSale, demoPaymentStatus } from "../src/devices/payment/demoPayment.js";
import { validateConfig } from "../src/config/validateConfig.js";

test("isDemoMode is off by default", () => {
  const previous = process.env.DEMO_MODE;
  delete process.env.DEMO_MODE;
  assert.equal(isDemoMode(), false);
  if (previous !== undefined) process.env.DEMO_MODE = previous;
});

test("demoSale approves normal amounts and declines DECLINE orders", () => {
  const approved = demoSale({ amount: 3.13, order_id: "DEMO-CART-1" });
  assert.equal(approved.demo, true);
  assert.equal(approved.approved, true);
  assert.equal(approved.success, true);

  assert.throws(
    () => demoSale({ amount: 1, order_id: "DEMO-DECLINE-1" }),
    (err) => err.code === "PAX_DECLINED"
  );
});

test("validateConfig in demo_mode does not require COM ports or CWS", () => {
  const result = validateConfig({
    demo_mode: true,
    approved: false,
    scanner_mode: "demo",
    cash_drawer_mode: "demo",
    pax_enabled: true,
    pax_bridge_url: ""
  });
  assert.equal(result.errors.length, 0);
});

test("demoPaymentStatus is clearly labeled", () => {
  const status = demoPaymentStatus();
  assert.equal(status.demo, true);
  assert.match(status.message, /not sent to Elavon/i);
});
