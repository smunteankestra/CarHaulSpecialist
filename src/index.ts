import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { SESSION_COOKIE, sessionMaxAge, signSession, timingSafeEqual, verifySession } from "./auth.ts";
import { isLeadStatus } from "./leads.ts";
import {
  addNote,
  assignCarrier,
  createInvoice,
  confirmOrder,
  createOrder,
  isOrderStatus,
  markInvoicePaid,
  STATUS_LABELS,
  setStatus,
  type InvoiceRow,
  type OrderEventRow,
  type OrderRow,
} from "./orders.ts";
import { conditionLabel, lookupZip, parseCondition, priceQuote, roadMiles, type TransportType } from "./quote.ts";
import { stateCode, stateName } from "./states.ts";
import {
  accountPage,
  adminOrderPage,
  adminOrdersPage,
  adminUsersPage,
  bookPage,
  invoicePage,
  trackPage,
  type BookValues,
  type OrderPhotoRow,
} from "./views-order.ts";
import {
  createUser,
  findUserByEmail,
  generatePassword,
  isRole,
  listUsers,
  setActive,
  setPassword,
  touchLogin,
  verifyPassword,
  type UserRow,
} from "./users.ts";
import {
  adminLoginPage,
  adminPage,
  contactPage,
  faqPage,
  homePage,
  howItWorksPage,
  legalPage,
  notFoundPage,
  pricingPage,
  quotePage,
  servicePage,
  when,
  type LeadPhotoRow,
  type LeadRow,
  type QuoteFormValues,
} from "./views.ts";

interface Bindings {
  DB: D1Database;
  UPLOADS: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

async function sendTelegram(env: Bindings, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true }),
  });
}

function notify(
  c: { env: Bindings; executionCtx?: { waitUntil: (promise: Promise<unknown>) => void } },
  text: string,
): void {
  const promise = sendTelegram(c.env, text).catch(() => {});
  try {
    c.executionCtx?.waitUntil(promise);
  } catch {
    // Local dev may not expose executionCtx; the notification is best-effort.
  }
}

const app = new Hono<{ Bindings: Bindings }>();

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const ZIP_PATTERN = /^\d{5}$/;
const PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function photoExtension(photo: File): string | null {
  const byType = PHOTO_TYPES.get(photo.type);
  if (byType) return byType;
  const name = photo.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".heic")) return "heic";
  if (name.endsWith(".heif")) return "heif";
  return null;
}

function photoContentType(photo: File, extension: string): string {
  if (photo.type) return photo.type;
  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}
const MAX_PHOTOS = 5;

app.get("/", (c) => c.html(homePage()));

app.get("/quote", (c) => c.html(quotePage({ values: {} })));

/** Accept only a valid date today or later. */
function futureDate(value: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= today ? value : "";
}

