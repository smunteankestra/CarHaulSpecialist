import { esc, MONTH_NAMES, conditionPicker, conditionTag, dateOnly, datePicker, infoTip, layout, money, site, transportPicker, whenHtml } from "./views.ts";
import { US_STATES, stateCode, stateName } from "./states.ts";
import { ROLE_LABELS, type Role, type UserRow } from "./users.ts";
import {
  CUSTOMER_STAGES,
  ORDER_STATUSES,
  STATUS_LABELS,
  isOrderStatus,
  type InvoiceRow,
  type OrderEventRow,
  type OrderRow,
  type OrderStatus,
  type OrderUnitRow,
} from "./orders.ts";

export interface OrderPhotoRow {
  id: number;
  order_id: number;
  photo_key: string;
  created_at: number;
}

export interface BookValues {
  order_token?: string;
  name?: string;
  email?: string;
  phone?: string;
  vin?: string;
  origin_street?: string;
  origin_city?: string;
  origin_state?: string;
  origin_zip?: string;
  origin_contact?: string;
  origin_phone?: string;
  dest_street?: string;
  dest_city?: string;
  dest_state?: string;
  dest_zip?: string;
  dest_contact?: string;
  dest_phone?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  transport_type?: string;
  condition?: string;
  ready_date?: string;
  ready_asap?: string;
  notes?: string;
  lead_id?: string;
}

function stateOptions(selected: string | undefined): string {
  const current = stateCode(selected);
  return `<option value="">Select state</option>${US_STATES.map(
    ([code, name]) => `<option value="${code}"${current === code ? " selected" : ""}>${name}</option>`,
  ).join("")}`;
}

export type ExtraUnit = { year: string; make: string; model: string; condition: string };

