import assert from "node:assert/strict";
import test from "node:test";

import { orderFieldsTable } from "../src/views-order.ts";

const base: any = {
  id: 213, number: "26-Nov-158", status: "confirmed", token: "t",
  customer_name: "A", customer_email: "a@b.co", customer_phone: "1",
  vehicle_year: "2020", vehicle_make: "H", vehicle_model: "C", vin: null,
  transport_type: "open", condition: "running",
  origin_street: "S", origin_city: "C", origin_state: "FL", origin_zip: "33101", origin_contact: "x", origin_phone: "1",
  dest_street: "D", dest_city: "D", dest_state: "NY", dest_zip: "10001", dest_contact: "y", dest_phone: "2",
  ready_date: "2026-11-20", ready_asap: 0, distance_miles: 100, price: 1000, original_price: 1023,
  final_quote: 1000, broker_fee: 100, carrier_fee: 900, paid_amount: null, payment_method: null,
  payment_state: "unpaid", client_invoice_amount: null, carrier_invoice_amount: null,
  client_invoice_method: null, carrier_invoice_method: null, dest_tz: null,
  carrier_name: null, carrier_mc: null, carrier_company_phone: null, carrier_email: null,
  driver_name: null, carrier_phone: null, notes: null, pickup_eta: null, delivery_eta: null,
  picked_up_at: null, delivered_at: null, created_at: 0, updated_at: 0, lead_id: null,
};

test("price and final quote are shown as the sum of the two fees, not typed", () => {
  const html = orderFieldsTable(base, "/admin/orders/213");
  assert.match(html, /Price = final quote/);
  assert.match(html, /\$1,000/);
  assert.doesNotMatch(html, /name="price"/);
  assert.doesNotMatch(html, /name="final_quote"/);
});

test("broker and carrier fee stay editable", () => {
  const html = orderFieldsTable(base, "/admin/orders/213");
  assert.match(html, /name="broker_fee"/);
  assert.match(html, /name="carrier_fee"/);
});

test("the discount is measured against the derived total", () => {
  const html = orderFieldsTable(base, "/admin/orders/213");
  assert.match(html, /Discounted \$23/);
});

test("before both fees exist the calculator price is shown instead", () => {
  const html = orderFieldsTable({ ...base, broker_fee: null, carrier_fee: null, original_price: null }, "/admin/orders/213");
  assert.match(html, /from the calculator/);
  assert.match(html, /\$1,000/);
});

test("the quoted step blocks the move until both fees exist", () => {
  const html = orderFieldsTable({ ...base, status: "quoted", broker_fee: null, carrier_fee: null }, "/admin/orders/213");
  assert.match(html, /class="row-required"/);
  assert.match(html, /Broker fee/);
  assert.match(html, /Carrier fee/);
});
