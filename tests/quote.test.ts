import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_RULES, haversineMiles, priceQuote, roadMiles } from "../src/quote.ts";

const miami = { zip: "33101", city: "Miami", state: "FL", lat: 25.7791, lng: -80.1978 };
const newYork = { zip: "10001", city: "New York", state: "NY", lat: 40.7506, lng: -73.9972 };

test("road distance between Miami and New York is in the right band", () => {
  const straight = haversineMiles(miami, newYork);
  assert.ok(straight > 1080 && straight < 1120, `straight line was ${straight}`);
  const road = roadMiles(miami, newYork);
  assert.ok(road > 1280 && road < 1360, `road miles were ${road}`);
});

test("open transport is priced per mile above the minimum", () => {
  const quote = priceQuote(1000, "open", "running", false);
  assert.equal(quote.base, 950);
  assert.equal(quote.conditionFee, 0);
  assert.equal(quote.total, 950);
  assert.equal(quote.deposit, 190);
  assert.equal(quote.minimumApplied, false);
});

test("short routes fall back to the minimum charge", () => {
  const quote = priceQuote(100, "open", "running", false);
  assert.equal(quote.base, DEFAULT_RULES.openMin);
  assert.equal(quote.minimumApplied, true);
});

test("enclosed costs more than open on the same route", () => {
  const open = priceQuote(1000, "open", "running", false);
  const enclosed = priceQuote(1000, "enclosed", "running", false);
  assert.ok(enclosed.total > open.total);
  assert.equal(enclosed.total, 1350);
});

test("a non-running vehicle adds the inoperable fee", () => {
  const running = priceQuote(1000, "open", "running", false);
  const dead = priceQuote(1000, "open", "non-running", false);
  assert.equal(dead.total - running.total, DEFAULT_RULES.inopFee);
});

test("oversize adds the size fee on top of condition", () => {
  const quote = priceQuote(1000, "open", "non-running", true);
  assert.equal(quote.conditionFee, DEFAULT_RULES.inopFee + DEFAULT_RULES.oversizeFee);
  assert.equal(quote.total, 950 + 150 + 200);
});