export function bookPage(values: BookValues, price: number | null, error?: string, extras: ExtraUnit[] = []): string {
  const v = (key: keyof BookValues) => esc(values[key] ?? "");
  const condition = values.condition || "running";
  const hidden = Object.entries(values)
    .filter(([key]) => key === "lead_id" || key === "order_token")
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${esc(value)}">`)
    .join("");
  // Extra vehicles carry through to the booking submit untouched.
  const unitHidden = extras
    .map((unit, index) => {
      const n = index + 2;
      return `<input type="hidden" name="vehicle_year_${n}" value="${esc(unit.year)}"><input type="hidden" name="vehicle_make_${n}" value="${esc(unit.make)}"><input type="hidden" name="vehicle_model_${n}" value="${esc(unit.model)}"><input type="hidden" name="condition_${n}" value="${esc(unit.condition)}">`;
    })
    .join("");

  return layout({
    title: "Book your transport — Bond Auto Transport",
    description: "Confirm the addresses, contacts and vehicle details so dispatch can assign a carrier.",
    canonical: "/booking-form",
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Booking</p>
      <h1>Book your transport.</h1>
      <p class="lede">We need both addresses and a contact at each end. Dispatch confirms the carrier and the pickup window after you submit.</p>
      <ul class="ticks">
        <li class="is-free">No card required to book</li>
        <li>Both addresses and contacts in one form</li>
        <li>Dispatch confirms the carrier before pickup</li>
      </ul>
    </div>
    <aside class="hero-card">
      <p class="eyebrow">Your quoted price</p>
      <p class="price">${price === null ? "To confirm" : money(price)}</p>
      <p class="muted small">${price === null ? "Dispatch will confirm the price against the actual lane." : "Based on your route and trailer type. Dispatch confirms before pickup."}</p>
      <ul class="breakdown">
        <li><span>Payment</span><span>On delivery</span></li>
        <li><span>Deposit</span><span class="is-free">None online</span></li>
        <li><span>Due now</span><span class="is-free">$0</span></li>
      </ul>
      <p class="muted small">No card is charged now.</p>
    </aside>
  </div>
</section>

<section class="wrap section">
  <div class="book-layout">
    <div class="book-form-card">
      <h2 class="section-title">Booking details</h2>
      <p class="muted">Both addresses and a contact at each end. Fields marked * are required.</p>
    <form class="quote-form" method="post" action="/book/submit" enctype="multipart/form-data">
      ${hidden}${unitHidden}
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

      <h3 class="form-section">Customer</h3>
      <div class="field-row">
        <label class="field"><span>Full name *</span><input name="name" required value="${v("name")}" autocomplete="name"></label>
        <label class="field"><span>Email *</span><input name="email" type="email" required value="${v("email")}" autocomplete="email"></label>
        <label class="field"><span>Phone *</span><input name="phone" required value="${v("phone")}" autocomplete="tel"></label>
      </div>

      <h3 class="form-section">Vehicle</h3>
      <div class="field-row">
        <label class="field"><span>Year</span><input name="vehicle_year" maxlength="4" value="${v("vehicle_year")}"></label>
        <label class="field"><span>Make</span><input name="vehicle_make" value="${v("vehicle_make")}"></label>
        <label class="field"><span>Model</span><input name="vehicle_model" value="${v("vehicle_model")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>VIN${infoTip("17 characters on the dashboard or driver's door. Optional, but it speeds up dispatch.")}</span><input name="vin" maxlength="17" value="${v("vin")}" placeholder="17 characters"></label>
      </div>
      <div class="field">
        <span>Transport${infoTip("Open is the cheapest option; enclosed protects paintwork on classics and exotics.")}</span>
        ${transportPicker(values.transport_type)}
      </div>
      <div class="field">
        <span>Vehicle condition${infoTip("A vehicle that cannot be driven needs a winch or forklift, which adds a fee.")}</span>
        ${conditionPicker(condition)}
      </div>

      <a class="btn btn-accent btn-inline" href="/booking-form" target="_blank" rel="noopener">Add another vehicle</a>

      <h3 class="form-section">Pickup</h3>
      <div class="field-row">
        <label class="field"><span>Street address</span><input name="origin_street" value="${v("origin_street")}" autocomplete="street-address"></label>
        <label class="field"><span>City</span><input name="origin_city" value="${v("origin_city")}"></label>
        <label class="field"><span>State</span><select name="origin_state">${stateOptions(values.origin_state)}</select></label>
        <label class="field"><span>ZIP *</span><input name="origin_zip" inputmode="numeric" maxlength="5" required value="${v("origin_zip")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Contact name *</span><input name="origin_contact" required value="${v("origin_contact")}"></label>
        <label class="field"><span>Contact phone *</span><input name="origin_phone" required value="${v("origin_phone")}"></label>
      </div>

      <h3 class="form-section">Delivery</h3>
      <div class="field-row">
        <label class="field"><span>Street address</span><input name="dest_street" value="${v("dest_street")}"></label>
        <label class="field"><span>City</span><input name="dest_city" value="${v("dest_city")}"></label>
        <label class="field"><span>State</span><select name="dest_state">${stateOptions(values.dest_state)}</select></label>
        <label class="field"><span>ZIP *</span><input name="dest_zip" inputmode="numeric" maxlength="5" required value="${v("dest_zip")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Contact name *</span><input name="dest_contact" required value="${v("dest_contact")}"></label>
        <label class="field"><span>Contact phone *</span><input name="dest_phone" required value="${v("dest_phone")}"></label>
      </div>

      <h3 class="form-section">Schedule</h3>
      <div class="field-row">
        <div class="field"><span>Pickup date *</span>${datePicker("ready_date", values.ready_date ?? "", false, true)}</div>
        <label class="field"><span>Anything we should know?</span><textarea name="notes" rows="2">${v("notes")}</textarea></label>
      </div>

      <h3 class="form-section">Photos</h3>
      <div class="photo-upload">
        <label class="photo-drop">
          <input class="photo-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple>
          <span class="photo-plus" aria-hidden="true">+</span>
          <strong>Add vehicle photos</strong>
          <span class="photo-sub">Optional · up to 5 photos · JPEG, PNG, WebP or HEIC · 10 MB each</span>
        </label>
        <div class="photo-preview" hidden></div>
        <p class="photo-count muted small" hidden></p>
        <p class="photo-warning" role="status" hidden></p>
        <p class="photo-error form-error" role="alert" hidden></p>
      </div>

      <button class="btn btn-accent btn-block" type="submit">Submit booking request</button>
      <p class="form-note">No card is charged now. Dispatch confirms the carrier and price before pickup.</p>
    </form>
    </div>

    <aside class="book-side">
      <div class="card">
        <h3>Need a hand?</h3>
        <p class="muted small">Call or email dispatch and we will book it with you.</p>
        <p><a class="btn btn-ghost btn-small" href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">Call ${esc(site.phone)}</a></p>
        <p class="muted small"><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
      </div>
      <div class="card">
        <h3>What to have ready</h3>
        <ul class="ticks">
          <li>Pickup and delivery addresses</li>
          <li>A contact name and phone at both ends</li>
          <li>Vehicle year, make, model and VIN</li>
        </ul>
      </div>
    </aside>
  </div>
</section>

<section class="wrap section">
  <h2 class="section-title">What happens next</h2>
  <ol class="steps">
    <li><span class="step-num">1</span><h3>Send the details</h3><p>Both addresses and a contact at each end. That is enough to book.</p></li>
    <li><span class="step-num">2</span><h3>Dispatch confirms the carrier</h3><p>We confirm the carrier, the pickup window and the price before anything is charged.</p></li>
    <li><span class="step-num">3</span><h3>Track it to the door</h3><p>You get the carrier, the driver contact and status updates until delivery.</p></li>
  </ol>
</section>`,
  });
}

function statusBadge(status: string, decorated = false): string {
  const label = STATUS_LABELS[status as OrderStatus] ?? status;
  const display = decorated && status === "paid" ? `$$$ ${label} 🚬💨🌿` : label;
  return `<span class="badge badge-${esc(status)}">${esc(display)}</span>`;
}

function eventLabel(kind: string): string {
  if (kind === "requested") return "Quoted";
  if (kind === "invoice_client") return "Client invoice sent";
  if (kind === "invoice_carrier") return "Carrier invoice sent";
  if (kind === "invoice_client_paid") return "Client invoice paid";
  if (kind === "invoice_carrier_paid") return "Carrier invoice paid";
  if (kind === "in_transit") return "Picked up";
  if (kind === "edited") return "Edited";
  return isOrderStatus(kind) ? STATUS_LABELS[kind] : kind;
}

function timeSelects(config: {
  monthName: string;
  dayName: string;
  yearName: string;
  hourName: string;
  minuteName: string;
  ampmName: string;
  value: number | null;
}): string {
  const date = config.value ? new Date(config.value) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = date.getUTCHours();
  const hour = hours % 12 || 12;
  const minute = date.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from(new Set([...Array.from({ length: 8 }, (_, i) => currentYear - 2 + i), year])).sort(
    (a, b) => a - b,
  );
  const monthOptions = MONTH_NAMES.map(
    (name, index) => `<option value="${index + 1}"${month === index + 1 ? " selected" : ""}>${name}</option>`,
  ).join("");
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1)
    .map((value) => `<option value="${value}"${day === value ? " selected" : ""}>${value}</option>`)
    .join("");
  const yearOptions = years
    .map((value) => `<option value="${value}"${year === value ? " selected" : ""}>${value}</option>`)
    .join("");
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((value) => `<option value="${value}"${hour === value ? " selected" : ""}>${value}</option>`)
    .join("");
  const minuteOptions = Array.from({ length: 60 }, (_, value) => value)
    .map((value) => `<option value="${value}"${minute === value ? " selected" : ""}>${pad(value)}</option>`)
    .join("");

  return `<div class="field-row">
        <label class="field"><span>Month</span><select name="${config.monthName}">${monthOptions}</select></label>
        <label class="field"><span>Day</span><select name="${config.dayName}">${dayOptions}</select></label>
        <label class="field"><span>Year</span><select name="${config.yearName}">${yearOptions}</select></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Hour</span><select name="${config.hourName}">${hourOptions}</select></label>
        <label class="field"><span>Minute</span><select name="${config.minuteName}">${minuteOptions}</select></label>
        <label class="field"><span>AM / PM</span><select name="${config.ampmName}">
          <option value="AM"${ampm === "AM" ? " selected" : ""}>AM</option>
          <option value="PM"${ampm === "PM" ? " selected" : ""}>PM</option>
        </select></label>
      </div>`;
}

function timeFields(config: {
  dateLabel: string;
  monthName: string;
  dayName: string;
  yearName: string;
  hourName: string;
  minuteName: string;
  ampmName: string;
  value: number | null;
  note: string;
}): string {
  return `<p class="form-section form-section-date">${esc(config.dateLabel)}</p>
      ${timeSelects(config)}
      <p class="form-note">${config.note}</p>`;
}

function pickupEtaFields(order: OrderRow): string {
  return timeFields({
    dateLabel: "Pickup ETA",
    monthName: "pickup_eta_month",
    dayName: "pickup_eta_day",
    yearName: "pickup_eta_year",
    hourName: "pickup_eta_hour",
    minuteName: "pickup_eta_minute",
    ampmName: "pickup_eta_ampm",
    value: order.pickup_eta,
    note: order.pickup_eta ? `Pickup ETA: ${whenHtml(order.pickup_eta)}` : "Choose the estimated pickup time in AM/PM.",
  });
}

function paymentFields(order: OrderRow): string {
  return `<p class="form-section form-section-date">Payment</p>
      <div class="field-row">
        <label class="field"><span>Amount (USD)</span><input name="paid_amount" type="number" min="0" step="1" value="${order.paid_amount ?? order.price}"></label>
        <label class="field"><span>Payment method</span><select name="payment_method" class="payment-select">
          <option value="">Select method</option>
          ${PAYMENT_METHODS.map((method) => `<option value="${method}"${order.payment_method === method ? " selected" : ""}>${method}</option>`).join("")}
        </select></label>
      </div>
      <p class="form-note">${order.paid_amount !== null ? `Saved: ${money(order.paid_amount)}${order.payment_method ? ` via ${esc(order.payment_method)}` : ""}` : "Record how the balance was paid."}</p>`;
}

function statusFields(order: OrderRow): string {
  if (order.status === "quoted") return "";
  if (order.status === "cancelled") return "";
  if (order.status === "contract_draft") return pickupEtaFields(order);
  if (order.status === "confirmed") return "";
  if (order.status === "assigned") return "";
  if (order.status === "picked_up") return "";
  if (order.status === "delivered") return "";
  return paymentFields(order);
}

export function trackPage(order: OrderRow, events: OrderEventRow[], invoices: InvoiceRow[], justBooked = false): string {
  const done = new Set(events.map((event) => event.kind));
  const current = ORDER_STATUSES.indexOf(order.status as OrderStatus);
  const reached = CUSTOMER_STAGES.filter(
    (stage) =>
      stage === "quoted" ||
      done.has(stage) ||
      order.status === stage ||
      (order.status !== "cancelled" && current >= ORDER_STATUSES.indexOf(stage)),
  );
  const lastStage = order.status === "cancelled" ? "cancelled" : (reached[reached.length - 1] ?? "quoted");
  const cancelled = lastStage === "cancelled";
  const timeline = `<li class="reached${cancelled ? " is-cancelled" : ""}"><strong>${esc(STATUS_LABELS[lastStage])}</strong>${cancelled ? "" : '<span class="progress-bar" aria-hidden="true"><span></span></span>'
    }</li>`;

  const bookingHidden = Object.entries({
    name: order.customer_name,
    email: order.customer_email,
    phone: order.customer_phone,
    vin: order.vin ?? "",
    origin_street: order.origin_street ?? "",
    origin_city: order.origin_city ?? "",
    origin_state: order.origin_state ?? "",
    origin_zip: order.origin_zip,
    origin_contact: order.origin_contact ?? "",
    origin_phone: order.origin_phone ?? "",
    dest_street: order.dest_street ?? "",
    dest_city: order.dest_city ?? "",
    dest_state: order.dest_state ?? "",
    dest_zip: order.dest_zip,
    dest_contact: order.dest_contact ?? "",
    dest_phone: order.dest_phone ?? "",
    vehicle_year: order.vehicle_year ?? "",
    vehicle_make: order.vehicle_make ?? "",
    vehicle_model: order.vehicle_model ?? "",
    transport_type: order.transport_type,
    condition: order.condition,
    ready_date: order.ready_date ?? "",
    notes: order.notes ?? "",
  })
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${esc(value)}">`)
    .join("");

  return layout({
    title: `${order.number} — Bond Auto Transport`,
    description: `Status of shipment ${order.number}.`,
    body: `
<section class="wrap section">
  ${justBooked
      ? `<div class="call-banner">
    <strong>We will call you shortly.</strong>
    <span>Expect a call from dispatch — we confirm the carrier and the pickup window before anything is charged.</span>
  </div>`
      : ""}
  <p class="eyebrow">Shipment</p>
  <h1 class="page-title">${esc(order.number)} ${statusBadge(order.status)}</h1>
  <p class="muted">${esc(order.origin_city ?? order.origin_zip)}, ${esc(stateName(order.origin_state))} → ${esc(order.dest_city ?? order.dest_zip)}, ${esc(stateName(order.dest_state))}</p>

  <div class="cards two-up">
    <div class="card">
      <h3>Shipment</h3>
      <p>${esc([order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "Vehicle")}</p>
      <p class="muted small">${esc(order.transport_type)} trailer · ${conditionTag(order.condition)}${order.vin ? ` · VIN ${esc(order.vin)}` : ""}</p>
      <p class="muted small">Price ${money(order.final_quote ?? order.price)}${order.distance_miles ? ` · ${order.distance_miles.toLocaleString()} miles` : ""}</p>
      ${order.carrier_name ? `<p class="muted small">Carrier: ${esc(order.carrier_name)}${order.driver_name ? ` · Driver: ${esc(order.driver_name)}` : ""}${order.carrier_phone ? ` · ${esc(order.carrier_phone)}` : ""}</p>` : ""}
      ${order.picked_up_at ? `<p class="muted small">Picked up ${whenHtml(order.picked_up_at)}</p>` : ""}
      ${!["picked_up", "delivered", "paid"].includes(order.status) && order.pickup_eta ? `<p class="muted small">Pickup ETA ${whenHtml(order.pickup_eta)}</p>` : ""}
      ${order.status === "picked_up" && order.delivery_eta ? `<p class="muted small">Delivery ETA ${whenHtml(order.delivery_eta)}</p>` : ""}
      ${order.delivered_at ? `<p class="muted small">Delivered ${whenHtml(order.delivered_at)}</p>` : ""}
    </div>
    <div class="card">
      <h3>Progress</h3>
      <ul class="timeline">${timeline}</ul>
    </div>
  </div>

  <div class="card mt">
    <h3>Book another vehicle</h3>
    <p class="muted small">Your details are prefilled. Change anything you need before submitting.</p>
    <form method="post" action="/booking-form" class="mt">
      ${bookingHidden}
      <button class="btn btn-accent" type="submit">Continue to booking</button>
    </form>
  </div>

  ${invoices.length
        ? `<h2 class="section-title">Invoices</h2><table class="table"><thead><tr><th>Number</th><th>Amount</th><th>Status</th><th>Issued</th></tr></thead><tbody>${invoices
          .map(
            (invoice) =>
              `<tr><td>${esc(invoice.number)}</td><td>${money(invoice.amount)}</td><td>${esc(invoice.status)}</td><td>${whenHtml(invoice.issued_at)}</td></tr>`,
          )
          .join("")}</tbody></table>`
        : ""
      }

  <p class="muted small">Questions? Call ${esc(site.phone)} or email ${esc(site.email)} and quote ${esc(order.number)}.</p>
</section>`,
  });
}

const DAY_MS = 86_400_000;

/** Whole days between today and a date/timestamp, both taken at UTC midnight. */
function daysAway(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  let target: number;
  if (typeof value === "number") {
    const date = new Date(value);
    target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  } else {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;
    target = Date.UTC(year, month - 1, day);
  }
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY_MS);
}

