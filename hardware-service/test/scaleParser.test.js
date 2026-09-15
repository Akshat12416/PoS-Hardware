import { test } from "node:test";
import assert from "node:assert/strict";
import parseWeight from "../src/devices/scale/scale.parser.js";

test("parses WT prefix", () => {
  assert.equal(parseWeight("WT: 1.250 kg"), 1.25);
});

test("parses Magellan-style kg suffix", () => {
  assert.equal(parseWeight("S 000.500kg"), 0.5);
});

test("parses signed kg values", () => {
  assert.equal(parseWeight("ST,GS,+00001.250kg"), 1.25);
});

test("returns null for empty input", () => {
  assert.equal(parseWeight(""), null);
  assert.equal(parseWeight("READY"), null);
});
