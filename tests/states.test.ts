import assert from "node:assert/strict";
import test from "node:test";

import { US_STATES, stateCode, stateName } from "../src/states.ts";

test("states display full names and normalize codes", () => {
  assert.equal(stateName("FL"), "Florida");
  assert.equal(stateName("fl"), "Florida");
  assert.equal(stateName("Florida"), "Florida");
  assert.equal(stateName(""), "");
  assert.equal(stateName(null), "");

  assert.equal(stateCode("Florida"), "FL");
  assert.equal(stateCode("fl"), "FL");
  assert.equal(stateCode("FL"), "FL");
  assert.equal(stateCode("ZZ"), "");
});

test("all fifty states plus DC are listed once", () => {
  assert.equal(US_STATES.length, 51);
  assert.equal(new Set(US_STATES.map(([code]) => code)).size, 51);
  assert.equal(new Set(US_STATES.map(([, name]) => name)).size, 51);
});
