import { test } from "node:test";
import assert from "node:assert/strict";
import parseWeight, { parseMagellan } from "../src/devices/scale/scale.parser.js";
import { appendScaleChunk } from "../src/devices/scale/scale.buffer.js";

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

test("parseMagellan reads the replies seen on the register", () => {
  assert.deepEqual(parseMagellan("S110001"), { status: "stable", weight: 0.01 });
  assert.deepEqual(parseMagellan("S1440001"), { status: "stable", weight: 0.01 });
  assert.deepEqual(parseMagellan("S111040"), { status: "stable", weight: 10.4 });
  assert.deepEqual(parseMagellan("S141"), { status: "motion", weight: null });
  assert.deepEqual(parseMagellan("S142"), { status: "under_zero", weight: null });
  assert.equal(parseMagellan("S1101250", "kg").weight, 1.25);
  assert.equal(parseWeight("S110001"), 0.01);
});

test("appendScaleChunk splits Magellan CR-only replies", () => {
  const parsed = appendScaleChunk("", "S110001\rS1440001\rS11");
  assert.deepEqual(parsed.lines, ["S110001", "S1440001"]);
  assert.equal(parsed.rest, "S11");
});

test("appendScaleChunk splits complete lines and keeps remainder", () => {
  const first = appendScaleChunk("", "WT: 1.250 kg\nST,GS,+00002.000kg");
  assert.deepEqual(first.lines, ["WT: 1.250 kg"]);
  assert.equal(first.rest, "ST,GS,+00002.000kg");
  const second = appendScaleChunk(first.rest, "\n");
  assert.deepEqual(second.lines, ["ST,GS,+00002.000kg"]);
  assert.equal(second.rest, "");
  assert.equal(parseWeight(first.lines[0]), 1.25);
  assert.equal(parseWeight(second.lines[0]), 2);
});
