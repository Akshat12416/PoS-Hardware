import { test } from "node:test";
import assert from "node:assert/strict";
import { usageToChar, isTerminatorUsage } from "../src/devices/scanner/hidDecode.js";
import { appendScanChunk } from "../src/devices/scanner/scanner.buffer.js";

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

test("usageToChar maps symbols used by barcodes", () => {
  assert.equal(usageToChar(45, false), "-");
  assert.equal(usageToChar(45, true), "_");
  assert.equal(usageToChar(56, false), "/");
});