/** Red for today/+1 (and overdue), orange for +2/+3, yellow for +4/+5. */
function urgencyClass(value: string | number | null): string {
  const days = daysAway(value);
  if (days === null) return "";
  if (days <= 1) return "due-red";
  if (days <= 3) return "due-orange";
  if (days <= 5) return "due-yellow";
  return "";
}

function dueSpan(value: string | number | null, html: string): string {
  if (!html) return html;
  const iso = typeof value === "number" ? new Date(value).toISOString() : (value ?? "");
  return `<span class="${urgencyClass(value)}" data-due="${esc(iso)}">${html}</span>`;
}

/** Delivery ETA is today or already past: handle this order first. */
function isDeliveryDue(value: number | null): boolean {
  const days = daysAway(value);
  return days !== null && days <= 0;
}

const DATE_GROUPS = new Set(["picked_up_at", "pickup_eta", "delivery_eta", "delivered_at"]);

const PAYMENT_METHODS = ["Zelle", "Venmo", "CashApp", "PayPal", "Check", "ACH", "Wire"];

function orderFieldsTable(order: OrderRow, anchor: string): string {
  const vehicle = [order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "—";
  const carrierLine = [order.carrier_mc, order.carrier_company_phone, order.carrier_email].filter(Boolean).join(" · ");
  const driverLine = [order.driver_name, order.carrier_phone].filter(Boolean).join(" · ");
  const value = (html: string) => html || '<span class="muted">—</span>';
  // Fields the current step needs before it can advance; shown in red until filled.
  const requiredGroups = new Set<string>(
    order.status === "confirmed"
      ? ["pickup_eta", "delivery_eta", "final_quote", "broker_fee", "carrier_fee"]
      : order.status === "picked_up"
        ? ["picked_up_at", "delivery_eta"]
        : order.status === "delivered"
          ? ["delivered_at"]
          : [],
  );
  // Carrier assigned: money rows get a yellow highlight so the price block stands out.
  const priceStep = order.status === "assigned";
  const priceMark = (html: string) => (priceStep && html ? `<span class="price-mark">${html}</span>` : html);
  const requiredValue = (group: string, filled: boolean, html: string) =>
    requiredGroups.has(group) && !filled ? '<span class="due-red">Required</span>' : value(html);
  const plain = (label: string, html: string) => `<tr><th>${esc(label)}</th><td>${value(html)}</td></tr>`;
  const editable = (label: string, group: string, html: string, editor: string, filled = true) => `<tr><th>${esc(label)}</th><td>
      <input type="checkbox" id="edit-${order.id}-${group}" class="row-edit-toggle">
      <div class="field-view">
        <div class="field-value">${requiredValue(group, filled, html)}</div>
        <label class="field-edit-btn${group === "broker_fee" ? " field-edit-btn--alert" : ""}" for="edit-${order.id}-${group}" title="Edit ${esc(label)}" aria-label="Edit ${esc(label)}">✎</label>
      </div>
      <form class="field-editor" method="post" action="/admin/orders/${order.id}/field">
        <input type="hidden" name="field" value="${esc(group)}">
        <input type="hidden" name="next" value="${esc(anchor)}">
        ${editor}
        <div class="field-editor-actions">
          ${DATE_GROUPS.has(group) ? `<button class="btn btn-ghost btn-small" type="submit" name="${group}_clear" value="1">Clear</button>` : ""}
          <label class="btn btn-ghost btn-small" for="edit-${order.id}-${group}">Cancel</label>
          <button class="btn btn-accent btn-small" type="submit">Save</button>
        </div>
      </form>
    </td></tr>`;
  const field = (label: string, control: string) =>
    `<label class="field"><span>${esc(label)}</span>${control}</label>`;
  const text = (name: string, label: string, current: string | null, extra = "") =>
    field(label, `<input name="${name}" value="${esc(current ?? "")}"${extra}>`);
  const stateSelect = (name: string, label: string, current: string | null) =>
    field(label, `<select name="${name}">${stateOptions(current ?? "")}</select>`);
  const dateTime = (name: string, label: string, value: number | null) =>
    `<div class="field"><span>${esc(label)}</span>${timeSelects({
      monthName: `${name}_month`,
      dayName: `${name}_day`,
      yearName: `${name}_year`,
      hourName: `${name}_hour`,
      minuteName: `${name}_minute`,
      ampmName: `${name}_ampm`,
      value,
    })}</div>`;

  return `<table class="table detail-table"><tbody>
      ${plain("Order", esc(order.number))}
      ${plain("Quote record", order.lead_id ? `<a href="/admin#quote-${order.lead_id}">#${order.lead_id}</a>` : "")}
      ${plain("Status", statusBadge(order.status, true))}
      ${plain("Created", whenHtml(order.created_at))}
      ${plain("Last updated", whenHtml(order.updated_at))}
      ${editable(
    "Customer",
    "customer",
    `${esc(order.customer_name)}<br><span class="muted small">${esc(order.customer_email)} · ${esc(order.customer_phone)}</span>`,
    `<div class="edit-stack">${text("customer_name", "Name", order.customer_name, " required")}${text("customer_email", "Email", order.customer_email, ' type="email" required')}${text("customer_phone", "Phone", order.customer_phone, " required")}</div>`,
  )}
      ${editable(
    "Vehicle",
    "vehicle",
    `${esc(vehicle)}<br><span class="muted small">${esc(order.transport_type)} trailer · ${conditionTag(order.condition)}</span>`,
    `<div class="edit-stack">
          <div class="edit-grid">${text("vehicle_year", "Year", order.vehicle_year, ' maxlength="4"')}${text("vehicle_make", "Make", order.vehicle_make)}${text("vehicle_model", "Model", order.vehicle_model)}</div>
          <div class="edit-grid">
            ${field("Transport", `<select name="transport_type"><option value="open"${order.transport_type === "enclosed" ? "" : " selected"}>Open trailer</option><option value="enclosed"${order.transport_type === "enclosed" ? " selected" : ""}>Enclosed trailer</option></select>`)}
            ${field("Condition", `<select name="condition"><option value="running"${order.condition === "running" ? " selected" : ""}>Run and drive</option><option value="inoperable_steer_roll"${order.condition === "inoperable_steer_roll" ? " selected" : ""}>Inoperable (steer and roll)</option><option value="inoperable_no_steer"${order.condition === "inoperable_no_steer" ? " selected" : ""}>Inoperable (doesn't steer/roll/no keys)</option></select>`)}
          </div>
        </div>`,
  )}
      ${editable("VIN", "vin", esc(order.vin ?? ""), text("vin", "VIN", order.vin, ' maxlength="17"'))}
      ${editable(
    "Pickup address",
    "origin_address",
    `${esc(order.origin_street ?? "")}<br>${esc(order.origin_city ?? "")} ${esc(stateName(order.origin_state))} ${esc(order.origin_zip)}`,
    `<div class="edit-stack">${text("origin_street", "Street", order.origin_street)}<div class="edit-grid">${text("origin_city", "City", order.origin_city)}${stateSelect("origin_state", "State", order.origin_state)}${text("origin_zip", "ZIP", order.origin_zip, " required")}</div></div>`,
  )}
      ${editable(
    "Pickup contact",
    "origin_contact",
    `${esc(order.origin_contact ?? "")}<br><span class="muted small">${esc(order.origin_phone ?? "")}</span>`,
    `<div class="edit-grid">${text("origin_contact", "Contact name", order.origin_contact)}${text("origin_phone", "Phone", order.origin_phone)}</div>`,
  )}
      ${editable(
    "Delivery address",
    "dest_address",
    `${esc(order.dest_street ?? "")}<br>${esc(order.dest_city ?? "")} ${esc(stateName(order.dest_state))} ${esc(order.dest_zip)}`,
    `<div class="edit-stack">${text("dest_street", "Street", order.dest_street)}<div class="edit-grid">${text("dest_city", "City", order.dest_city)}${stateSelect("dest_state", "State", order.dest_state)}${text("dest_zip", "ZIP", order.dest_zip, " required")}</div></div>`,
  )}
      ${editable(
    "Delivery contact",
    "dest_contact",
    `${esc(order.dest_contact ?? "")}<br><span class="muted small">${esc(order.dest_phone ?? "")}</span>`,
    `<div class="edit-grid">${text("dest_contact", "Contact name", order.dest_contact)}${text("dest_phone", "Phone", order.dest_phone)}</div>`,
  )}
      ${editable("Pick up ETA", "pickup_eta", dueSpan(order.pickup_eta, order.pickup_eta ? whenHtml(order.pickup_eta) : ""), dateTime("pickup_eta", "Date & time", order.pickup_eta), Boolean(order.pickup_eta))}
      ${editable("Picked up at", "picked_up_at", order.picked_up_at ? whenHtml(order.picked_up_at) : "", dateTime("picked_up_at", "Date & time", order.picked_up_at), Boolean(order.picked_up_at))}
      ${editable("Delivery ETA", "delivery_eta", dueSpan(order.delivery_eta, order.delivery_eta ? whenHtml(order.delivery_eta) : ""), dateTime("delivery_eta", "Date & time", order.delivery_eta), Boolean(order.delivery_eta))}
      ${editable("Delivered at", "delivered_at", order.delivered_at ? whenHtml(order.delivered_at) : "", dateTime("delivered_at", "Date & time", order.delivered_at), Boolean(order.delivered_at))}
      ${editable("Payment method", "payment_method", esc(order.payment_method ?? ""), `<select name="payment_method"><option value="">Select method</option>${PAYMENT_METHODS.map((method) => `<option value="${method}"${order.payment_method === method ? " selected" : ""}>${method}</option>`).join("")}</select>`)}
      ${editable(
        "Payment status",
        "payment_state",
        paymentStateBadge(order.payment_state, order.paid_amount),
        `<select name="payment_state">${PAYMENT_STATES.map(([value, label]) => `<option value="${value}"${(order.payment_state || "unpaid") === value ? " selected" : ""}>${label}</option>`).join("")}</select>`,
      )}
      ${editable(
        "Pickup date",
        "ready_date",
        order.ready_asap
          ? '<span class="due-red">As soon as possible</span>'
          : dueSpan(order.ready_date, esc(dateOnly(order.ready_date))),
        `<input type="date" name="ready_date" value="${esc(order.ready_date ?? "")}">`,
      )}
      ${editable("Distance", "distance_miles", order.distance_miles ? `${order.distance_miles.toLocaleString()} miles` : "", `<input type="number" min="0" name="distance_miles" value="${order.distance_miles ?? ""}" placeholder="Miles">`)}
      ${editable("Price", "price", priceMark(`<strong>${money(order.price)}</strong>`), `<input type="number" min="0" name="price" value="${order.price}" placeholder="USD">`)}
      ${editable("Final quote", "final_quote", priceMark(order.final_quote !== null ? `<strong>${money(order.final_quote)}</strong>` : ""), `<input type="number" min="0" step="1" name="final_quote" value="${order.final_quote ?? ""}" placeholder="Same as quote">`, order.final_quote !== null)}
      ${editable("Broker fee", "broker_fee", priceMark(order.broker_fee !== null ? money(order.broker_fee) : ""), `<input type="number" min="0" step="1" name="broker_fee" value="${order.broker_fee ?? ""}" placeholder="0">`, order.broker_fee !== null)}
      ${editable("Carrier fee", "carrier_fee", priceMark(order.carrier_fee !== null ? money(order.carrier_fee) : ""), `<input type="number" min="0" step="1" name="carrier_fee" value="${order.carrier_fee ?? ""}" placeholder="0">`, order.carrier_fee !== null)}
      ${plain("Total price", priceMark(order.broker_fee !== null || order.carrier_fee !== null ? `<strong>${money((order.broker_fee ?? 0) + (order.carrier_fee ?? 0))}</strong>` : ""))}
      ${editable("Paid amount", "paid_amount", order.paid_amount !== null ? `<strong>${money(order.paid_amount)}</strong>` : "", `<input type="number" min="0" name="paid_amount" value="${order.paid_amount ?? ""}" placeholder="0">`)}
      ${editable(
    "Carrier",
    "carrier",
    order.carrier_name ? `${esc(order.carrier_name)}${carrierLine ? `<br><span class="muted small">${esc(carrierLine)}</span>` : ""}${driverLine ? `<br><span class="muted small">Driver: ${esc(driverLine)}</span>` : ""}` : "",
    `<div class="edit-stack">
          <div class="edit-grid">${text("carrier_name", "Company", order.carrier_name)}${text("carrier_mc", "MC number", order.carrier_mc)}</div>
          <div class="edit-grid">${text("carrier_company_phone", "Company phone", order.carrier_company_phone)}${text("carrier_email", "Company email", order.carrier_email, ' type="email"')}</div>
          <div class="edit-grid">${text("driver_name", "Driver name", order.driver_name)}${text("carrier_phone", "Driver phone", order.carrier_phone)}</div>
        </div>`,
  )}
      ${editable("Customer notes", "notes", esc(order.notes ?? ""), `<textarea name="notes" rows="3">${esc(order.notes ?? "")}</textarea>`)}
  </tbody></table>`;
}

function nextStatusButton(order: OrderRow): string {
  const next = ORDER_STATUSES[ORDER_STATUSES.indexOf(order.status as OrderStatus) + 1];
  if (!next || next === "cancelled") return "";
  return `<button class="btn btn-accent btn-block" type="submit" name="move_status" value="${next}">Save and move to ${esc(STATUS_LABELS[next])}</button>`;
}

function historyRows(events: OrderEventRow[], limit?: number): string {
  const ordered = [...events].sort((a, b) => b.created_at - a.created_at || b.id - a.id);
  return (limit ? ordered.slice(0, limit) : ordered)
    .map(
      (event) =>
        `<tr><td class="muted small">${whenHtml(event.created_at)}</td><td>${esc(eventLabel(event.kind))}</td><td>${esc(event.note ?? "")}</td><td class="muted small">${esc(event.actor ?? "")}</td></tr>`,
    )
    .join("");
}

const PAYMENT_STATES: [string, string][] = [
  ["unpaid", "Not paid"],
  ["partial", "Partially paid"],
  ["full", "Paid in full"],
];

/** Payment state badge; partial payments carry the amount received. */
function paymentStateBadge(state: string, paidAmount: number | null): string {
  if (state === "full") return '<span class="badge badge-paid">Paid in full</span>';
  if (state === "partial") {
    return `<span class="badge badge-partial">Partially paid${paidAmount !== null ? ` ${money(paidAmount)}` : ""}</span>`;
  }
  return '<span class="badge badge-unpaid">Not paid</span>';
}

/** Send button plus sent/paid state for one invoice kind. */
function invoiceAction(order: OrderRow, events: OrderEventRow[], kind: "client" | "carrier"): string {
  const to = kind === "carrier" ? order.carrier_email : order.customer_email;
  const sent = events.some((event) => event.kind === `invoice_${kind}`);
  const paid = events.some((event) => event.kind === `invoice_${kind}_paid`);
  const label = kind === "carrier" ? "Carrier invoice" : "Client invoice";
  const button = to
    ? `<button class="btn btn-accent btn-small" type="submit">Send to ${kind}</button>`
    : `<button class="btn btn-ghost btn-small" type="submit" disabled>No ${kind} email</button>`;
  const amount =
    kind === "client"
      ? (order.client_invoice_amount ?? order.final_quote ?? order.price)
      : (order.carrier_invoice_amount ?? order.carrier_fee ?? 0);
  return `<div class="invoice-card">
      <form method="post" action="/admin/orders/${order.id}/invoice/${kind}/send" class="invoice-action" data-kind="${kind}" data-to="${esc(to ?? "")}">
        <div class="invoice-action-head">
          <strong>${label}</strong>
          ${paid ? '<span class="badge badge-paid">Paid</span>' : sent ? '<span class="badge badge-sent">Sent</span>' : '<span class="badge badge-unpaid">Not sent</span>'}
        </div>
        <span class="muted small">${to ? esc(to) : "Add an email on this order first"}</span>
        <label class="field invoice-amount"><span>Amount (USD)</span><input name="amount" type="number" min="0" step="1" value="${amount ?? ""}" required></label>
        ${button}
      </form>
      ${paid
        ? ""
        : `<form method="post" action="/admin/orders/${order.id}/invoice/${kind}/paid" class="invoice-paid">
        <button class="btn btn-ghost btn-small" type="submit">Mark ${kind} invoice paid</button>
      </form>`}
    </div>`;
}

/** A contract exists once the order reached the draft step (and survives later statuses). */
function hasContract(order: OrderRow, events: OrderEventRow[]): boolean {
  if (order.status === "cancelled") return events.some((event) => event.kind === "contract_draft");
  return ORDER_STATUSES.indexOf(order.status as OrderStatus) >= ORDER_STATUSES.indexOf("contract_draft");
}

/** Full-page contract preview inside a modal, plus a download link. */
function contractModal(order: OrderRow): string {
  const eyebrow = order.status === "contract_draft" ? "Contract draft" : "Contract";
  return `<div class="modal" id="contract-${order.id}">
  <a class="modal-backdrop" href="#order-${order.id}" aria-label="Close"></a>
  <div class="modal-card modal-card-wide" role="dialog" aria-modal="true" aria-label="Draft contract">
    <div class="modal-head">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h2>${esc(order.number)}</h2>
      </div>
      <a class="modal-close" href="#order-${order.id}" aria-label="Close">×</a>
    </div>
    <iframe class="contract-frame" src="/admin/orders/${order.id}/contract" loading="lazy" title="Draft contract"></iframe>
    <div class="modal-actions mt">
      <a class="btn btn-accent" href="/admin/orders/${order.id}/contract?download=1">Download Word (.docx)</a>
      <a class="btn btn-ghost" href="/admin/orders/${order.id}/contract?download=1&amp;format=html">Download HTML</a>
      <a class="btn btn-ghost" href="#order-${order.id}">Back to order</a>
    </div>
  </div>
</div>`;
}

export function orderModal(
  order: OrderRow,
  photos: OrderPhotoRow[],
  events: OrderEventRow[] = [],
  error?: string,
  units: OrderUnitRow[] = [],
): string {
  const anchor = `/admin/orders#order-${order.id}`;

  return `<div class="modal" id="order-${order.id}">
  <a class="modal-backdrop" href="#orders" aria-label="Close"></a>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="order-${order.id}-title">
    <div class="modal-head">
      <div>
        <p class="eyebrow">Order</p>
        <h2 id="order-${order.id}-title">${esc(order.number)} ${statusBadge(order.status, true)}</h2>
        <p class="muted small">Booked ${whenHtml(order.created_at)} · updated ${whenHtml(order.updated_at)}</p>
      </div>
      <a class="modal-close" href="#orders" aria-label="Close">×</a>
    </div>

    ${orderFieldsTable(order, anchor)}

    ${photos.length
      ? `<h3 class="section-title mt">Vehicle photos</h3>
    <div class="photo-grid">${photos
        .map(
          (photo) =>
            `<a href="/admin/order-photos/${photo.id}" target="_blank" rel="noopener"><img class="lead-photo" src="/admin/order-photos/${photo.id}" alt="Vehicle photo for ${esc(order.number)}" loading="lazy"></a>`,
        )
        .join("")}</div>`
      : ""}

    <form method="post" action="/admin/orders/${order.id}/status" class="quote-form">
      <input type="hidden" name="next" value="${esc(anchor)}">
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
      ${statusFields(order)}
      ${nextStatusButton(order)}
      <div class="status-actions">${ORDER_STATUSES.map(
        (value) => `<button class="chip chip-status-${value}${order.status === value ? " active" : ""}" type="submit" name="status" value="${value}">${esc(STATUS_LABELS[value])}</button>`,
      ).join("")}</div>
    </form>

    ${hasContract(order, events)
      ? `<h3 class="section-title mt">${order.status === "contract_draft" ? "Contract draft" : "Contract"}</h3>
    <div class="modal-actions">
      <a class="btn btn-accent" href="#contract-${order.id}">${order.status === "contract_draft" ? "View draft contract" : "View contract"}</a>
      <a class="btn btn-ghost" href="/admin/orders/${order.id}/contract?download=1">Download Word</a>
    </div>`
      : ""}

    ${order.status === "paid"
      ? `<h3 class="section-title mt">Invoices</h3>
    <div class="invoice-actions">
      ${invoiceAction(order, events, "client")}
      ${invoiceAction(order, events, "carrier")}
    </div>`
      : ""}

    ${units.length > 1
      ? `<h3 class="section-title mt">Vehicles</h3>
    <table class="table"><thead><tr><th>#</th><th>Vehicle</th><th>Condition</th><th>Price</th></tr></thead><tbody>${units
        .map(
          (unit) =>
            `<tr><td>${unit.position}</td><td>${esc([unit.vehicle_year, unit.vehicle_make, unit.vehicle_model].filter(Boolean).join(" ") || "—")}${unit.vin ? `<br><span class="muted small">${esc(unit.vin)}</span>` : ""}</td><td>${conditionTag(unit.condition ?? "running")}</td><td>${unit.price !== null ? money(unit.price) : "—"}</td></tr>`,
        )
        .join("")}</tbody></table>`
      : ""}

    <div class="modal-actions mt">
      <a class="btn btn-ghost" href="/admin/orders/${order.id}">Open full record</a>
      <a class="btn btn-ghost" href="/track/${esc(order.token)}">Customer view</a>
    </div>

    ${events.length
      ? `<h3 class="section-title mt">History</h3>
    <table class="table"><thead><tr><th>When</th><th>Event</th><th>Note</th><th>By</th></tr></thead><tbody>${historyRows(events, 8)}</tbody></table>`
      : ""}
  </div>
</div>`;
}

/** Save a single field without reloading: refresh only that order's modal in place. */
function fieldSaveAsync(): string {
  return `<script>
(function () {
  var section = document.getElementById("orders");
  if (!section || !window.fetch || !window.DOMParser) return;
  section.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.classList || !form.classList.contains("field-editor")) return;
    var modal = form.closest(".modal");
    if (!modal) return;
    event.preventDefault();
    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      credentials: "same-origin",
      headers: { "x-async": "1" },
    })
      .then(function (response) { return response.text(); })
      .then(function (html) {
        // The server answers with just this order's modal; swap it inside the same element
        // so the URL hash still targets it.
        var fresh = new DOMParser().parseFromString(html, "text/html").getElementById(modal.id);
        if (!fresh) { form.submit(); return; }
        modal.innerHTML = fresh.innerHTML;
      })
      .catch(function () { form.submit(); });
  });
})();
</script>`;
}

/** Confirm recipient and amount before an invoice goes out. */
function invoiceConfirmUi(): string {
  return `
<div class="confirm-backdrop" id="invoiceConfirm" hidden>
  <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="invoiceConfirmTitle">
    <h3 id="invoiceConfirmTitle">Send invoice?</h3>
    <dl class="confirm-rows">
      <div><dt>To</dt><dd id="invoiceConfirmTo"></dd></div>
      <div><dt>Amount</dt><dd id="invoiceConfirmAmount"></dd></div>
    </dl>
    <div class="confirm-actions">
      <button type="button" class="btn btn-ghost" id="invoiceConfirmEdit">Edit</button>
      <button type="button" class="btn btn-accent" id="invoiceConfirmYes">Yes, send</button>
    </div>
  </div>
</div>

<script>
(function () {
  var box = document.getElementById("invoiceConfirm");
  var toEl = document.getElementById("invoiceConfirmTo");
  var amountEl = document.getElementById("invoiceConfirmAmount");
  var titleEl = document.getElementById("invoiceConfirmTitle");
  var yes = document.getElementById("invoiceConfirmYes");
  var edit = document.getElementById("invoiceConfirmEdit");
  if (!box || !yes || !edit) return;
  var pending = null;

  function close() {
    box.hidden = true;
    pending = null;
    yes.disabled = false;
    yes.textContent = "Yes, send";
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest(".invoice-action button[type=submit]") : null;
    if (!button) return;
    var form = button.form;
    if (!form) return;
    event.preventDefault();
    var amount = form.querySelector('input[name="amount"]');
    if (!amount || !amount.value) {
      amount.reportValidity();
      return;
    }
    pending = form;
    titleEl.textContent = (form.getAttribute("data-kind") === "carrier" ? "Send carrier invoice?" : "Send client invoice?");
    toEl.textContent = form.getAttribute("data-to") || "—";
    amountEl.textContent = "$" + Number(amount.value).toLocaleString();
    box.hidden = false;
    yes.focus();
  });

  edit.addEventListener("click", close);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || box.hidden) return;
    event.preventDefault();
    close();
  });

  yes.addEventListener("click", function () {
    if (!pending) return;
    var form = pending;
    var modal = form.closest(".modal");
    yes.disabled = true;
    yes.textContent = "Sending…";
    fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin" })
      .then(function (response) { return response.text(); })
      .then(function (html) {
        close();
        if (!modal) { window.location.reload(); return; }
        var fresh = new DOMParser().parseFromString(html, "text/html").getElementById(modal.id);
        if (fresh) modal.innerHTML = fresh.innerHTML;
        else window.location.reload();
      })
      .catch(function () {
        close();
        form.submit();
      });
  });
})();
</script>`;
}

/** Reload the contract iframe each time it opens, so edits made in the order show up. */
function contractFrameRefresh(): string {
  return `<script>
(function () {
  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#contract-"]') : null;
    if (!link) return;
    var modal = document.getElementById((link.getAttribute("href") || "").slice(1));
    if (!modal) return;
    var frame = modal.querySelector("iframe");
    if (!frame) return;
    var base = (frame.getAttribute("data-src") || frame.getAttribute("src") || "").split("?")[0];
    frame.setAttribute("data-src", base);
    frame.setAttribute("src", base + "?t=" + Date.now());
  });
})();
</script>`;
}

function statusConfirmUi(): string {
  return `
<div class="confirm-backdrop" id="statusConfirm" hidden>
  <div class="confirm-card" id="statusConfirmCard" role="dialog" aria-modal="true" aria-labelledby="statusConfirmTitle">
    <div id="statusConfirmBody">
      <h3 id="statusConfirmTitle">Change status?</h3>
      <p class="muted" id="statusConfirmText"></p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-ghost" id="statusConfirmNo">No, keep it</button>
        <button type="button" class="btn btn-accent" id="statusConfirmYes">Yes, change it</button>
      </div>
    </div>
    <div class="confirm-loading" id="statusLoading" hidden>
      <iframe title="Updating status" data-src="/loader/whip"></iframe>
      <p class="load-caption" id="statusLoadingText">Updating status…</p>
    </div>
  </div>
</div>

<script>
(function () {
  var pending = null;
  var box = document.getElementById("statusConfirm");
  var card = document.getElementById("statusConfirmCard");
  var body = document.getElementById("statusConfirmBody");
  var text = document.getElementById("statusConfirmText");
  var yes = document.getElementById("statusConfirmYes");
  var no = document.getElementById("statusConfirmNo");
  var loading = document.getElementById("statusLoading");
  var frame = loading ? loading.querySelector("iframe") : null;
  if (!box || !card || !body || !loading || !frame) return;

  function close() {
    box.hidden = true;
    pending = null;
    body.hidden = false;
    loading.hidden = true;
    card.classList.remove("is-loading");
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest('.status-actions button[type="submit"]') : null;
    if (!button) return;
    event.preventDefault();
    pending = button;
    text.textContent = "Set this order to " + (button.textContent || "").trim() + "?";
    body.hidden = false;
    loading.hidden = true;
    card.classList.remove("is-loading");
    box.hidden = false;
    yes.focus();
  });

  no.addEventListener("click", close);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || box.hidden) return;
    event.preventDefault();
    close();
  });

  var CYCLE_MS = 2400;

  yes.addEventListener("click", function () {
    if (!pending) return;
    var button = pending;
    var form = button.form;
    var failed = false;

    body.hidden = true;
    card.classList.add("is-loading");
    loading.hidden = false;
    if (!frame.getAttribute("src")) frame.setAttribute("src", frame.getAttribute("data-src") || "/loader/whip");

    // Send the change immediately so the server works while the animation plays,
    // then reload once the single loop has finished.
    var destination = null;
    if (form && window.fetch) {
      var data = new FormData(form);
      if (button.name) data.append(button.name, button.value);
      fetch(form.action, { method: "POST", body: data, credentials: "same-origin", headers: { "x-async": "1" } })
        .then(function (response) {
          if (!response.ok) {
            failed = true;
            return;
          }
          return response.json().then(function (payload) {
            if (payload && payload.redirect) destination = payload.redirect;
          });
        })
        .catch(function () {
          failed = true;
        });
    }

    window.setTimeout(function () {
      if (failed && form) {
        form.submit();
        return;
      }
      if (destination) {
        window.location.assign(destination);
        return;
      }
      window.location.reload();
    }, CYCLE_MS);
  });

  var prefetch = document.createElement("link");
  prefetch.rel = "prefetch";
  prefetch.as = "document";
  prefetch.href = "/loader/whip";
  document.head.appendChild(prefetch);
})();
</script>`;
}

export function adminOrdersPage(
  orders: OrderRow[],
  status: string,
  isAdmin = false,
  photos: OrderPhotoRow[] = [],
  sort = "created",
  dir = "desc",
  events: OrderEventRow[] = [],
  counts: Record<string, number> = {},
  errorOrder: number | null = null,
  error?: string,
  unitsByOrder: Map<number, OrderUnitRow[]> = new Map(),
): string {
  const photosByOrder = new Map<number, OrderPhotoRow[]>();
  for (const photo of photos) {
    const list = photosByOrder.get(photo.order_id);
    if (list) list.push(photo);
    else photosByOrder.set(photo.order_id, [photo]);
  }
  const eventsByOrder = new Map<number, OrderEventRow[]>();
  for (const event of events) {
    const list = eventsByOrder.get(event.order_id);
    if (list) list.push(event);
    else eventsByOrder.set(event.order_id, [event]);
  }

  const sortLink = (key: string, label: string) => {
    const active = sort === key;
    const nextDir = active && dir === "desc" ? "asc" : "desc";
    const arrow = active ? (dir === "asc" ? " ▲" : " ▼") : "";
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    params.set("sort", key);
    params.set("dir", nextDir);
    return `<a class="sort-link${active ? " active" : ""}" href="/admin/orders?${params.toString()}">${esc(label)}${arrow}</a>`;
  };
  const filterHref = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "all") params.set("status", value);
    if (sort !== "created") params.set("sort", sort);
    if (dir !== "desc") params.set("dir", dir);
    const query = params.toString();
    return `/admin/orders${query ? `?${query}` : ""}`;
  };

  const invoiceCell = (order: OrderRow, kind: "client" | "carrier") => {
    if (order.status !== "paid") return '<span class="muted small">—</span>';
    const events = eventsByOrder.get(order.id) ?? [];
    if (events.some((event) => event.kind === `invoice_${kind}_paid`)) return '<span class="badge badge-paid">Paid</span>';
    if (events.some((event) => event.kind === `invoice_${kind}`)) return '<span class="badge badge-sent">Sent</span>';
    return '<span class="badge badge-unpaid">Not sent</span>';
  };

  const rows = orders
    .map(
      (order) => `<tr${order.status !== "paid" && isDeliveryDue(order.delivery_eta) ? ' class="row-due"' : ""}>
      <td><a class="row-link" href="#order-${order.id}">${esc(order.number)}</a></td>
      <td>${esc(order.customer_name)}<br><span class="muted small">${esc(order.customer_phone)}</span></td>
      <td>${esc(order.origin_zip)} → ${esc(order.dest_zip)}<br><span class="muted small">${esc(order.transport_type)}</span></td>
      <td>${order.distance_miles ? `${order.distance_miles.toLocaleString()} mi` : "—"}</td>
      <td>${money(order.price)}</td>
      <td>${order.status === "paid" ? paymentStateBadge(order.payment_state, order.paid_amount) : statusBadge(order.status, true)}</td>
      <td class="muted small">${order.delivery_eta ? dueSpan(order.delivery_eta, whenHtml(order.delivery_eta)) : "—"}</td>
      <td>${invoiceCell(order, "client")}</td>
      <td>${invoiceCell(order, "carrier")}</td>
      <td class="muted small">${whenHtml(order.created_at)}</td>
    </tr>`,
    )
    .join("");

  return layout({
    admin: true,
    title: "Orders — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section" id="orders">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Orders</h1></div>
    <nav class="admin-nav">
      <a href="/admin/orders"${status === "all" ? ' class="active"' : ""}>Orders</a><a href="/admin/staff">Performance</a>${isAdmin ? '<a href="/admin/users">Staff</a>' : ""}<a href="/admin/account">Account</a>
    </nav>
  </div>
  <div class="filter-row filter-row-orders">
    <a href="${filterHref("all")}" class="chip chip-status-all${status === "all" ? " active" : ""}">
      <span>All</span><span class="chip-count">${Object.values(counts).reduce((sum, n) => sum + n, 0)}</span>
    </a>
    ${ORDER_STATUSES.map(
      (value) => `<a href="${filterHref(value)}" class="chip chip-status-${value}${status === value ? " active" : ""}">
        <span>${esc(STATUS_LABELS[value])}</span><span class="chip-count">${counts[value] ?? 0}</span>
      </a>`,
    ).join("")}
  </div>
  ${orders.length === 0
        ? `<p class="muted">No orders in this view.</p>`
        : `<div class="table-scroll"><table class="table rows-clickable"><thead><tr>
      <th>${sortLink("order", "Order")}</th>
      <th>${sortLink("customer", "Customer")}</th>
      <th>${sortLink("route", "Route")}</th>
      <th>${sortLink("distance", "Distance")}</th>
      <th>${sortLink("price", "Price")}</th>
      <th>${sortLink("status", "Status")}</th>
      <th>Delivery ETA</th>
      <th>Client invoice</th>
      <th>Carrier invoice</th>
      <th>${sortLink("created", "Created")}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`
      }
  ${orders.map((order) => orderModal(order, photosByOrder.get(order.id) ?? [], eventsByOrder.get(order.id) ?? [], errorOrder === null || errorOrder === order.id ? error : undefined, unitsByOrder.get(order.id) ?? [])).join("")}
  ${orders.filter((order) => hasContract(order, eventsByOrder.get(order.id) ?? [])).map(contractModal).join("")}
  ${statusConfirmUi()}
  ${invoiceConfirmUi()}
  ${contractFrameRefresh()}
  ${fieldSaveAsync()}
</section>`,
  });
}

export function adminOrderPage(
  order: OrderRow,
  events: OrderEventRow[],
  invoices: InvoiceRow[],
  baseUrl = "",
  photos: OrderPhotoRow[] = [],
  error?: string,
  units: OrderUnitRow[] = [],
): string {
  const eventRows = historyRows(events);

  const invoiceRows = invoices
    .map(
      (invoice) => `<tr>
      <td><a href="/admin/invoices/${invoice.id}">${esc(invoice.number)}</a></td>
      <td>${esc(invoice.description)}</td>
      <td>${money(invoice.amount)}</td>
      <td>${esc(invoice.status)}</td>
      <td class="muted small">${whenHtml(invoice.issued_at)}</td>
      <td>${invoice.status === "paid"
          ? ""
          : `<form method="post" action="/admin/invoices/${invoice.id}/paid"><button class="btn btn-ghost btn-small" type="submit">Mark paid</button></form>`
        }</td>
    </tr>`,
    )
    .join("");

  return layout({
    admin: true,
    title: `${order.number} — Bond Auto Transport`,
    description: "Order detail.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div>
      <p class="eyebrow"><a href="/admin/orders">← All orders</a></p>
      <h1 class="page-title">${esc(order.number)} ${statusBadge(order.status)}</h1>
      <p class="muted small">Booked ${whenHtml(order.created_at)} · updated ${whenHtml(order.updated_at)}</p>
    </div>
    <div class="admin-user"><a class="btn btn-ghost" href="/track/${esc(order.token)}">Customer view</a></div>
  </div>

  <div class="card tracking-card">
    <h3>Tracking link</h3>
    <input class="copy-field" readonly value="${esc(baseUrl)}/track/${esc(order.token)}" onclick="this.select()">
    <p class="muted small">Send this to the customer. No password needed; it shows status, carrier and invoices only.</p>
  </div>

  ${hasContract(order, events)
      ? `<div class="modal-actions mt">
    <a class="btn btn-accent" href="/admin/orders/${order.id}/contract">View contract</a>
    <a class="btn btn-ghost" href="/admin/orders/${order.id}/contract?download=1">Download Word</a>
  </div>`
      : ""}

  <h2 class="section-title mt">Full record</h2>
  ${orderFieldsTable(order, `/admin/orders/${order.id}`)}

  ${units.length > 1
      ? `<h2 class="section-title mt">Vehicles</h2>
  <table class="table"><thead><tr><th>#</th><th>Vehicle</th><th>Condition</th><th>Price</th></tr></thead><tbody>${units
      .map(
        (unit) =>
          `<tr><td>${unit.position}</td><td>${esc([unit.vehicle_year, unit.vehicle_make, unit.vehicle_model].filter(Boolean).join(" ") || "—")}</td><td>${conditionTag(unit.condition ?? "running")}</td><td>${unit.price !== null ? money(unit.price) : "—"}</td></tr>`,
      )
      .join("")}</tbody></table>`
      : ""}

  ${photos.length
        ? `<h2 class="section-title mt">Vehicle photos</h2>
  <div class="photo-grid">${photos
          .map(
            (photo) =>
              `<a href="/admin/order-photos/${photo.id}" target="_blank" rel="noopener"><img class="lead-photo" src="/admin/order-photos/${photo.id}" alt="Vehicle photo for ${esc(order.number)}" loading="lazy"></a>`,
          )
          .join("")}</div>`
        : ""}

  <h2 class="section-title mt">Actions</h2>
  <div class="cards two-up">
    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/status">
      <h3>Change status</h3>
      <label class="field"><span>Status</span>
        <select name="status">${ORDER_STATUSES.map(
          (value) => `<option value="${value}"${order.status === value ? " selected" : ""}>${esc(STATUS_LABELS[value])}</option>`,
        ).join("")}</select>
      </label>
      ${statusFields(order)}
      <label class="field"><span>Note</span><input name="note" placeholder="Optional"></label>
      ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
      <button class="btn btn-accent btn-block" type="submit">Save status</button>
      ${nextStatusButton(order)}
    </form>

    ${order.status === "confirmed" ? `    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/carrier">
      <h3>Assign carrier</h3>
      <label class="field"><span>Company</span><input name="carrier_name" required value="${esc(order.carrier_name ?? "")}"></label>
      <div class="field-row">
        <label class="field"><span>MC number</span><input name="carrier_mc" value="${esc(order.carrier_mc ?? "")}"></label>
        <label class="field"><span>Company phone</span><input name="carrier_company_phone" value="${esc(order.carrier_company_phone ?? "")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Company email</span><input name="carrier_email" type="email" value="${esc(order.carrier_email ?? "")}"></label>
        <label class="field"><span>Driver name</span><input name="driver_name" value="${esc(order.driver_name ?? "")}"></label>
      </div>
      <label class="field"><span>Driver phone</span><input name="carrier_phone" value="${esc(order.carrier_phone ?? "")}"></label>
      <button class="btn btn-accent" type="submit">Assign carrier</button>
    </form>` : ""}
  </div>

  <div class="cards two-up mt">
    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/invoice">
      <h3>Create invoice</h3>
      <label class="field"><span>Description</span><input name="description" value="Vehicle transport ${esc(order.number)}"></label>
      <div class="field-row">
        <label class="field"><span>Amount (USD)</span><input name="amount" type="number" min="1" step="1" value="${order.price}" required></label>
        <div class="field"><span>Due date</span>${datePicker("due_at", "")}</div>
      </div>
      <label class="field"><span>Note</span><input name="note"></label>
      <button class="btn btn-accent" type="submit">Issue invoice</button>
    </form>

    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/note">
      <h3>Internal note</h3>
      <label class="field"><span>Note</span><textarea name="note" rows="3" required></textarea></label>
      <button class="btn btn-ghost" type="submit">Add note</button>
      <p class="form-note">Internal only — never shown on the customer tracking page.</p>
    </form>
  </div>

  <h2 class="section-title mt">Invoices</h2>
  ${invoices.length === 0
        ? `<p class="muted">No invoices yet.</p>`
        : `<table class="table"><thead><tr><th>Number</th><th>Description</th><th>Amount</th><th>Status</th><th>Issued</th><th></th></tr></thead><tbody>${invoiceRows}</tbody></table>`
      }

  <h2 class="section-title mt">History</h2>
  <table class="table"><thead><tr><th>When</th><th>Event</th><th>Note</th><th>By</th></tr></thead><tbody>${eventRows}</tbody></table>
  ${statusConfirmUi()}
  ${invoiceConfirmUi()}
  ${contractFrameRefresh()}
  ${fieldSaveAsync()}
</section>`,
  });
}

