import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReceiptText } from "../src/utils/receiptRenderer.js";

test("renderReceiptText includes company, items, and total", () => {
  const text = renderReceiptText({
    company_name: "Southwest Farmers",
    items: [{ name: "Apples", qty: 2, price: 1.5 }],
    total: 3,
    tax: 0
  });
  assert.match(text, /SOUTHWEST FARMERS/);
  assert.match(text, /Apples/);
  assert.match(text, /Total/);
  assert.match(text, /Thank you!/);
});

test("renderReceiptText wraps long item names", () => {
  const text = renderReceiptText({
    width: 32,
    items: [
      {
        name: "Organic heirloom tomato bunch extra large",
        qty: 1,
        price: 12.34
      }
    ],
    total: 12.34
  });
  const lines = text.split("\n");
  assert.ok(lines.some((line) => line.includes("Organic")));
  assert.ok(lines.every((line) => line.length <= 32 || line.trim() === ""));
});

test("renderReceiptText includes full payment status", () => {
  const text = renderReceiptText({
    items: [{ name: "Bananas", qty: 1, price: 3.13 }],
    total: 3.13,
    payment: { status: "DEMO APPROVED", reference: "DEMO-1" }
  });
  assert.match(text, /DEMO APPROVED/);
});

test("renderReceiptText wraps a SKU longer than the receipt width", () => {
  const sku = "SKU-" + "9".repeat(70);
  const text = renderReceiptText({
    width: 32,
    items: [{ name: sku, qty: 1, price: 1 }],
    total: 1
  });
  const lines = text.split("\n");
  assert.ok(lines.some((line) => line.includes("SKU-")));
  assert.ok(lines.every((line) => line.length <= 32 || line.trim() === ""));
});
