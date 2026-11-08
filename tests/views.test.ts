import assert from "node:assert/strict";
import test from "node:test";

import { dateOnly, when } from "../src/views.ts";

test("dates use a written month with slashes", () => {
  assert.equal(dateOnly("2026-03-11"), "March/11/2026");
  assert.equal(dateOnly("2026-11-25"), "November/25/2026");
  assert.equal(dateOnly(0), "January/01/1970");
  assert.equal(dateOnly(""), "");
});

test("timestamps keep the written date and short time", () => {
  const stamp = when(0);
  assert.ok(stamp.startsWith("January/01/1970, 12:00"), stamp);
  assert.ok(stamp.endsWith("AM"), stamp);
});