export function invoicePage(invoice: InvoiceRow, order: OrderRow): string {
  return layout({
    admin: true,
    title: `${invoice.number} — Bond Auto Transport`,
    description: `Invoice ${invoice.number}.`,
    body: `
<section class="wrap section prose">
  <div class="invoice-head">
    <div><p class="eyebrow">Invoice</p><h1 class="page-title">${esc(invoice.number)}</h1></div>
    <button class="btn btn-ghost no-print" onclick="window.print()">Print</button>
  </div>
  <p class="muted small">Issued ${whenHtml(invoice.issued_at)}${invoice.due_at ? ` · due ${dateOnly(invoice.due_at)}` : ""} · status ${esc(invoice.status)}</p>

  <table class="table">
    <tbody>
      <tr><th>Billed to</th><td>${esc(order.customer_name)}<br>${esc(order.customer_email)}<br>${esc(order.customer_phone)}</td></tr>
      <tr><th>Order</th><td>${esc(order.number)}</td></tr>
      <tr><th>Route</th><td>${esc(order.origin_city ?? order.origin_zip)}, ${esc(stateName(order.origin_state))} → ${esc(order.dest_city ?? order.dest_zip)}, ${esc(stateName(order.dest_state))}</td></tr>
      <tr><th>Vehicle</th><td>${esc([order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "—")}${order.vin ? ` · VIN ${esc(order.vin)}` : ""}</td></tr>
      <tr><th>Description</th><td>${esc(invoice.description)}</td></tr>
      <tr><th>Amount</th><td><strong>${money(invoice.amount)}</strong></td></tr>
    </tbody>
  </table>
  ${invoice.note ? `<p class="muted small">${esc(invoice.note)}</p>` : ""}
  <p class="muted small">${esc(site.name)} · ${esc(site.mc)} · ${esc(site.dot)} · ${esc(site.phone)}</p>
</section>`,
  });
}

