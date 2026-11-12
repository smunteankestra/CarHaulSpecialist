import assert from "node:assert/strict";
import test from "node:test";

import { dateOnly, when } from "../src/views.ts";
import { placeLine, showsCallBanner } from "../src/views-order.ts";

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

test("route line shows city, state and ZIP", () => {
  assert.equal(placeLine("Orlando", "FL", "32801"), "Orlando, Florida 32801");
  assert.equal(placeLine(null, "CO", "80202"), "Colorado 80202");
  assert.equal(placeLine("Denver", null, "80202"), "Denver 80202");
  assert.equal(placeLine(null, null, "80202"), "80202");
  assert.equal(placeLine(null, null, null), "");
});

test("the call banner only shows while the order is still fresh", () => {
  assert.equal(showsCallBanner(true, "quoted"), true);
  assert.equal(showsCallBanner(true, "confirmed"), true);
  assert.equal(showsCallBanner(true, "contract_draft"), false);
  assert.equal(showsCallBanner(true, "assigned"), false);
  assert.equal(showsCallBanner(true, "picked_up"), false);
  assert.equal(showsCallBanner(true, "cancelled"), false);
  assert.equal(showsCallBanner(false, "confirmed"), false);
});