app.post("/quote", async (c) => {
  const form = await c.req.formData();
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const values: QuoteFormValues = {
    name: field("name"),
    email: field("email"),
    phone: field("phone"),
    origin_zip: field("origin_zip"),
    dest_zip: field("dest_zip"),
    transport_type: field("transport_type") || "open",
    vehicle_year: field("vehicle_year"),
    vehicle_make: field("vehicle_make"),
    vehicle_model: field("vehicle_model"),
    condition: field("condition") || "running",
    available_date: field("available_date"),
    notes: field("notes"),
  };

  values.available_date = futureDate(values.available_date);

  const invalid = (message: string) => c.html(quotePage({ values, error: message }), 400);

  if (!values.name || !values.email || !values.phone) return invalid("Name, email and phone are required.");
  if (!EMAIL_PATTERN.test(values.email)) return invalid("That email does not look right.");
  if (!ZIP_PATTERN.test(values.origin_zip ?? "")) return invalid("Pickup ZIP must be five digits.");
  if (!ZIP_PATTERN.test(values.dest_zip ?? "")) return invalid("Delivery ZIP must be five digits.");

  const photos = form
    .getAll("photo")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (photos.length > MAX_PHOTOS) return invalid(`Add up to ${MAX_PHOTOS} photos.`);
  for (const photo of photos) {
    if (!photoExtension(photo)) return invalid("Upload JPEG, PNG, WebP or HEIC photos.");
    if (photo.size > MAX_PHOTO_BYTES) return invalid("Each photo must be 10 MB or smaller.");
  }

  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition = parseCondition(values.condition ?? "running");

  const [origin, destination] = await Promise.all([
    lookupZip(values.origin_zip ?? ""),
    lookupZip(values.dest_zip ?? ""),
  ]);

  const distance = origin && destination ? roadMiles(origin, destination) : null;
  const breakdown = distance === null ? null : priceQuote(distance, transport, condition, false);

  const stored: string[] = [];
  for (const photo of photos) {
    const key = `leads/${crypto.randomUUID()}.${PHOTO_TYPES.get(photo.type) ?? "jpg"}`;
    await c.env.UPLOADS.put(key, await photo.arrayBuffer(), {
      metadata: { contentType: photo.type },
    });
    stored.push(key);
  }

  let leadId: number | null = null;
  const leadStatus = breakdown ? "quote_sent" : "new";

  try {
    const inserted = await c.env.DB.prepare(
      `INSERT INTO leads
         (name, email, phone, origin_zip, origin_city, origin_state, dest_zip, dest_city, dest_state,
          transport_type, vehicle_year, vehicle_make, vehicle_model, condition, available_date,
          distance_miles, price_estimate, price_is_estimate, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
      .bind(
        values.name,
        values.email,
        values.phone,
        values.origin_zip,
        origin?.city ?? null,
        origin?.state ?? null,
        values.dest_zip,
        destination?.city ?? null,
        destination?.state ?? null,
        transport,
        values.vehicle_year || null,
        values.vehicle_make || null,
        values.vehicle_model || null,
        condition,
        values.available_date || null,
        distance,
        breakdown?.total ?? null,
        values.notes || null,
        leadStatus,
        Date.now(),
      )
      .run();

    const newLeadId = Number(inserted.meta.last_row_id);
    leadId = newLeadId;

    if (stored.length) {
      const now = Date.now();
      await c.env.DB.batch(
        stored.map((key) =>
          c.env.DB.prepare("INSERT INTO lead_photos (lead_id, photo_key, created_at) VALUES (?, ?, ?)").bind(
            newLeadId,
            key,
            now,
          ),
        ),
      );
    }
  } catch (error) {
    if (leadId !== null) {
      await c.env.DB.prepare("DELETE FROM leads WHERE id = ?").bind(leadId).run();
    }
    await Promise.all(stored.map((key) => c.env.UPLOADS.delete(key)));
    throw error;
  }

  if (!breakdown || !origin || !destination || distance === null) {
    notify(
      c,
      `New quote request (needs pricing)\n${values.name} · ${values.phone}\n${values.origin_zip} → ${values.dest_zip}\n${new URL(c.req.url).origin}${leadId ? `/admin#quote-${leadId}` : "/admin"}`,
    );
    return c.html(
      quotePage({
        values,
        error: "We could not price that route automatically. Dispatch will follow up with a number.",
      }),
    );
  }

  const quoteOrder = await createOrder(
    c.env.DB,
    {
      leadId,
      customerName: values.name,
      customerEmail: values.email,
      customerPhone: values.phone,
      transportType: transport,
      condition,
      vehicleYear: values.vehicle_year ?? "",
      vehicleMake: values.vehicle_make ?? "",
      vehicleModel: values.vehicle_model ?? "",
      vin: "",
      originStreet: "",
      originCity: origin.city,
      originState: origin.state,
      originZip: values.origin_zip ?? "",
      originContact: "",
      originPhone: "",
      destStreet: "",
      destCity: destination.city,
      destState: destination.state,
      destZip: values.dest_zip ?? "",
      destContact: "",
      destPhone: "",
      readyDate: values.available_date ?? "",
      distanceMiles: distance,
      price: breakdown.total,
      notes: values.notes ?? "",
    },
    "quoted",
  );

  notify(
    c,
    `New quote\n${values.name} · ${values.phone}\n${origin.city}, ${stateName(origin.state)} → ${destination.city}, ${stateName(destination.state)}\n${distance.toLocaleString()} mi · ${transport} · $${breakdown.total.toLocaleString()}\n${new URL(c.req.url).origin}/admin/orders#order-${quoteOrder.id}`,
  );

  return c.html(
    quotePage({
      values,
      leadId: leadId ?? undefined,
      orderToken: quoteOrder.token,
      result: {
        origin: `${origin.city}, ${stateName(origin.state)}`,
        destination: `${destination.city}, ${stateName(destination.state)}`,
        distance,
        transport: transport === "enclosed" ? "Enclosed trailer" : "Open trailer",
        total: breakdown.total,
        deposit: breakdown.deposit,
        breakdown: breakdown.base.toLocaleString(),
        estimated: false,
      },
    }),
  );
});

function bookValuesFrom(body: FormData | Record<string, unknown>): BookValues {
  const pick = (key: keyof BookValues) =>
    String(body instanceof FormData ? (body.get(key) ?? "") : (body[key] ?? "")).trim();
  return {
    name: pick("name"),
    email: pick("email"),
    phone: pick("phone"),
    vin: pick("vin"),
    origin_street: pick("origin_street"),
    origin_city: pick("origin_city"),
    origin_state: pick("origin_state"),
    origin_zip: pick("origin_zip"),
    origin_contact: pick("origin_contact"),
    origin_phone: pick("origin_phone"),
    dest_street: pick("dest_street"),
    dest_city: pick("dest_city"),
    dest_state: pick("dest_state"),
    dest_zip: pick("dest_zip"),
    dest_contact: pick("dest_contact"),
    dest_phone: pick("dest_phone"),
    vehicle_year: pick("vehicle_year"),
    vehicle_make: pick("vehicle_make"),
    vehicle_model: pick("vehicle_model"),
    transport_type: pick("transport_type") || "open",
    condition: pick("condition") || "running",
    ready_date:
      pick("ready_date") ||
      String(body instanceof FormData ? (body.get("available_date") ?? "") : (body.available_date ?? "")).trim(),
    notes: pick("notes"),
    lead_id: pick("lead_id"),
    order_token: pick("order_token"),
  };
}

async function priceFor(values: BookValues): Promise<{ distance: number | null; price: number | null }> {
  const [origin, destination] = await Promise.all([lookupZip(values.origin_zip ?? ""), lookupZip(values.dest_zip ?? "")]);
  if (!origin || !destination) return { distance: null, price: null };
  const distance = roadMiles(origin, destination);
  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition = parseCondition(values.condition ?? "running");
  return { distance, price: priceQuote(distance, transport, condition, false).total };
}

app.get("/book", (c) => c.html(bookPage({}, null)));

app.post("/book", async (c) => {
  const values = bookValuesFrom(await c.req.formData());
  values.ready_date = futureDate(values.ready_date);
  const { price } = await priceFor(values);
  return c.html(bookPage(values, price));
});

app.post("/book/submit", async (c) => {
  const form = await c.req.formData();
  const values = bookValuesFrom(form);
  values.ready_date = futureDate(values.ready_date);
  const invalid = (message: string) => c.html(bookPage(values, null, message), 400);

  if (!values.name || !values.email || !values.phone) return invalid("Name, email and phone are required.");
  if (!EMAIL_PATTERN.test(values.email)) return invalid("That email does not look right.");
  if (!ZIP_PATTERN.test(values.origin_zip ?? "") || !ZIP_PATTERN.test(values.dest_zip ?? "")) {
    return invalid("Both ZIP codes must be five digits.");
  }
  if (!values.origin_contact || !values.origin_phone || !values.dest_contact || !values.dest_phone) {
    return invalid("A contact name and phone are required at both ends.");
  }

  const photos = form.getAll("photo").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (photos.length > MAX_PHOTOS) return invalid(`Add up to ${MAX_PHOTOS} photos.`);
  for (const photo of photos) {
    if (!photoExtension(photo)) return invalid("Upload JPEG, PNG, WebP or HEIC photos.");
    if (photo.size > MAX_PHOTO_BYTES) return invalid("Each photo must be 10 MB or smaller.");
  }

  const { distance, price } = await priceFor(values);
  if (price === null || distance === null) {
    return invalid("We could not price that route automatically. Call dispatch and we will book it by hand.");
  }

  const leadId = values.lead_id ? Number(values.lead_id) : null;
  const orderInput = {
    leadId,
    customerName: values.name,
    customerEmail: values.email,
    customerPhone: values.phone,
    transportType: values.transport_type === "enclosed" ? "enclosed" : "open",
    condition: parseCondition(values.condition ?? "running"),
    vehicleYear: values.vehicle_year ?? "",
    vehicleMake: values.vehicle_make ?? "",
    vehicleModel: values.vehicle_model ?? "",
    vin: values.vin ?? "",
    originStreet: values.origin_street ?? "",
    originCity: values.origin_city ?? "",
    originState: stateCode(values.origin_state ?? ""),
    originZip: values.origin_zip ?? "",
    originContact: values.origin_contact ?? "",
    originPhone: values.origin_phone ?? "",
    destStreet: values.dest_street ?? "",
    destCity: values.dest_city ?? "",
    destState: stateCode(values.dest_state ?? ""),
    destZip: values.dest_zip ?? "",
    destContact: values.dest_contact ?? "",
    destPhone: values.dest_phone ?? "",
    readyDate: values.ready_date ?? "",
    distanceMiles: distance,
    price,
    notes: values.notes ?? "",
  };

  const quotedOrder = values.order_token
    ? await c.env.DB.prepare("SELECT * FROM orders WHERE token = ?").bind(values.order_token).first<OrderRow>()
    : null;

  const order =
    quotedOrder && quotedOrder.status === "quoted"
      ? await confirmOrder(c.env.DB, quotedOrder.id, orderInput, "customer")
      : quotedOrder ?? (await createOrder(c.env.DB, orderInput));

  if (photos.length) {
    const stored: string[] = [];
    for (const photo of photos) {
      const extension = photoExtension(photo) ?? "jpg";
      const key = `orders/${crypto.randomUUID()}.${extension}`;
      await c.env.UPLOADS.put(key, await photo.arrayBuffer(), {
        metadata: { contentType: photoContentType(photo, extension) },
      });
      stored.push(key);
    }
    try {
      const now = Date.now();
      await c.env.DB.batch(
        stored.map((key) =>
          c.env.DB.prepare("INSERT INTO order_photos (order_id, photo_key, created_at) VALUES (?, ?, ?)").bind(
            order.id,
            key,
            now,
          ),
        ),
      );
    } catch (error) {
      await Promise.all(stored.map((key) => c.env.UPLOADS.delete(key)));
      throw error;
    }
  }

  if (leadId) {
    await c.env.DB.prepare(
      `UPDATE leads
          SET name = ?, email = ?, phone = ?,
              origin_zip = ?, origin_city = COALESCE(NULLIF(?, ''), origin_city),
              origin_state = COALESCE(NULLIF(?, ''), origin_state),
              dest_zip = ?, dest_city = COALESCE(NULLIF(?, ''), dest_city),
              dest_state = COALESCE(NULLIF(?, ''), dest_state),
              transport_type = ?, vehicle_year = COALESCE(NULLIF(?, ''), vehicle_year),
              vehicle_make = COALESCE(NULLIF(?, ''), vehicle_make),
              vehicle_model = COALESCE(NULLIF(?, ''), vehicle_model),
              condition = ?, available_date = COALESCE(NULLIF(?, ''), available_date),
              distance_miles = ?, price_estimate = ?, price_is_estimate = 0,
              notes = COALESCE(NULLIF(?, ''), notes), status = 'confirmed'
        WHERE id = ?`,
    )
      .bind(
        values.name,
        values.email,
        values.phone,
        values.origin_zip ?? "",
        values.origin_city ?? "",
        stateCode(values.origin_state ?? ""),
        values.dest_zip ?? "",
        values.dest_city ?? "",
        stateCode(values.dest_state ?? ""),
        values.transport_type === "enclosed" ? "enclosed" : "open",
        values.vehicle_year ?? "",
        values.vehicle_make ?? "",
        values.vehicle_model ?? "",
        parseCondition(values.condition ?? "running"),
        values.ready_date ?? "",
        distance,
        price,
        values.notes ?? "",
        leadId,
      )
      .run();
  }

  notify(
    c,
    `${quotedOrder ? "Order confirmed" : "New order"}\n${order.number} · ${order.customer_name}\n${order.origin_zip} → ${order.dest_zip}\n$${order.price.toLocaleString()}\n${new URL(c.req.url).origin}/admin/orders#order-${order.id}`,
  );

  return c.redirect(`/track/${order.token}?new=1`, 303);
});

app.get("/track/:token", async (c) => {
  const token = c.req.param("token");
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE token = ?").bind(token).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const [{ results: events }, { results: invoices }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").bind(order.id).all<OrderEventRow>(),
    c.env.DB.prepare("SELECT * FROM invoices WHERE order_id = ? AND status != 'void' ORDER BY id").bind(order.id).all<InvoiceRow>(),
  ]);

  return c.html(trackPage(order, events, invoices));
});

