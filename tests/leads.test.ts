import assert from "node:assert/strict";
import test from "node:test";

import { LEAD_STATUSES, LEAD_STATUS_LABELS, isLeadStatus } from "../src/leads.ts";

test("every dispatch status is accepted and nothing else is", () => {
  for (const status of LEAD_STATUSES) assert.equal(isLeadStatus(status), true, status);
  assert.equal(isLeadStatus("shipped"), false);
  assert.equal(isLeadStatus(""), false);
});

test("every status has a label", () => {
  for (const status of LEAD_STATUSES) assert.ok(LEAD_STATUS_LABELS[status].length > 0, status);
});

test("the quote pipeline starts new and covers the delivery lifecycle", () => {
  assert.equal(LEAD_STATUSES[0], "new");
  for (const status of ["confirmed", "assigned", "picked_up", "in_transit", "delivered", "closed", "cancelled"]) {
    assert.ok(isLeadStatus(status), status);
  }
});
