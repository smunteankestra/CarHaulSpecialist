import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_STATUSES, invoiceNumber, isOrderStatus, orderNumber, randomToken } from "../src/orders.ts";

test("order numbers are zero padded and carry the year", () => {
  assert.equal(orderNumber(1, 2026), "CHS-2026-0001");
  assert.equal(orderNumber(42, 2026), "CHS-2026-0042");
  assert.equal(orderNumber(1234, 2026), "CHS-2026-1234");
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
  assert.equal(isOrderStatus("in_transit"), true);
  assert.equal(isOrderStatus("quoted"), true);
  assert.equal(isOrderStatus("paid"), true);
  assert.equal(isOrderStatus("requested"), false);
  assert.equal(isOrderStatus("closed"), false);
  assert.equal(isOrderStatus("shipped"), false);
  assert.equal(isOrderStatus(""), false);
});

test("quoted is the first status and paid replaces closed", () => {
  assert.deepEqual(ORDER_STATUSES.slice(0, 3), ["quoted", "confirmed", "assigned"]);
  assert.ok(ORDER_STATUSES.includes("paid"));
  assert.equal((ORDER_STATUSES as readonly string[]).includes("closed"), false);
  assert.equal((ORDER_STATUSES as readonly string[]).includes("requested"), false);
});
