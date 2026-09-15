import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config/validateConfig.js";
import { isDrawerConfigured } from "../src/devices/cashDrawer/cashDrawer.logic.js";

test("validateConfig accepts a lab-ready agent config", () => {
  const result = validateConfig({
    approved: true,
    store_id: "store-1",
    printer_name: "EPSON TM-T88V Receipt",
    scanner_mode: "usb_hid",
    scanner_hid_vendor_id: 0x05e0,
    cash_drawer_mode: "printer",
    scale_serial_path: "COM3",
    pax_enabled: true,
    pax_bridge_url: "http://127.0.0.1:7001"
  });
  assert.equal(result.errors.length, 0);
});

test("validateConfig rejects serial scanner without a COM port", () => {
  const result = validateConfig({
    scanner_mode: "serial",
    scanner_serial_path: "",
    cash_drawer_mode: "unconfigured"
  });
  assert.ok(result.errors.some((e) => e.includes("scanner_serial_path")));
});

test("validateConfig rejects enabled payments without a bridge URL", () => {
  const result = validateConfig({
    pax_enabled: true,
    pax_bridge_url: "",
    cash_drawer_mode: "unconfigured",
    scanner_mode: "auto"
  });
  assert.ok(result.errors.some((e) => e.includes("pax_bridge_url")));
});

test("isDrawerConfigured requires an explicit mode and target", () => {
  assert.equal(isDrawerConfigured({ cash_drawer_mode: "unconfigured" }), false);
  assert.equal(
    isDrawerConfigured({
      cash_drawer_mode: "serial",
      cash_drawer_serial_path: "COM5"
    }),
    true
  );
  assert.equal(
    isDrawerConfigured({
      cash_drawer_mode: "printer",
      printer_name: "EPSON TM-T88V Receipt"
    }),
    true
  );
});