app.get("/services/:slug", (c) => {
  const page = servicePage(c.req.param("slug"));
  return page ? c.html(page) : c.html(notFoundPage(), 404);
});

app.get("/how-it-works", (c) => c.html(howItWorksPage()));
app.get("/pricing", (c) => c.html(pricingPage()));
app.get("/faq", (c) => c.html(faqPage()));
app.get("/contact", (c) => c.html(contactPage()));
app.get("/terms", (c) => c.html(legalPage("terms")));
app.get("/privacy", (c) => c.html(legalPage("privacy")));

async function sessionUser(c: {
  env: Bindings;
  req: { header: (name: string) => string | undefined };
  get?: unknown;
}): Promise<UserRow | null> {
  const email = await verifySession(c.env.SESSION_SECRET, getCookie(c as never, SESSION_COOKIE));
  if (!email) return null;
  const user = await findUserByEmail(c.env.DB, email);
  if (!user || !user.active) return null;
  return user;
}

app.post("/api/chat", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ ok: false, error: "Invalid request." }, 400);

  const data = body as Record<string, unknown>;
  if (String(data.website ?? "").trim()) return c.json({ ok: true });

  const name = String(data.name ?? "").trim().slice(0, 100);
  const contact = String(data.contact ?? "").trim().slice(0, 200);
  const message = String(data.message ?? "").trim().slice(0, 2000);
  const page = String(data.page ?? "").trim().slice(0, 300);
  if (!name || !message) return c.json({ ok: false, error: "Name and message are required." }, 400);

  const now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO chat_messages (name, contact, message, page, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(name, contact || null, message, page || null, now)
    .run();

  const token = c.env.TELEGRAM_BOT_TOKEN;
  const chatId = c.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text = `New website chat\nName: ${name}\nContact: ${contact || "—"}\nPage: ${page || "—"}\n\n${message}`;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!response.ok) {
      return c.json({ ok: false, error: "Could not send the message right now. Please call us." }, 502);
    }
  }

  return c.json({ ok: true });
});

