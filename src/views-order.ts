import { esc, MONTH_NAMES, conditionTag, dateOnly, datePicker, layout, money, site, when } from "./views.ts";
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
  notes?: string;
  lead_id?: string;
}

function stateOptions(selected: string | undefined): string {
  const current = stateCode(selected);
  return `<option value="">Select state</option>${US_STATES.map(
    ([code, name]) => `<option value="${code}"${current === code ? " selected" : ""}>${name}</option>`,
  ).join("")}`;
}

export function bookPage(values: BookValues, price: number | null, error?: string): string {
  const v = (key: keyof BookValues) => esc(values[key] ?? "");
  const condition = values.condition || "running";
  const hidden = Object.entries(values)
    .filter(([key]) => key === "lead_id" || key === "order_token")
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${esc(value)}">`)
    .join("");

  return layout({
    title: "Book your transport — Bond Auto Transport",
    description: "Confirm the addresses, contacts and vehicle details so dispatch can assign a carrier.",
    canonical: "/book",
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Booking</p>
      <h1>Book your transport.</h1>
      <p class="lede">We need both addresses and a contact at each end. Dispatch confirms the carrier and the pickup window after you submit.</p>
      <ul class="ticks">
        <li>No card required to book</li>
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
        <li><span>Deposit</span><span>None online</span></li>
        <li><span>Due now</span><span>$0</span></li>
      </ul>
      <p class="muted small">No card is charged now.</p>
    </aside>
  </div>
</section>

<section class="band">
  <div class="wrap trust-row">
    <div><strong>No card required</strong><span>Book now, pay on delivery</span></div>
    <div><strong>Vetted carriers</strong><span>Active insurance checked before assignment</span></div>
    <div><strong>Real dispatcher</strong><span>A person owns your order start to finish</span></div>
    <div><strong>7 days</strong><span>Dispatch availability</span></div>
  </div>
</section>

<section class="wrap section">
  <div class="book-layout">
    <div class="book-form-card">
      <h2 class="section-title">Booking details</h2>
      <p class="muted">Both addresses and a contact at each end. Fields marked * are required.</p>
    <form class="quote-form" method="post" action="/book/submit" enctype="multipart/form-data">
      ${hidden}
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
        <label class="field"><span>VIN</span><input name="vin" maxlength="17" value="${v("vin")}" placeholder="17 characters"></label>
        <label class="field"><span>Transport</span>
          <select name="transport_type">
            <option value="open"${values.transport_type !== "enclosed" ? " selected" : ""}>Open trailer</option>
            <option value="enclosed"${values.transport_type === "enclosed" ? " selected" : ""}>Enclosed trailer</option>
          </select>
        </label>
        <label class="field"><span>Vehicle condition</span>
          <select name="condition">
            <option value="running"${condition === "running" ? " selected" : ""}>Run and drive</option>
            <option value="inoperable_steer_roll"${condition === "inoperable_steer_roll" || condition === "non-running" ? " selected" : ""}>Inoperable (steer and roll)</option>
            <option value="inoperable_no_steer"${condition === "inoperable_no_steer" ? " selected" : ""}>Inoperable (doesn't steer/roll/no keys)</option>
          </select>
        </label>
      </div>

      <a class="btn btn-accent btn-inline" href="/book" target="_blank" rel="noopener">Add another vehicle</a>

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
        <div class="field"><span>Ready date</span>${datePicker("ready_date", values.ready_date ?? "")}</div>
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

function statusBadge(status: string): string {
  const label = STATUS_LABELS[status as OrderStatus] ?? status;
  return `<span class="badge badge-${esc(status)}">${esc(label)}</span>`;
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

  return `<p class="form-section form-section-date">${esc(config.dateLabel)}</p>
      <div class="field-row">
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
      </div>
      <p class="form-note">${config.note}</p>`;
}

function pickupFields(order: OrderRow): string {
  return timeFields({
    dateLabel: "Picked up date",
    monthName: "picked_up_month",
    dayName: "picked_up_day",
    yearName: "picked_up_year",
    hourName: "picked_up_hour",
    minuteName: "picked_up_minute",
    ampmName: "picked_up_ampm",
    value: order.picked_up_at,
    note: order.picked_up_at ? `Saved: ${when(order.picked_up_at)}` : "Choose the pickup date and time in AM/PM.",
  });
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
    note: order.pickup_eta ? `Pickup ETA: ${when(order.pickup_eta)}` : "Choose the estimated pickup time in AM/PM.",
  });
}

function deliveryEtaFields(order: OrderRow): string {
  return timeFields({
    dateLabel: "Delivery ETA",
    monthName: "delivery_eta_month",
    dayName: "delivery_eta_day",
    yearName: "delivery_eta_year",
    hourName: "delivery_eta_hour",
    minuteName: "delivery_eta_minute",
    ampmName: "delivery_eta_ampm",
    value: order.delivery_eta,
    note: order.delivery_eta ? `Delivery ETA: ${when(order.delivery_eta)}` : "Choose the estimated delivery time in AM/PM.",
  });
}

function deliveredFields(order: OrderRow): string {
  return timeFields({
    dateLabel: "Delivered date",
    monthName: "delivered_month",
    dayName: "delivered_day",
    yearName: "delivered_year",
    hourName: "delivered_hour",
    minuteName: "delivered_minute",
    ampmName: "delivered_ampm",
    value: order.delivered_at,
    note: order.delivered_at ? `Delivered: ${when(order.delivered_at)}` : "Choose the delivery date and time in AM/PM.",
  });
}

function paymentFields(order: OrderRow): string {
  const methods = ["Zelle", "Venmo", "CashApp", "PayPal", "Check", "ACH", "Wire"];
  return `<p class="form-section form-section-date">Payment</p>
      <div class="field-row">
        <label class="field"><span>Amount (USD)</span><input name="paid_amount" type="number" min="0" step="1" value="${order.paid_amount ?? order.price}"></label>
        <label class="field"><span>Payment method</span><select name="payment_method">
          <option value="">Select method</option>
          ${methods.map((method) => `<option value="${method}"${order.payment_method === method ? " selected" : ""}>${method}</option>`).join("")}
        </select></label>
      </div>
      <p class="form-note">${order.paid_amount !== null ? `Saved: ${money(order.paid_amount)}${order.payment_method ? ` via ${esc(order.payment_method)}` : ""}` : "Record how the balance was paid."}</p>`;
}

function statusFields(order: OrderRow): string {
  if (order.status === "quoted" || order.status === "cancelled") return "";
  if (order.status === "confirmed" || order.status === "assigned") return pickupEtaFields(order);
  if (order.status === "picked_up") return `${pickupFields(order)}${deliveryEtaFields(order)}`;
  if (order.status === "delivered") return `${pickupFields(order)}${deliveredFields(order)}`;
  return paymentFields(order);
}

export function trackPage(order: OrderRow, events: OrderEventRow[], invoices: InvoiceRow[]): string {
  const done = new Set(events.map((event) => event.kind));
  const current = ORDER_STATUSES.indexOf(order.status as OrderStatus);
  const timeline = CUSTOMER_STAGES.filter(
    (stage) =>
      stage === "quoted" ||
      done.has(stage) ||
      order.status === stage ||
      (order.status !== "cancelled" && current >= ORDER_STATUSES.indexOf(stage)),
  )
    .map((stage) => `<li class="reached"><strong>${esc(STATUS_LABELS[stage])}</strong></li>`)
    .join("");

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
  <p class="eyebrow">Shipment</p>
  <h1 class="page-title">${esc(order.number)} ${statusBadge(order.status)}</h1>
  <p class="muted">${esc(order.origin_city ?? order.origin_zip)}, ${esc(stateName(order.origin_state))} → ${esc(order.dest_city ?? order.dest_zip)}, ${esc(stateName(order.dest_state))}</p>

  <div class="cards two-up">
    <div class="card">
      <h3>Shipment</h3>
      <p>${esc([order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "Vehicle")}</p>
      <p class="muted small">${esc(order.transport_type)} trailer · ${conditionTag(order.condition)}${order.vin ? ` · VIN ${esc(order.vin)}` : ""}</p>
      <p class="muted small">Price ${money(order.price)}${order.distance_miles ? ` · ${order.distance_miles.toLocaleString()} miles` : ""}</p>
      ${order.carrier_name ? `<p class="muted small">Carrier: ${esc(order.carrier_name)}${order.driver_name ? ` · Driver: ${esc(order.driver_name)}` : ""}${order.carrier_phone ? ` · ${esc(order.carrier_phone)}` : ""}</p>` : ""}
      ${order.picked_up_at ? `<p class="muted small">Picked up ${when(order.picked_up_at)}</p>` : ""}
      ${!["picked_up", "delivered", "paid"].includes(order.status) && order.pickup_eta ? `<p class="muted small">Pickup ETA ${when(order.pickup_eta)}</p>` : ""}
      ${order.status === "picked_up" && order.delivery_eta ? `<p class="muted small">Delivery ETA ${when(order.delivery_eta)}</p>` : ""}
      ${order.delivered_at ? `<p class="muted small">Delivered ${when(order.delivered_at)}</p>` : ""}
    </div>
    <div class="card">
      <h3>Progress</h3>
      <ul class="timeline">${timeline}</ul>
    </div>
  </div>

  <div class="card mt">
    <h3>Book another vehicle</h3>
    <p class="muted small">Your details are prefilled. Change anything you need before submitting.</p>
    <form method="post" action="/book">
      ${bookingHidden}
      <button class="btn btn-accent btn-block" type="submit">Continue to booking</button>
    </form>
  </div>

  ${invoices.length
        ? `<h2 class="section-title">Invoices</h2><table class="table"><thead><tr><th>Number</th><th>Amount</th><th>Status</th><th>Issued</th></tr></thead><tbody>${invoices
          .map(
            (invoice) =>
              `<tr><td>${esc(invoice.number)}</td><td>${money(invoice.amount)}</td><td>${esc(invoice.status)}</td><td>${when(invoice.issued_at)}</td></tr>`,
          )
          .join("")}</tbody></table>`
        : ""
      }

  <p class="muted small">Questions? Call ${esc(site.phone)} or email ${esc(site.email)} and quote ${esc(order.number)}.</p>
</section>`,
  });
}

function orderDetailRows(order: OrderRow): string {
  const vehicle = [order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "—";
  const row = (label: string, value: string) =>
    `<tr><th>${esc(label)}</th><td>${value || '<span class="muted">—</span>'}</td></tr>`;
  const carrierLine = [order.carrier_mc, order.carrier_company_phone, order.carrier_email].filter(Boolean).join(" · ");
  const driverLine = [order.driver_name, order.carrier_phone].filter(Boolean).join(" · ");

  return `
      ${row("Order", esc(order.number))}
      ${row("Quote record", order.lead_id ? `<a href="/admin#quote-${order.lead_id}">#${order.lead_id}</a>` : "")}
      ${row("Status", statusBadge(order.status))}
      ${row("Created", when(order.created_at))}
      ${row("Last updated", when(order.updated_at))}
      ${row("Customer", `${esc(order.customer_name)}<br><span class="muted small">${esc(order.customer_email)} · ${esc(order.customer_phone)}</span>`)}
      ${row("Vehicle", `${esc(vehicle)}<br><span class="muted small">${esc(order.transport_type)} trailer · ${conditionTag(order.condition)}</span>`)}
      ${row("VIN", esc(order.vin ?? ""))}
      ${row("Pickup address", `${esc(order.origin_street ?? "")}<br>${esc(order.origin_city ?? "")} ${esc(stateName(order.origin_state))} ${esc(order.origin_zip)}`)}
      ${row("Pickup contact", `${esc(order.origin_contact ?? "")}<br><span class="muted small">${esc(order.origin_phone ?? "")}</span>`)}
      ${row("Delivery address", `${esc(order.dest_street ?? "")}<br>${esc(order.dest_city ?? "")} ${esc(stateName(order.dest_state))} ${esc(order.dest_zip)}`)}
      ${row("Delivery contact", `${esc(order.dest_contact ?? "")}<br><span class="muted small">${esc(order.dest_phone ?? "")}</span>`)}
      ${row("Picked up at", order.picked_up_at ? when(order.picked_up_at) : "")}
      ${row("Pick up ETA", order.pickup_eta ? when(order.pickup_eta) : "")}
      ${row("Delivery ETA", order.delivery_eta ? when(order.delivery_eta) : "")}
      ${row("Delivered at", order.delivered_at ? when(order.delivered_at) : "")}
      ${row("Paid amount", order.paid_amount !== null ? money(order.paid_amount) : "")}
      ${row("Payment method", esc(order.payment_method ?? ""))}
      ${row("Ready date", esc(dateOnly(order.ready_date)))}
      ${row("Distance", order.distance_miles ? `${order.distance_miles.toLocaleString()} miles` : "")}
      ${row("Price", `<strong>${money(order.price)}</strong>`)}
      ${row("Carrier", order.carrier_name ? `${esc(order.carrier_name)}${carrierLine ? `<br><span class="muted small">${esc(carrierLine)}</span>` : ""}${driverLine ? `<br><span class="muted small">Driver: ${esc(driverLine)}</span>` : ""}` : "")}
      ${row("Customer notes", esc(order.notes ?? ""))}
  `;
}

function orderModal(order: OrderRow, photos: OrderPhotoRow[]): string {
  const anchor = `/admin/orders#order-${order.id}`;

  return `<div class="modal" id="order-${order.id}">
  <a class="modal-backdrop" href="#orders" aria-label="Close"></a>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="order-${order.id}-title">
    <div class="modal-head">
      <div>
        <p class="eyebrow">Order</p>
        <h2 id="order-${order.id}-title">${esc(order.number)} ${statusBadge(order.status)}</h2>
        <p class="muted small">Booked ${when(order.created_at)} · updated ${when(order.updated_at)}</p>
      </div>
      <a class="modal-close" href="#orders" aria-label="Close">×</a>
    </div>

    <table class="table detail-table"><tbody>${orderDetailRows(order)}</tbody></table>

    ${photos.length
      ? `<h3 class="section-title mt">Vehicle photos</h3>
    <div class="photo-grid">${photos
        .map(
          (photo) =>
            `<a href="/admin/order-photos/${photo.id}" target="_blank" rel="noopener"><img class="lead-photo" src="/admin/order-photos/${photo.id}" alt="Vehicle photo for ${esc(order.number)}" loading="lazy"></a>`,
        )
        .join("")}</div>`
      : ""}

    <h3 class="section-title mt">Change status</h3>
    <form method="post" action="/admin/orders/${order.id}/status" class="quote-form">
      <input type="hidden" name="next" value="${esc(anchor)}">
      ${statusFields(order)}
      <div class="status-actions">${ORDER_STATUSES.map(
    (value) => `<button class="chip${order.status === value ? " active" : ""}" type="submit" name="status" value="${value}">${esc(STATUS_LABELS[value])}</button>`,
  ).join("")}</div>
    </form>

    ${order.status === "quoted" || order.status === "cancelled" || order.status === "assigned" || order.status === "paid" ? "" : `    <h3 class="section-title mt">Assign carrier</h3>
    <form class="quote-form" method="post" action="/admin/orders/${order.id}/carrier">
      <input type="hidden" name="next" value="${esc(anchor)}">
      <div class="field-row">
        <label class="field"><span>Company</span><input name="carrier_name" required value="${esc(order.carrier_name ?? "")}"></label>
        <label class="field"><span>MC number</span><input name="carrier_mc" value="${esc(order.carrier_mc ?? "")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Company phone</span><input name="carrier_company_phone" value="${esc(order.carrier_company_phone ?? "")}"></label>
        <label class="field"><span>Company email</span><input name="carrier_email" type="email" value="${esc(order.carrier_email ?? "")}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Driver name</span><input name="driver_name" value="${esc(order.driver_name ?? "")}"></label>
        <label class="field"><span>Driver phone</span><input name="carrier_phone" value="${esc(order.carrier_phone ?? "")}"></label>
      </div>
      <button class="btn btn-accent" type="submit">Assign carrier</button>
    </form>`}

    <div class="modal-actions mt">
      <a class="btn btn-ghost" href="/admin/orders/${order.id}">Open full record</a>
      <a class="btn btn-ghost" href="/track/${esc(order.token)}">Customer view</a>
    </div>
  </div>
</div>`;
}

export function adminOrdersPage(
  orders: OrderRow[],
  status: string,
  isAdmin = false,
  photos: OrderPhotoRow[] = [],
  sort = "created",
  dir = "desc",
): string {
  const photosByOrder = new Map<number, OrderPhotoRow[]>();
  for (const photo of photos) {
    const list = photosByOrder.get(photo.order_id);
    if (list) list.push(photo);
    else photosByOrder.set(photo.order_id, [photo]);
  }

  const sortLink = (key: string, label: string) => {
    const active = sort === key;
    const nextDir = active && dir === "asc" ? "desc" : "asc";
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

  const rows = orders
    .map(
      (order) => `<tr>
      <td><a class="row-link" href="#order-${order.id}">${esc(order.number)}</a></td>
      <td>${esc(order.customer_name)}<br><span class="muted small">${esc(order.customer_phone)}</span></td>
      <td>${esc(order.origin_zip)} → ${esc(order.dest_zip)}<br><span class="muted small">${esc(order.transport_type)}</span></td>
      <td>${money(order.price)}</td>
      <td>${statusBadge(order.status)}</td>
      <td class="muted small">${when(order.created_at)}</td>
      <td class="muted">Details</td>
    </tr>`,
    )
    .join("");

  return layout({
    title: "Orders — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section" id="orders">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Orders</h1></div>
    <nav class="admin-nav">
      <a href="/admin/orders"${status === "all" ? ' class="active"' : ""}>Orders</a>${isAdmin ? '<a href="/admin/users">Staff</a>' : ""}<a href="/admin/account">Account</a>
    </nav>
  </div>
  <div class="filter-row">
    <a href="${filterHref("all")}"${status === "all" ? ' class="chip active"' : ' class="chip"'}>All</a>
    ${ORDER_STATUSES.map(
      (value) => `<a href="${filterHref(value)}"${status === value ? ' class="chip active"' : ' class="chip"'}>${esc(STATUS_LABELS[value])}</a>`,
    ).join("")}
  </div>
  ${orders.length === 0
        ? `<p class="muted">No orders in this view.</p>`
        : `<table class="table rows-clickable"><thead><tr>
      <th>${sortLink("order", "Order")}</th>
      <th>${sortLink("customer", "Customer")}</th>
      <th>${sortLink("route", "Route")}</th>
      <th>${sortLink("price", "Price")}</th>
      <th>${sortLink("status", "Status")}</th>
      <th>${sortLink("created", "Created")}</th>
      <th></th>
    </tr></thead><tbody>${rows}</tbody></table>`
      }
  ${orders.map((order) => orderModal(order, photosByOrder.get(order.id) ?? [])).join("")}
</section>`,
  });
}

export function adminOrderPage(
  order: OrderRow,
  events: OrderEventRow[],
  invoices: InvoiceRow[],
  baseUrl = "",
  photos: OrderPhotoRow[] = [],
): string {
  const eventRows = events
    .map(
      (event) => `<tr><td class="muted small">${when(event.created_at)}</td><td>${esc(event.kind === "requested" ? "Quoted" : event.kind === "in_transit" ? "Picked up" : isOrderStatus(event.kind) ? STATUS_LABELS[event.kind] : event.kind)}</td><td>${esc(event.note ?? "")}</td><td class="muted small">${esc(event.actor ?? "")}</td></tr>`,
    )
    .join("");

  const invoiceRows = invoices
    .map(
      (invoice) => `<tr>
      <td><a href="/admin/invoices/${invoice.id}">${esc(invoice.number)}</a></td>
      <td>${esc(invoice.description)}</td>
      <td>${money(invoice.amount)}</td>
      <td>${esc(invoice.status)}</td>
      <td class="muted small">${when(invoice.issued_at)}</td>
      <td>${invoice.status === "paid"
          ? ""
          : `<form method="post" action="/admin/invoices/${invoice.id}/paid"><button class="btn btn-ghost btn-small" type="submit">Mark paid</button></form>`
        }</td>
    </tr>`,
    )
    .join("");

  return layout({
    title: `${order.number} — Bond Auto Transport`,
    description: "Order detail.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div>
      <p class="eyebrow"><a href="/admin/orders">← All orders</a></p>
      <h1 class="page-title">${esc(order.number)} ${statusBadge(order.status)}</h1>
      <p class="muted small">Booked ${when(order.created_at)} · updated ${when(order.updated_at)}</p>
    </div>
    <div class="admin-user"><a class="btn btn-ghost" href="/track/${esc(order.token)}">Customer view</a></div>
  </div>

  <div class="card tracking-card">
    <h3>Tracking link</h3>
    <input class="copy-field" readonly value="${esc(baseUrl)}/track/${esc(order.token)}" onclick="this.select()">
    <p class="muted small">Send this to the customer. No password needed; it shows status, carrier and invoices only.</p>
  </div>

  <h2 class="section-title mt">Full record</h2>
  <table class="table detail-table">
    <tbody>${orderDetailRows(order)}</tbody>
  </table>

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
      <button class="btn btn-accent" type="submit">Save status</button>
    </form>

    ${order.status === "quoted" || order.status === "cancelled" || order.status === "assigned" || order.status === "paid" ? "" : `    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/carrier">
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
    </form>`}
  </div>

  <div class="cards two-up mt">
    <form class="card quote-form" method="post" action="/admin/orders/${order.id}/invoice">
      <h3>Create invoice</h3>
      <label class="field"><span>Description</span><input name="description" value="Vehicle transport ${esc(order.number)}"></label>
      <div class="field-row">
        <label class="field"><span>Amount (USD)</span><input name="amount" type="number" min="1" step="1" value="${order.price}" required></label>
        <label class="field"><span>Due date</span><input name="due_at" type="date"></label>
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
</section>`,
  });
}

export function invoicePage(invoice: InvoiceRow, order: OrderRow): string {
  return layout({
    title: `${invoice.number} — Bond Auto Transport`,
    description: `Invoice ${invoice.number}.`,
    body: `
<section class="wrap section prose">
  <div class="invoice-head">
    <div><p class="eyebrow">Invoice</p><h1 class="page-title">${esc(invoice.number)}</h1></div>
    <button class="btn btn-ghost no-print" onclick="window.print()">Print</button>
  </div>
  <p class="muted small">Issued ${when(invoice.issued_at)}${invoice.due_at ? ` · due ${dateOnly(invoice.due_at)}` : ""} · status ${esc(invoice.status)}</p>

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
      <td class="muted small">${user.last_login_at ? when(user.last_login_at) : "never"}</td>
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
    title: "Staff accounts — Bond Auto Transport",
    description: "Dispatch console.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Staff accounts</h1>
      <nav class="admin-nav">
        <a href="/admin/orders">Orders</a>
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
    title: "Your account — Bond Auto Transport",
    description: "Change your password.",
    body: `
<section class="wrap section narrow-wrap">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Your account</h1></div>
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
