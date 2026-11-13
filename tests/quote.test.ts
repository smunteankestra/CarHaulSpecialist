import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_RULES, conditionLabel, haversineMiles, parseCondition, priceQuote, roadMiles } from "../src/quote.ts";

const miami = { zip: "33101", city: "Miami", state: "FL", lat: 25.7791, lng: -80.1978 };
const newYork = { zip: "10001", city: "New York", state: "NY", lat: 40.7506, lng: -73.9972 };

test("road distance between Miami and New York is in the right band", () => {
  const straight = haversineMiles(miami, newYork);
  assert.ok(straight > 1080 && straight < 1120, `straight line was ${straight}`);
  const road = roadMiles(miami, newYork);
  assert.ok(road > 1280 && road < 1360, `road miles were ${road}`);
});

test("open transport follows the distance curve above the minimum", () => {
  const quote = priceQuote(1000, "open", "running", false, undefined, { at: new Date("2026-05-01T12:00:00Z") });
  assert.equal(quote.base, 1014);
  assert.equal(quote.conditionFee, 0);
  assert.equal(quote.total, 1014);
  assert.equal(quote.deposit, 203);
  assert.equal(quote.minimumApplied, false);
});

test("a short local move uses the local minimum, not the long-haul floor", () => {
  const quote = priceQuote(7, "open", "running", false, undefined, { at: new Date("2026-05-01T12:00:00Z") });
  assert.equal(quote.base, 275);
  assert.equal(quote.total, 275);
  assert.equal(quote.deposit, 55);
  assert.equal(quote.minimumApplied, true);
});

test("enclosed local moves use the enclosed local minimum", () => {
  assert.equal(priceQuote(7, "enclosed", "running", false).base, 450);
});

test("minimums step up with distance", () => {
  const cases: Array<[number, number]> = [
    [7, 275],
    [25, 275],
    [26, 375],
    [75, 375],
    [76, 450],
    [130, 450],
    [151, 550],
    [200, 550],
    [301, 620],
  ];
  for (const [miles, expected] of cases) {
    assert.equal(priceQuote(miles, "open", "running", false, undefined, { at: new Date("2026-05-01T12:00:00Z") }).base, expected, `${miles} mi`);
  }
});

test("a longer route never costs less than a shorter one", () => {
  let previous = 0;
  for (let miles = 1; miles <= 1200; miles += 1) {
    const total = priceQuote(miles, "open", "running", false).total;
    assert.ok(total >= previous, `${miles} mi priced ${total}, below ${previous}`);
    previous = total;
  }
});

test("enclosed costs about 70% more than open on the same route", () => {
  const at = new Date("2026-05-01T12:00:00Z");
  const open = priceQuote(1000, "open", "running", false, undefined, { at });
  const enclosed = priceQuote(1000, "enclosed", "running", false, undefined, { at });
  assert.ok(enclosed.total > open.total);
  assert.ok(Math.abs(enclosed.total - open.total * 1.7) <= 1, `${enclosed.total} vs ${open.total * 1.7}`);
});

test("the rate per mile falls as the distance grows", () => {
  const at = new Date("2026-05-01T12:00:00Z");
  let previousRate = Infinity;
  for (const miles of [100, 300, 600, 1000, 1500, 2000, 2500, 3000]) {
    const total = priceQuote(miles, "open", "running", false, undefined, { at }).total;
    const rate = total / miles;
    assert.ok(rate < previousRate, `${miles} mi priced ${rate.toFixed(2)}/mi, not below ${previousRate.toFixed(2)}`);
    previousRate = rate;
  }
});

test("long hauls match published market medians within 10%", () => {
  const at = new Date("2026-05-01T12:00:00Z");
  const market: Array<[number, number]> = [
    [300, 620],
    [1250, 1110],
    [1750, 1290],
    [2250, 1415],
    [2750, 1535],
  ];
  for (const [miles, expected] of market) {
    const total = priceQuote(miles, "open", "running", false, undefined, { at }).total;
    const drift = Math.abs(total - expected) / expected;
    assert.ok(drift < 0.1, `${miles} mi priced ${total}, market ${expected}`);
  }
});

test("snowbird season adds a premium north to south", () => {
  const winter = new Date("2026-12-20T12:00:00Z");
  const summer = new Date("2026-05-01T12:00:00Z");
  const southbound = priceQuote(1200, "open", "running", false, undefined, { originState: "NY", destState: "FL", at: winter }).total;
  const offSeason = priceQuote(1200, "open", "running", false, undefined, { originState: "NY", destState: "FL", at: summer }).total;
  assert.ok(southbound > offSeason, "winter southbound should cost more");
});

test("both inoperable conditions add their fee, and the legacy value maps to steer-and-roll", () => {
  const running = priceQuote(1000, "open", "running", false);
  const steerRoll = priceQuote(1000, "open", "inoperable_steer_roll", false);
  const noSteer = priceQuote(1000, "open", "inoperable_no_steer", false);
  const legacy = priceQuote(1000, "open", "non-running", false);

  assert.equal(steerRoll.total - running.total, DEFAULT_RULES.inopFee);
  assert.equal(noSteer.total - running.total, DEFAULT_RULES.noSteerFee);
  assert.equal(legacy.total, steerRoll.total);
});

test("conditions normalize legacy values and label all options", () => {
  assert.equal(parseCondition("running"), "running");
  assert.equal(parseCondition("non-running"), "inoperable_steer_roll");
  assert.equal(parseCondition("inoperable_steer_roll"), "inoperable_steer_roll");
  assert.equal(parseCondition("inoperable_no_steer"), "inoperable_no_steer");
  assert.equal(parseCondition("unknown"), "running");

  assert.equal(conditionLabel("running"), "Run and drive");
  assert.equal(conditionLabel("inoperable_steer_roll"), "Inoperable (steer and roll)");
  assert.equal(conditionLabel("inoperable_no_steer"), "Inoperable (doesn't steer/roll/no keys)");
  assert.equal(conditionLabel("non-running"), "Inoperable (steer and roll)");
});

test("oversize adds the size fee on top of condition", () => {
  const at = new Date("2026-05-01T12:00:00Z");
  const quote = priceQuote(1000, "open", "non-running", true, undefined, { at });
  assert.equal(quote.conditionFee, DEFAULT_RULES.inopFee + DEFAULT_RULES.oversizeFee);
  assert.equal(quote.total, quote.base + 150 + 200);
});