app.get("/admin/login", (c) => c.html(adminLoginPage()));

app.post("/admin/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  let user = await findUserByEmail(c.env.DB, email);
  let authenticated = Boolean(user && user.active && (await verifyPassword(password, user)));

  // Bootstrap: the env credentials create the first admin account, then step aside.
  if (!authenticated && !user) {
    const expectedEmail = (c.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const expectedPassword = c.env.ADMIN_PASSWORD ?? "";
    if (expectedEmail && expectedPassword && email === expectedEmail && timingSafeEqual(password, expectedPassword)) {
      user = await createUser(c.env.DB, { email, name: "Dispatch", role: "admin", password });
      authenticated = true;
    }
  }

  if (!authenticated || !user) {
    return c.html(adminLoginPage("Wrong email or password."), 401);
  }

  await touchLogin(c.env.DB, user.id);
  const token = await signSession(c.env.SESSION_SECRET, user.email);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: sessionMaxAge,
    secure: new URL(c.req.url).protocol === "https:",
  });
  return c.redirect("/admin/orders", 303);
});

app.post("/admin/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/admin/login", 303);
});

app.get("/admin", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM leads ORDER BY id DESC LIMIT 100",
  ).all<LeadRow>();

  const photos = results.length
    ? (
      await c.env.DB.prepare(
        `SELECT * FROM lead_photos WHERE lead_id IN (${results.map(() => "?").join(",")}) ORDER BY id`,
      )
        .bind(...results.map((lead) => lead.id))
        .all<LeadPhotoRow>()
    ).results
    : [];

  return c.html(adminPage(results, user.email, user.role === "admin", photos));
});

