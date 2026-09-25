import { test } from "node:test";
import assert from "node:assert/strict";
import { usageToChar, isTerminatorUsage } from "../src/devices/scanner/hidDecode.js";
import { appendScanChunk } from "../src/devices/scanner/scanner.buffer.js";
import {
  createWedgeState,
  pushWedgeKey,
  flushIdleWedge
} from "../src/devices/scanner/wedgeBuffer.js";

test("usageToChar maps letters and digits", () => {
  assert.equal(usageToChar(4, false), "a");
  assert.equal(usageToChar(4, true), "A");
  assert.equal(usageToChar(30, false), "1");
  assert.equal(usageToChar(39, false), "0");
});

test("enter and tab are terminators", () => {
  assert.equal(isTerminatorUsage(40), true);
  assert.equal(isTerminatorUsage(43), true);
  assert.equal(isTerminatorUsage(4), false);
});

test("appendScanChunk flushes on CR/LF", () => {
  const first = appendScanChunk("", "12345");
  assert.equal(first.value, null);
  assert.deepEqual(first.values, []);
  assert.equal(first.rest, "12345");
  const second = appendScanChunk(first.rest, "678\r\n");
  assert.equal(second.value, "12345678");
  assert.deepEqual(second.values, ["12345678"]);
  assert.equal(second.rest, "");
});

test("appendScanChunk yields every complete barcode", () => {
  const parsed = appendScanChunk("", "aaa\nbbb\r\nccc\npartial");
  assert.deepEqual(parsed.values, ["aaa", "bbb", "ccc"]);
  assert.equal(parsed.value, "ccc");
  assert.equal(parsed.rest, "partial");
});

test("pushWedgeKey accepts a fast burst and ignores slow typing", () => {
  let state = createWedgeState();
  let now = 1000;
  for (const key of "201650053396") {
    now += 20;
    const step = pushWedgeKey(state, key, now);
    state = step.state;
    assert.equal(step.value, null);
  }
  const scanned = pushWedgeKey(state, "ENTER", now + 20);
  assert.equal(scanned.value, "201650053396");

  state = createWedgeState();
  now = 5000;
  for (const key of "hello") {
    now += 300;
    const step = pushWedgeKey(state, key, now);
    state = step.state;
  }
  const typed = pushWedgeKey(state, "ENTER", now + 300);
  assert.equal(typed.value, null);
});

test("flushIdleWedge finishes a fast burst with no Enter", () => {
  let state = createWedgeState();
  let now = 1000;
  for (const key of "201650053396") {
    now += 10;
    state = pushWedgeKey(state, key, now).state;
  }
  assert.equal(flushIdleWedge(state, now + 50).value, null);
  const flushed = flushIdleWedge(state, now + 200);
  assert.equal(flushed.value, "201650053396");
  assert.equal(flushed.state.buffer, "");
});

test("flushIdleWedge ignores short keyboard typing", () => {
  let state = createWedgeState();
  state = pushWedgeKey(state, "a", 1000).state;
  state = pushWedgeKey(state, "b", 1050).state;
  assert.equal(flushIdleWedge(state, 2000).value, null);
});

test("usageToChar maps symbols used by barcodes", () => {
  assert.equal(usageToChar(45, false), "-");
  assert.equal(usageToChar(45, true), "_");
  assert.equal(usageToChar(56, false), "/");
});
