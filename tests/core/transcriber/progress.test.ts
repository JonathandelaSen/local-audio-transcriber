import test from "node:test";
import assert from "node:assert/strict";

import { upsertProgressItem } from "../../../src/lib/transcriber/core/progress";

test("upsertProgressItem appends a new progress item when file key is missing", () => {
  const next = upsertProgressItem([], {
    file: "model.bin",
    name: "model",
    progress: 10,
  });

  assert.equal(next.length, 1);
  assert.equal(next[0].file, "model.bin");
});

test("upsertProgressItem replaces existing item with same file key", () => {
  const initial = [
    { file: "model.bin", name: "model", progress: 10 },
    { file: "tokenizer.json", name: "tokenizer", progress: 30 },
  ];

  const next = upsertProgressItem(initial, {
    file: "model.bin",
    name: "model",
    progress: 95,
  });

  assert.equal(next.length, 2);
  assert.equal(next[0].progress, 95);
  assert.equal(next[1].progress, 30);
});

test("upsertProgressItem does not mutate the input array", () => {
  const initial = [
    { file: "model.bin", name: "model", progress: 10 },
  ];

  const next = upsertProgressItem(initial, {
    file: "model.bin",
    name: "model",
    progress: 80,
  });

  assert.notEqual(next, initial);
  assert.equal(initial[0].progress, 10);
  assert.equal(next[0].progress, 80);
});

test("upsertProgressItem appends new entries at the end while preserving existing order", () => {
  const initial = [
    { file: "a.bin", name: "a", progress: 10 },
    { file: "b.bin", name: "b", progress: 20 },
  ];

  const next = upsertProgressItem(initial, {
    file: "c.bin",
    name: "c",
    progress: 30,
  });

  assert.deepEqual(
    next.map((item) => item.file),
    ["a.bin", "b.bin", "c.bin"]
  );
});