/** Keep modal redirects inside the console; anything else falls back to the record page. */
function adminRedirect(body: Record<string, unknown>, fallback: string): string {
  const next = String(body.next ?? "");
  return next === "/admin" || next.startsWith("/admin/") ? next : fallback;
}

/** Combine a date plus 12-hour time fields into a UTC timestamp. */
function parseDateTime(body: Record<string, string | File>, prefix: string): number | null {
  const month = Number(body[`${prefix}_month`] ?? "");
  const day = Number(body[`${prefix}_day`] ?? "");
  const year = Number(body[`${prefix}_year`] ?? "");
  const hour = Number(body[`${prefix}_hour`] ?? "");
  const minute = Number(body[`${prefix}_minute`] ?? "");
  const ampm = String(body[`${prefix}_ampm`] ?? "").toUpperCase();
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59 ||
    (ampm !== "AM" && ampm !== "PM")
  ) {
    return null;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  const stamp = Date.UTC(year, month - 1, safeDay, (hour % 12) + (ampm === "PM" ? 12 : 0), minute);
  return Number.isFinite(stamp) ? stamp : null;
}

app.post("/admin/leads/:id/status", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const status = String(body.status ?? "");
  if (isLeadStatus(status)) {
    await c.env.DB.prepare("UPDATE leads SET status = ? WHERE id = ?").bind(status, id).run();
  }
  return c.redirect(`/admin#quote-${id}`, 303);
});

app.post("/admin/leads/:id/fees", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const fee = (name: string) => {
    const raw = String(body[name] ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  };

  await c.env.DB.prepare("UPDATE leads SET broker_fee = ?, carrier_fee = ? WHERE id = ?")
    .bind(fee("broker_fee"), fee("carrier_fee"), id)
    .run();
  return c.redirect(`/admin#quote-${id}`, 303);
});

