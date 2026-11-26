import test from "node:test";
import assert from "node:assert/strict";
import { zarCentsToTokenUnits } from "../src/lib/fx.js";

test("converts a ZAR amount to six-decimal test token units", () => {
  assert.equal(zarCentsToTokenUnits(1850, 18.5), 1_000_000n);
});

test("rounds token units to the nearest micro-unit", () => {
  assert.equal(zarCentsToTokenUnits(1, 18.5), 541n);
});

test("rejects a non-positive exchange rate", () => {
  assert.throws(() => zarCentsToTokenUnits(100, 0), /positive/);
});
