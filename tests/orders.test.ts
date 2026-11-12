import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_STATUSES, invoiceNumber, isOrderStatus, orderPeriod, randomToken } from "../src/orders.ts";

test("order periods use the Pacific business month", () => {
  assert.equal(orderPeriod(new Date("2026-11-08T12:00:00Z")).key, "26-Nov");
  assert.equal(orderPeriod(new Date("2026-01-05T12:00:00Z")).key, "26-Jan");
  // still November in San Diego when UTC has already turned the page
  assert.equal(orderPeriod(new Date("2026-12-01T02:00:00Z")).key, "26-Nov");
  assert.equal(orderPeriod(new Date("2027-01-01T09:00:00Z")).key, "27-Jan");
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
