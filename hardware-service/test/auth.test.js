import { test } from "node:test";
import assert from "node:assert/strict";
import { safeEqual } from "../src/utils/cryptoSafe.js";
import { integrationHeaders } from "../src/middleware/integrationHeaders.js";

test("safeEqual is true for matching secrets", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual(null, "abc"), false);
});

test("integrationHeaders copies body credentials into headers", () => {
  const req = {
    headers: {},
    body: {
      store_id: "store-1",
      terminal_id: "TERM-1",
      agent_secret: "secret"
    },
    query: {}
  };
  let called = false;
  integrationHeaders(req, {}, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(req.headers["x-store-id"], "store-1");
  assert.equal(req.headers["x-terminal-id"], "TERM-1");
  assert.equal(req.headers["x-agent-secret"], "secret");
});

test("integrationHeaders does not take secrets from the query string", () => {
  const req = {
    headers: {},
    body: {},
    query: { agent_secret: "leaked", store_id: "store-1" }
  };
  integrationHeaders(req, {}, () => {});
  assert.equal(req.headers["x-store-id"], "store-1");
  assert.equal(req.headers["x-agent-secret"], undefined);
});