app.get("/admin/photos/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const photo = await c.env.DB.prepare("SELECT photo_key FROM lead_photos WHERE id = ?")
    .bind(id)
    .first<{ photo_key: string }>();
  if (!photo) return c.notFound();

  const object = await c.env.UPLOADS.getWithMetadata<{ contentType?: string }>(photo.photo_key, "arrayBuffer");
  if (!object.value) return c.notFound();

  return new Response(object.value, {
    headers: {
      "content-type": object.metadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
});

app.get("/admin/order-photos/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const photo = await c.env.DB.prepare("SELECT photo_key FROM order_photos WHERE id = ?")
    .bind(id)
    .first<{ photo_key: string }>();
  if (!photo) return c.notFound();

  const object = await c.env.UPLOADS.getWithMetadata<{ contentType?: string }>(photo.photo_key, "arrayBuffer");
  if (!object.value) return c.notFound();

  return new Response(object.value, {
    headers: {
      "content-type": object.metadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
});

const ORDER_SORTS: Record<string, string> = {
  order: "number",
  customer: "customer_name",
  route: "origin_zip",
  price: "price",
  status: `CASE status
    WHEN 'quoted' THEN 1
    WHEN 'confirmed' THEN 2
    WHEN 'assigned' THEN 3
    WHEN 'picked_up' THEN 4
    WHEN 'delivered' THEN 5
    WHEN 'paid' THEN 6
    WHEN 'cancelled' THEN 7
    ELSE 8
  END`,
  created: "created_at",
};

app.get("/admin/orders", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const status = c.req.query("status") ?? "all";
  const sort = c.req.query("sort") ?? "created";
  const dir = c.req.query("dir") === "asc" ? "asc" : "desc";
  const filtered = status !== "all" && isOrderStatus(status);
  const direction = dir === "asc" ? "ASC" : "DESC";
  const orderBy =
    sort === "route"
      ? `origin_zip ${direction}, dest_zip ${direction}`
      : `${ORDER_SORTS[sort] ?? "created_at"} ${direction}`;
  const statement = filtered
    ? c.env.DB.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY ${orderBy} LIMIT 200`).bind(status)
    : c.env.DB.prepare(`SELECT * FROM orders ORDER BY ${orderBy} LIMIT 200`);
  const { results } = await statement.all<OrderRow>();

  const photos = results.length
    ? (
        await c.env.DB.prepare(
          `SELECT * FROM order_photos WHERE order_id IN (${results.map(() => "?").join(",")}) ORDER BY id`,
        )
          .bind(...results.map((order) => order.id))
          .all<OrderPhotoRow>()
      ).results
    : [];

  const events = results.length
    ? (
        await c.env.DB.prepare(
          `SELECT * FROM order_events WHERE order_id IN (${results.map(() => "?").join(",")}) ORDER BY id`,
        )
          .bind(...results.map((order) => order.id))
          .all<OrderEventRow>()
      ).results
    : [];

  const { results: countRows } = await c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all<{
    status: string;
    n: number;
  }>();
  const counts: Record<string, number> = {};
  for (const row of countRows) counts[row.status] = row.n;

  return c.html(adminOrdersPage(results, status, user.role === "admin", photos, sort, dir, events, counts));
});

app.get("/admin/orders/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const [{ results: events }, { results: invoices }, { results: photos }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").bind(id).all<OrderEventRow>(),
    c.env.DB.prepare("SELECT * FROM invoices WHERE order_id = ? ORDER BY id DESC").bind(id).all<InvoiceRow>(),
    c.env.DB.prepare("SELECT * FROM order_photos WHERE order_id = ? ORDER BY id").bind(id).all<OrderPhotoRow>(),
  ]);

  return c.html(adminOrderPage(order, events, invoices, new URL(c.req.url).origin, photos));
});

app.post("/admin/orders/:id/status", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const status = String(body.status ?? "");
  if (!isOrderStatus(status)) return c.redirect(`/admin/orders/${id}`, 303);

  const pickedUpAt = parseDateTime(body, "picked_up");
  const pickupEta = parseDateTime(body, "pickup_eta");
  const deliveryEta = parseDateTime(body, "delivery_eta");
  const deliveredAt = parseDateTime(body, "delivered");
  const paidRaw = String(body.paid_amount ?? "").trim();
  const paidNumber = paidRaw ? Number(paidRaw) : NaN;
  const paidAmount = Number.isFinite(paidNumber) && paidNumber >= 0 ? Math.round(paidNumber) : null;
  const paymentMethodRaw = String(body.payment_method ?? "").trim();
  const paymentMethod = ["Zelle", "Venmo", "CashApp", "PayPal", "Check", "ACH", "Wire"].includes(paymentMethodRaw)
    ? paymentMethodRaw
    : null;
  const note = String(body.note ?? "").trim();
  const pickupNote = pickedUpAt ? `Picked up ${when(pickedUpAt)}` : "";
  const etaNote = pickupEta ? `Pickup ETA ${when(pickupEta)}` : "";
  const deliveryNote = deliveryEta ? `Delivery ETA ${when(deliveryEta)}` : "";
  const deliveredNote = deliveredAt ? `Delivered ${when(deliveredAt)}` : "";
  const paidNote = paidAmount !== null ? `Paid $${paidAmount.toLocaleString()}${paymentMethod ? ` via ${paymentMethod}` : ""}` : "";
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();

  await setStatus(
    c.env.DB,
    id,
    status,
    user.email,
    [note, pickupNote, etaNote, deliveryNote, deliveredNote, paidNote].filter(Boolean).join(" · "),
    pickedUpAt,
    pickupEta,
    deliveryEta,
    deliveredAt,
    paidAmount,
    paymentMethod,
  );
  if (order) {
    const fromLabel = isOrderStatus(order.status) ? STATUS_LABELS[order.status] : order.status;
    notify(
      c,
      `Order ${order.number} status\n${fromLabel} → ${STATUS_LABELS[status]}\nby ${user.email}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
    );
  }
  return c.redirect(adminRedirect(body, `/admin/orders/${id}`), 303);
});

app.post("/admin/orders/:id/edit", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const old = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!old) return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const text = (key: string) => String(body[key] ?? "").trim();
  const next = text("next");
  const redirectTo = next.startsWith("/admin/orders") ? next : `/admin/orders/${id}`;

  const name = text("customer_name");
  const email = text("customer_email");
  const phone = text("customer_phone");
  const originZip = text("origin_zip");
  const destZip = text("dest_zip");
  if (!name || !email || !phone || !EMAIL_PATTERN.test(email)) return c.redirect(redirectTo, 303);
  if (!ZIP_PATTERN.test(originZip) || !ZIP_PATTERN.test(destZip)) return c.redirect(redirectTo, 303);

  const distance = Number(text("distance_miles"));
  const price = Number(text("price"));
  const paidRaw = text("paid_amount");
  const paidNumber = paidRaw ? Number(paidRaw) : NaN;
  const paidAmount = Number.isFinite(paidNumber) && paidNumber >= 0 ? Math.round(paidNumber) : null;
  const methodRaw = text("payment_method");
  const paymentMethod = ["Zelle", "Venmo", "CashApp", "PayPal", "Check", "ACH", "Wire"].includes(methodRaw)
    ? methodRaw
    : null;

  const newValues = {
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    vehicle_year: text("vehicle_year") || null,
    vehicle_make: text("vehicle_make") || null,
    vehicle_model: text("vehicle_model") || null,
    transport_type: text("transport_type") === "enclosed" ? "enclosed" : "open",
    condition: parseCondition(text("condition") || "running"),
    vin: text("vin") || null,
    origin_street: text("origin_street") || null,
    origin_city: text("origin_city") || null,
    origin_state: stateCode(text("origin_state")) || null,
    origin_zip: originZip,
    origin_contact: text("origin_contact") || null,
    origin_phone: text("origin_phone") || null,
    dest_street: text("dest_street") || null,
    dest_city: text("dest_city") || null,
    dest_state: stateCode(text("dest_state")) || null,
    dest_zip: destZip,
    dest_contact: text("dest_contact") || null,
    dest_phone: text("dest_phone") || null,
    ready_date: /^\d{4}-\d{2}-\d{2}$/.test(text("ready_date")) ? text("ready_date") : null,
    distance_miles: Number.isFinite(distance) && distance >= 0 ? Math.round(distance) : old.distance_miles,
    price: Number.isFinite(price) && price >= 0 ? Math.round(price) : old.price,
    notes: text("notes") || null,
    carrier_name: text("carrier_name") || null,
    carrier_mc: text("carrier_mc") || null,
    carrier_company_phone: text("carrier_company_phone") || null,
    carrier_email: text("carrier_email") || null,
    driver_name: text("driver_name") || null,
    carrier_phone: text("carrier_phone") || null,
    paid_amount: paidAmount,
    payment_method: paymentMethod,
    picked_up_at: parseDateTime(body, "edit_picked_up") ?? old.picked_up_at,
    pickup_eta: parseDateTime(body, "edit_pickup_eta") ?? old.pickup_eta,
    delivery_eta: parseDateTime(body, "edit_delivery_eta") ?? old.delivery_eta,
    delivered_at: parseDateTime(body, "edit_delivered") ?? old.delivered_at,
  };

  const labels: Record<keyof typeof newValues, string> = {
    customer_name: "Customer",
    customer_email: "Email",
    customer_phone: "Phone",
    vehicle_year: "Vehicle year",
    vehicle_make: "Make",
    vehicle_model: "Model",
    transport_type: "Transport",
    condition: "Condition",
    vin: "VIN",
    origin_street: "Pickup street",
    origin_city: "Pickup city",
    origin_state: "Pickup state",
    origin_zip: "Pickup ZIP",
    origin_contact: "Pickup contact",
    origin_phone: "Pickup phone",
    dest_street: "Delivery street",
    dest_city: "Delivery city",
    dest_state: "Delivery state",
    dest_zip: "Delivery ZIP",
    dest_contact: "Delivery contact",
    dest_phone: "Delivery phone",
    ready_date: "Ready date",
    distance_miles: "Distance",
    price: "Price",
    notes: "Customer notes",
    carrier_name: "Carrier company",
    carrier_mc: "MC number",
    carrier_company_phone: "Company phone",
    carrier_email: "Company email",
    driver_name: "Driver name",
    carrier_phone: "Driver phone",
    paid_amount: "Paid amount",
    payment_method: "Payment method",
    picked_up_at: "Picked up at",
    pickup_eta: "Pickup ETA",
    delivery_eta: "Delivery ETA",
    delivered_at: "Delivered at",
  };

  const format = (key: keyof typeof newValues, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (key === "condition") return conditionLabel(String(value));
    if (key === "transport_type") return value === "enclosed" ? "Enclosed trailer" : "Open trailer";
    if (key === "distance_miles") return `${Number(value).toLocaleString()} mi`;
    if (key === "price" || key === "paid_amount") return `$${Number(value).toLocaleString()}`;
    if (key === "picked_up_at" || key === "pickup_eta" || key === "delivery_eta" || key === "delivered_at") {
      return when(Number(value));
    }
    return String(value);
  };

  const changes: string[] = [];
  const oldRecord = old as unknown as Record<string, unknown>;
  for (const key of Object.keys(newValues) as (keyof typeof newValues)[]) {
    let before = oldRecord[key];
    if (key === "condition") before = parseCondition(String(before ?? "running"));
    const after = newValues[key];
    if (String(before ?? "") !== String(after ?? "")) {
      changes.push(`${labels[key]}: ${format(key, before)} → ${format(key, after)}`);
    }
  }

  if (!changes.length) return c.redirect(redirectTo, 303);

  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE orders SET
      customer_name=?, customer_email=?, customer_phone=?,
      vehicle_year=?, vehicle_make=?, vehicle_model=?, transport_type=?, condition=?, vin=?,
      origin_street=?, origin_city=?, origin_state=?, origin_zip=?, origin_contact=?, origin_phone=?,
      dest_street=?, dest_city=?, dest_state=?, dest_zip=?, dest_contact=?, dest_phone=?,
      ready_date=?, distance_miles=?, price=?, notes=?,
      carrier_name=?, carrier_mc=?, carrier_company_phone=?, carrier_email=?, driver_name=?, carrier_phone=?,
      paid_amount=?, payment_method=?, picked_up_at=?, pickup_eta=?, delivery_eta=?, delivered_at=?,
      updated_at=?
     WHERE id=?`,
  )
    .bind(
      newValues.customer_name,
      newValues.customer_email,
      newValues.customer_phone,
      newValues.vehicle_year,
      newValues.vehicle_make,
      newValues.vehicle_model,
      newValues.transport_type,
      newValues.condition,
      newValues.vin,
      newValues.origin_street,
      newValues.origin_city,
      newValues.origin_state,
      newValues.origin_zip,
      newValues.origin_contact,
      newValues.origin_phone,
      newValues.dest_street,
      newValues.dest_city,
      newValues.dest_state,
      newValues.dest_zip,
      newValues.dest_contact,
      newValues.dest_phone,
      newValues.ready_date,
      newValues.distance_miles,
      newValues.price,
      newValues.notes,
      newValues.carrier_name,
      newValues.carrier_mc,
      newValues.carrier_company_phone,
      newValues.carrier_email,
      newValues.driver_name,
      newValues.carrier_phone,
      newValues.paid_amount,
      newValues.payment_method,
      newValues.picked_up_at,
      newValues.pickup_eta,
      newValues.delivery_eta,
      newValues.delivered_at,
      now,
      id,
    )
    .run();

  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)",
  )
    .bind(id, changes.join("; "), user.email, now)
    .run();

  notify(
    c,
    `Order ${old.number} edited\nby ${user.email}\n${changes.join("; ")}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
  );

  return c.redirect(redirectTo, 303);
});

