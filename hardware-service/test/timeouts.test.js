import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { fetchWithTimeout } from "../src/utils/fetchWithTimeout.js";
import { paymentForwardTimeoutMs } from "../src/utils/paymentTimeouts.js";

test("paymentForwardTimeoutMs keeps status short and sales long", () => {
  assert.equal(paymentForwardTimeoutMs("/status", 120000), 8000);
  assert.equal(paymentForwardTimeoutMs("/initiate", 120000), 120000);
  assert.equal(paymentForwardTimeoutMs("/initiate", 180000), 180000);
  assert.equal(paymentForwardTimeoutMs("/refund", 5000), 120000);
});

test("fetchWithTimeout aborts slow responses", async () => {
  const server = http.createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    }, 400);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  await assert.rejects(
    () => fetchWithTimeout(`http://127.0.0.1:${port}/slow`, { timeoutMs: 50 }),
    (err) => err.code === "FETCH_TIMEOUT"
  );

  await new Promise((resolve) => server.close(resolve));
});

test("fetchWithTimeout returns when the server answers in time", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const res = await fetchWithTimeout(`http://127.0.0.1:${port}/ok`, {
    timeoutMs: 1000
  });
  assert.equal(res.ok, true);
  await new Promise((resolve) => server.close(resolve));
});
