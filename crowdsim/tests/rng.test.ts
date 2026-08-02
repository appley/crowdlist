import assert from "node:assert/strict";
import test from "node:test";
import { SeededRng } from "../src/sim/rng.ts";

test("the same seed yields the same complete random stream", () => {
  const sample = () => { const rng = new SeededRng(42); return Array.from({ length: 64 }, () => rng.nextUint32()); };
  assert.deepEqual(sample(), sample());
});

test("different seeds do not collapse to one festival day", () => {
  const a = new SeededRng(42);
  const b = new SeededRng(43);
  assert.notEqual(a.nextUint32(), b.nextUint32());
});
