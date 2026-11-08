export const ORDER_STATUSES = [
  "quoted",
  "confirmed",
  "assigned",
  "picked_up",
  "delivered",
  "paid",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  quoted: "Quoted",
  confirmed: "Confirmed",
  assigned: "Carrier assigned",
  picked_up: "Picked up",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Statuses a customer should see in the timeline, in order. */
export const CUSTOMER_STAGES: OrderStatus[] = ["quoted", "confirmed", "assigned", "picked_up", "delivered"];

export function orderNumber(id: number, year: number): string {
  return `CHS-${year}-${String(id).padStart(4, "0")}`;
}

export function invoiceNumber(id: number, year: number): string {
  return `INV-${year}-${String(id).padStart(4, "0")}`;
}

export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface NewOrder {
  leadId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  transportType: string;
  condition: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vin: string;
  originStreet: string;
  originCity: string;
  originState: string;
  originZip: string;
  originContact: string;
  originPhone: string;
  destStreet: string;
  destCity: string;
  destState: string;
  destZip: string;
  destContact: string;
  destPhone: string;
  readyDate: string;
  distanceMiles: number | null;
  price: number;
  notes: string;
}

export interface OrderRow {
  id: number;
  number: string;
  token: string;
  lead_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  transport_type: string;
  condition: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  origin_street: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string;
  origin_contact: string | null;
  origin_phone: string | null;
  dest_street: string | null;
  dest_city: string | null;
  dest_state: string | null;
  dest_zip: string;
  dest_contact: string | null;
  dest_phone: string | null;
  ready_date: string | null;
  distance_miles: number | null;
  price: number;
  status: string;
  carrier_name: string | null;
  carrier_mc: string | null;
  carrier_phone: string | null;
  carrier_company_phone: string | null;
  carrier_email: string | null;
  driver_name: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
  picked_up_at: number | null;
  pickup_eta: number | null;
  delivery_eta: number | null;
}

export interface OrderEventRow {
  id: number;
  order_id: number;
  kind: string;
  note: string | null;
  actor: string | null;
  created_at: number;
}

export interface InvoiceRow {
  id: number;
  order_id: number;
  number: string;
  description: string;
  amount: number;
  status: string;
  issued_at: number;
  due_at: number | null;
  paid_at: number | null;
  note: string | null;
}

export async function createOrder(db: D1Database, input: NewOrder): Promise<OrderRow> {
  const now = Date.now();
  const year = new Date(now).getUTCFullYear();

  const inserted = await db
    .prepare(
      `INSERT INTO orders
         (number, token, lead_id, customer_name, customer_email, customer_phone, transport_type, condition,
          vehicle_year, vehicle_make, vehicle_model, vin,
          origin_street, origin_city, origin_state, origin_zip, origin_contact, origin_phone,
          dest_street, dest_city, dest_state, dest_zip, dest_contact, dest_phone,
          ready_date, distance_miles, price, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
    )
    .bind(
      "pending",
      randomToken(),
      input.leadId,
      input.customerName,
      input.customerEmail,
      input.customerPhone,
      input.transportType,
      input.condition,
      input.vehicleYear || null,
      input.vehicleMake || null,
      input.vehicleModel || null,
      input.vin || null,
      input.originStreet || null,
      input.originCity || null,
      input.originState || null,
      input.originZip,
      input.originContact || null,
      input.originPhone || null,
      input.destStreet || null,
      input.destCity || null,
      input.destState || null,
      input.destZip,
      input.destContact || null,
      input.destPhone || null,
      input.readyDate || null,
      input.distanceMiles,
      input.price,
      input.notes || null,
      now,
      now,
    )
    .run();

  const id = Number(inserted.meta.last_row_id);
  const number = orderNumber(id, year);
  await db.prepare("UPDATE orders SET number = ? WHERE id = ?").bind(number, id).run();
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'created', ?, 'customer', ?)")
    .bind(id, "Booking request submitted.", now)
    .run();

  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) throw new Error("order insert failed");
  return order;
}

export async function setStatus(
  db: D1Database,
  orderId: number,
  status: OrderStatus,
  actor: string,
  note: string,
  pickedUpAt: number | null = null,
  pickupEta: number | null = null,
  deliveryEta: number | null = null,
): Promise<void> {
  const now = Date.now();
  const pickup = status === "picked_up" ? (pickedUpAt ?? now) : pickedUpAt;
  await db
    .prepare(
      `UPDATE orders
          SET status = ?, picked_up_at = COALESCE(?, picked_up_at),
              pickup_eta = COALESCE(?, pickup_eta), delivery_eta = COALESCE(?, delivery_eta),
              updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, pickup, pickupEta, deliveryEta, now, orderId)
    .run();
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(orderId, status, note || null, actor, now)
    .run();
}

export async function assignCarrier(
  db: D1Database,
  orderId: number,
  carrier: {
    name: string;
    mc: string;
    companyPhone: string;
    email: string;
    driverName: string;
    driverPhone: string;
  },
  actor: string,
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE orders
          SET carrier_name = ?, carrier_mc = ?, carrier_company_phone = ?, carrier_email = ?,
              driver_name = ?, carrier_phone = ?, status = 'assigned', updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      carrier.name,
      carrier.mc || null,
      carrier.companyPhone || null,
      carrier.email || null,
      carrier.driverName || null,
      carrier.driverPhone || null,
      now,
      orderId,
    )
    .run();
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'assigned', ?, ?, ?)")
    .bind(
      orderId,
      `${carrier.name}${carrier.mc ? ` (${carrier.mc})` : ""}${carrier.driverName ? ` · driver ${carrier.driverName}` : ""}`,
      actor,
      now,
    )
    .run();
}

export async function addNote(db: D1Database, orderId: number, note: string, actor: string): Promise<void> {
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'note', ?, ?, ?)")
    .bind(orderId, note, actor, Date.now())
    .run();
}

export async function createInvoice(
  db: D1Database,
  orderId: number,
  input: { description: string; amount: number; dueAt: number | null; note: string },
  actor: string,
): Promise<InvoiceRow> {
  const now = Date.now();
  const year = new Date(now).getUTCFullYear();
  const inserted = await db
    .prepare(
      `INSERT INTO invoices (order_id, number, description, amount, status, issued_at, due_at, note)
       VALUES (?, 'pending', ?, ?, 'issued', ?, ?, ?)`,
    )
    .bind(orderId, input.description, input.amount, now, input.dueAt, input.note || null)
    .run();

  const id = Number(inserted.meta.last_row_id);
  const number = invoiceNumber(id, year);
  await db.prepare("UPDATE invoices SET number = ? WHERE id = ?").bind(number, id).run();
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'invoiced', ?, ?, ?)")
    .bind(orderId, `${number} for $${input.amount.toLocaleString()}`, actor, now)
    .run();

  const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first<InvoiceRow>();
  if (!invoice) throw new Error("invoice insert failed");
  return invoice;
}

export async function markInvoicePaid(db: D1Database, invoiceId: number, actor: string): Promise<void> {
  const now = Date.now();
  const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(invoiceId).first<InvoiceRow>();
  if (!invoice || invoice.status === "paid") return;

  await db.prepare("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?").bind(now, invoiceId).run();
  await db
    .prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'paid', ?, ?, ?)")
    .bind(invoice.order_id, `${invoice.number} marked paid`, actor, now)
    .run();
}