export function adminUsersPage(
  users: UserRow[],
  viewer: UserRow,
  flash?: { email: string; password: string; kind: "created" | "reset" },
): string {
  const rows = users
    .map(
      (user) => `<tr>
      <td>${esc(user.email)}${user.id === viewer.id ? ' <span class="muted small">(you)</span>' : ""}</td>
      <td>${esc(user.name ?? "—")}</td>
      <td>${esc(ROLE_LABELS[user.role as Role] ?? user.role)}</td>
      <td>${user.active ? '<span class="badge badge-delivered">Active</span>' : '<span class="badge badge-cancelled">Disabled</span>'}</td>
      <td class="muted small">${user.last_login_at ? whenHtml(user.last_login_at) : "never"}</td>
      <td>
        <form method="post" action="/admin/users/${user.id}/reset" class="inline-form">
          <button class="btn btn-ghost btn-small" type="submit">New password</button>
        </form>
        ${user.id === viewer.id
          ? ""
          : `<form method="post" action="/admin/users/${user.id}/active" class="inline-form">
                 <input type="hidden" name="active" value="${user.active ? "0" : "1"}">
                 <button class="btn btn-ghost btn-small" type="submit">${user.active ? "Disable" : "Enable"}</button>
               </form>`
        }
      </td>
    </tr>`,
    )
    .join("");

  return layout({
    admin: true,
    title: "Staff accounts — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Staff accounts</h1>
      <nav class="admin-nav">
        <a href="/admin/orders">Orders</a>
        <a href="/admin/staff">Performance</a>
        <a href="/admin/users" class="active">Staff</a>
        <a href="/admin/account">Account</a>
      </nav>
    </div>
    <div class="admin-user"><span class="muted small">${esc(viewer.email)}</span><form method="post" action="/admin/logout"><button class="btn btn-ghost" type="submit">Sign out</button></form></div>
  </div>

  ${flash
        ? `<div class="flash">
           <strong>${flash.kind === "created" ? "Account created" : "Password reset"} for ${esc(flash.email)}</strong>
           <p>Temporary password: <code class="password">${esc(flash.password)}</code></p>
           <p class="muted small">Give it to them now — it is not shown again. They can change it after signing in.</p>
         </div>`
        : ""
      }

  <div class="cards two-up">
    <form class="card quote-form" method="post" action="/admin/users">
      <h3>Add a staff account</h3>
      <label class="field"><span>Email *</span><input name="email" type="email" required></label>
      <label class="field"><span>Name</span><input name="name"></label>
      <label class="field"><span>Role</span>
        <select name="role">
          <option value="dispatcher">Dispatcher — orders only</option>
          <option value="admin">Admin — orders and staff accounts</option>
        </select>
      </label>
      <label class="field"><span>Password</span><input name="password" placeholder="Leave blank to generate one"></label>
      <button class="btn btn-accent" type="submit">Create account</button>
    </form>

    <div class="card">
      <h3>What each role can do</h3>
      <p class="muted small"><strong>Dispatcher</strong> — see leads, orders, change status, assign carriers, issue invoices.</p>
      <p class="muted small"><strong>Admin</strong> — everything above, plus create staff accounts, reset passwords and disable access.</p>
      <p class="muted small">Accounts are disabled, never deleted, so their name stays on past orders.</p>
    </div>
  </div>

  <h2 class="section-title mt">Accounts</h2>
  <table class="table">
    <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`,
  });
}

export function accountPage(user: UserRow, message?: string, error?: string): string {
  return layout({
    admin: true,
    title: "Your account — Bond Auto Transport",
    description: "Change your password.",
    body: `
<section class="wrap section narrow-wrap">
  <div class="admin-head">
    <div>
      <p class="eyebrow">Dispatch</p><h1 class="page-title">Your account</h1>
      <nav class="admin-nav">
        <a href="/admin/orders">Orders</a>
        <a href="/admin/staff">Performance</a>
        ${user.role === "admin" ? '<a href="/admin/users">Staff</a>' : ""}
        <a href="/admin/account" class="active">Account</a>
      </nav>
    </div>
  </div>
  <p class="muted small">${esc(user.email)} · ${esc(ROLE_LABELS[user.role as Role] ?? user.role)}</p>

  ${message ? `<div class="flash"><strong>${esc(message)}</strong></div>` : ""}
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

  <form class="quote-form" method="post" action="/admin/account">
    <label class="field"><span>Current password</span><input name="current" type="password" required autocomplete="current-password"></label>
    <label class="field"><span>New password</span><input name="next" type="password" required minlength="10" autocomplete="new-password"></label>
    <label class="field"><span>Confirm new password</span><input name="confirm" type="password" required minlength="10" autocomplete="new-password"></label>
    <button class="btn btn-accent" type="submit">Update password</button>
    <p class="form-note">At least 10 characters. You stay signed in on this device.</p>
  </form>
</section>`,
  });
}

export interface TelegramChat {
  id: string;
  type: string;
  title: string;
  last: number;
}

export function telegramPage(
  target: string | null,
  fromEnv: boolean,
  chats: TelegramChat[],
  message?: string,
  error?: string,
): string {
  const rows = chats
    .map(
      (chat) => `<tr>
      <td><code>${esc(chat.id)}</code></td>
      <td>${esc(chat.type)}</td>
      <td>${esc(chat.title)}</td>
      <td class="muted small">${new Date(chat.last * 1000).toLocaleString()}</td>
      <td><form method="post" action="/admin/telegram" class="inline-form">
        <input type="hidden" name="chat_id" value="${esc(chat.id)}">
        <button class="btn btn-ghost btn-small" type="submit">Use this chat</button>
      </form></td>
    </tr>`,
    )
    .join("");

  return layout({
    admin: true,
    title: "Telegram — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Telegram notifications</h1>
      <nav class="admin-nav">
        <a href="/admin/orders">Orders</a>
        <a href="/admin/telegram" class="active">Telegram</a>
        <a href="/admin/account">Account</a>
      </nav>
    </div>
  </div>

  ${message ? `<div class="flash"><strong>${esc(message)}</strong></div>` : ""}
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

  <div class="cards two-up">
    <div class="card">
      <h3>Where notifications go</h3>
      <p>${target ? `<code>${esc(target)}</code>` : '<span class="muted">Not configured</span>'}</p>
      <p class="muted small">${fromEnv ? "From the TELEGRAM_CHAT_ID secret." : "Saved in the console."}</p>
      <form class="quote-form" method="post" action="/admin/telegram">
        <label class="field"><span>Chat IDs, comma separated</span><input name="chat_id" value="${esc(target ?? "")}" placeholder="8804648927, 1235945689"></label>
        <button class="btn btn-accent" type="submit">Save recipients</button>
      </form>
      <form method="post" action="/admin/telegram/test" class="mt">
        <button class="btn btn-ghost" type="submit">Send a test message</button>
      </form>
    </div>

    <div class="card">
      <h3>Who receives it</h3>
      <p class="muted small">A bot only sends to chat IDs you list here. Sharing the bot link with someone just opens a private chat between them and the bot — they receive nothing until their ID is added.</p>
      <p class="muted small">Every ID in the box gets every notification. Use a group ID (starts with <code>-</code>) if you would rather manage the audience in Telegram.</p>
      <p class="muted small">To notify several people, put them all in a <strong>group</strong>, add the bot to that group, then use the group's chat ID (it starts with <code>-</code>). Everyone in the group sees the messages.</p>
      <p class="muted small">A private chat ID is positive, a group ID is negative, and a supergroup starts with <code>-100</code>.</p>
    </div>
  </div>

  <h2 class="section-title mt">Recent chats the bot has seen</h2>
  <p class="muted small">Send a message in the group (or press Start in the bot) and reload this page.</p>
  ${chats.length === 0
        ? `<p class="muted">No recent updates. If a webhook is registered, Telegram stops returning updates here.</p>`
        : `<table class="table"><thead><tr><th>Chat ID</th><th>Type</th><th>Name</th><th>Last message</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
      }
</section>`,
  });
}
