import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_STATUSES, invoiceNumber, isOrderStatus, orderNumber, randomToken } from "../src/orders.ts";

test("order numbers are zero padded and carry the year", () => {
  assert.equal(orderNumber(1, new Date(Date.UTC(2026, 10, 8))), "2026-November-001");
  assert.equal(orderNumber(42, new Date(Date.UTC(2026, 0, 5))), "2026-January-042");
  assert.equal(orderNumber(1234, new Date(Date.UTC(2026, 11, 1))), "2026-December-1234");
});

test("invoice numbers follow the same shape", () => {
  assert.equal(invoiceNumber(7, 2026), "INV-2026-0007");
});

test("tracking tokens are long, hex and unique", () => {
  const first = randomToken();
  const second = randomToken();
  assert.equal(first.length, 48);
  assert.match(first, /^[0-9a-f]{48}$/);
  assert.notEqual(first, second);
});

test("only known statuses are accepted", () => {
  assert.equal(isOrderStatus("in_transit"), false);
  assert.equal(isOrderStatus("quoted"), true);
  assert.equal(isOrderStatus("paid"), true);
  assert.equal(isOrderStatus("requested"), false);
  assert.equal(isOrderStatus("closed"), false);
  assert.equal(isOrderStatus("shipped"), false);
  assert.equal(isOrderStatus(""), false);
});

test("quoted is the first status and paid replaces closed", () => {
  assert.deepEqual(ORDER_STATUSES.slice(0, 4), ["quoted", "confirmed", "contract_draft", "assigned"]);
  assert.equal(ORDER_STATUSES.includes("contract_signed" as never), false);
  assert.ok(ORDER_STATUSES.includes("paid"));
  assert.equal((ORDER_STATUSES as readonly string[]).includes("closed"), false);
  assert.equal((ORDER_STATUSES as readonly string[]).includes("requested"), false);
  assert.equal((ORDER_STATUSES as readonly string[]).includes("in_transit"), false);
});