app.post("/admin/orders/:id/carrier", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const name = String(body.carrier_name ?? "").trim();
  const mc = String(body.carrier_mc ?? "").trim();
  if (!name) return c.redirect(`/admin/orders/${id}`, 303);

  await assignCarrier(
    c.env.DB,
    id,
    {
      name,
      mc,
      companyPhone: String(body.carrier_company_phone ?? "").trim(),
      email: String(body.carrier_email ?? "").trim(),
      driverName: String(body.driver_name ?? "").trim(),
      driverPhone: String(body.carrier_phone ?? "").trim(),
    },
    user.email,
  );
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (order) {
    notify(
      c,
      `Carrier assigned\n${order.number} · ${name}${mc ? ` (${mc})` : ""}\nby ${user.email}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
    );
  }
  return c.redirect(adminRedirect(body, `/admin/orders/${id}`), 303);
});

app.post("/admin/orders/:id/note", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const note = String(body.note ?? "").trim();
  if (note) await addNote(c.env.DB, id, note, user.email);
  return c.redirect(`/admin/orders/${id}`, 303);
});

app.post("/admin/orders/:id/invoice", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return c.redirect(`/admin/orders/${id}`, 303);

  const dueDate = String(body.due_at ?? "").trim();
  const dueAt = dueDate ? new Date(`${dueDate}T23:59:59Z`).getTime() : null;

  await createInvoice(
    c.env.DB,
    id,
    {
      description: String(body.description ?? `Vehicle transport`).trim() || "Vehicle transport",
      amount: Math.round(amount),
      dueAt: dueAt && Number.isFinite(dueAt) ? dueAt : null,
      note: String(body.note ?? "").trim(),
    },
    user.email,
  );
  return c.redirect(`/admin/orders/${id}`, 303);
});

app.post("/admin/invoices/:id/paid", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const invoice = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first<InvoiceRow>();
  if (!invoice) return c.html(notFoundPage(), 404);

  await markInvoicePaid(c.env.DB, id, user.email);
  return c.redirect(`/admin/orders/${invoice.order_id}`, 303);
});

app.get("/admin/invoices/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const invoice = await c.env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first<InvoiceRow>();
  if (!invoice) return c.html(notFoundPage(), 404);

  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(invoice.order_id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  return c.html(invoicePage(invoice, order));
});

app.get("/admin/users", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  return c.html(adminUsersPage(await listUsers(c.env.DB), user));
});

app.post("/admin/users", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "dispatcher");
  const password = String(body.password ?? "").trim() || generatePassword();

  if (!EMAIL_PATTERN.test(email) || !isRole(role)) {
    return c.html(adminUsersPage(await listUsers(c.env.DB), user), 400);
  }

  await createUser(c.env.DB, { email, name, role, password });
  return c.html(adminUsersPage(await listUsers(c.env.DB), user, { email, password, kind: "created" }));
});

app.post("/admin/users/:id/reset", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const id = Number(c.req.param("id"));
  const target = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!target) return c.html(notFoundPage(), 404);

  const password = generatePassword();
  await setPassword(c.env.DB, id, password);
  return c.html(adminUsersPage(await listUsers(c.env.DB), user, { email: target.email, password, kind: "reset" }));
});

app.post("/admin/users/:id/active", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const id = Number(c.req.param("id"));
  if (id === user.id) return c.redirect("/admin/users", 303);

  const body = await c.req.parseBody();
  await setActive(c.env.DB, id, String(body.active ?? "1") === "1");
  return c.redirect("/admin/users", 303);
});

app.get("/admin/account", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  return c.html(accountPage(user));
});

app.post("/admin/account", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const body = await c.req.parseBody();
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  const confirm = String(body.confirm ?? "");

  if (!(await verifyPassword(current, user))) {
    return c.html(accountPage(user, undefined, "That current password is not right."), 401);
  }
  if (next.length < 10) {
    return c.html(accountPage(user, undefined, "Use at least 10 characters."), 400);
  }
  if (next !== confirm) {
    return c.html(accountPage(user, undefined, "The two new passwords do not match."), 400);
  }

  await setPassword(c.env.DB, user.id, next);
  return c.html(accountPage(user, "Password updated."));
});

app.notFound((c) => c.html(notFoundPage(), 404));

export default app;
