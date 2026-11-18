import assert from "node:assert/strict";
import test from "node:test";

import { invoiceAmountFor, type OrderRow } from "../src/orders.ts";
import { invoiceAction } from "../src/views-order.ts";

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 152,
    broker_fee: null,
    carrier_fee: null,
    client_invoice_amount: null,
    carrier_invoice_amount: null,
    client_invoice_method: null,
    carrier_invoice_method: null,
    payment_method: null,
    customer_email: "client@example.com",
    carrier_email: "carrier@example.com",
    ...overrides,
  } as unknown as OrderRow;
}

const amountInput = (html: string) => /<input name="amount"[^>]*>/.exec(html)?.[0] ?? "";

test("the invoice amount mirrors the fee it represents", () => {
  assert.equal(invoiceAmountFor(order({ broker_fee: 425, carrier_fee: 300 }), "client"), 425);
  assert.equal(invoiceAmountFor(order({ broker_fee: 425, carrier_fee: 300 }), "carrier"), 300);
  assert.equal(invoiceAmountFor(order({ broker_fee: null, carrier_fee: null }), "client"), 0);
});

test("the amount field is read-only and shows the broker/carrier fee", () => {
  const client = invoiceAction(order({ broker_fee: 425, carrier_fee: 300 }), [], "client");
  const carrier = invoiceAction(order({ broker_fee: 425, carrier_fee: 300 }), [], "carrier");

  assert.match(amountInput(client), /value="425"/);
  assert.match(amountInput(carrier), /value="300"/);
  assert.match(amountInput(client), /readonly/);
  assert.match(amountInput(carrier), /readonly/);
  assert.doesNotMatch(amountInput(client), /required/);
  assert.doesNotMatch(amountInput(carrier), /required/);
});

test("the stale invoice amount never overrides the fee", () => {
  const client = invoiceAction(order({ broker_fee: 425, client_invoice_amount: 1240 }), [], "client");
  assert.match(amountInput(client), /value="425"/);
});

test("sending is blocked until the fee it represents is set", () => {
  const client = invoiceAction(order({ broker_fee: null, carrier_fee: 300 }), [], "client");
  const carrier = invoiceAction(order({ broker_fee: null, carrier_fee: 300 }), [], "carrier");

  assert.match(client, /Set the broker fee first/);
  assert.match(client, /disabled/);
  assert.match(amountInput(client), /value="0"/);
  assert.doesNotMatch(carrier, /Set the carrier fee first/);
  assert.match(amountInput(carrier), /value="300"/);
});

test("each invoice keeps its own payment method", () => {
  const order_ = order({ broker_fee: 425, carrier_fee: 300, client_invoice_method: "ACH", carrier_invoice_method: "Wire" });
  assert.match(invoiceAction(order_, [], "client"), /<option value="ACH" selected>/);
  assert.match(invoiceAction(order_, [], "carrier"), /<option value="Wire" selected>/);
});

test("a legacy order payment method still pre-fills the invoice", () => {
  assert.match(invoiceAction(order({ broker_fee: 425, payment_method: "Zelle" }), [], "client"), /<option value="Zelle" selected>/);
});
