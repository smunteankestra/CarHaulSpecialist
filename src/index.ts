import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { SESSION_COOKIE, sessionMaxAge, signSession, timingSafeEqual, verifySession } from "./auth.ts";
import { isLeadStatus } from "./leads.ts";
import {
  addNote,
  assignCarrier,
  createInvoice,
  createOrder,
  isOrderStatus,
  markInvoicePaid,
  setStatus,
  type InvoiceRow,
  type OrderEventRow,
  type OrderRow,
} from "./orders.ts";
import { lookupZip, priceQuote, roadMiles, type TransportType, type VehicleCondition } from "./quote.ts";
import {
  accountPage,
  adminOrderPage,
  adminOrdersPage,
  adminUsersPage,
  bookPage,
  invoicePage,
  trackPage,
  type BookValues,
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
  type LeadRow,
  type QuoteFormValues,
} from "./views.ts";

interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

const app = new Hono<{ Bindings: Bindings }>();

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const ZIP_PATTERN = /^\d{5}$/;

app.get("/", (c) => c.html(homePage()));

app.get("/quote", (c) => c.html(quotePage({ values: {} })));

app.post("/quote", async (c) => {
  const body = await c.req.parseBody();
  const values: QuoteFormValues = {
    name: String(body.name ?? "").trim(),
    email: String(body.email ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    origin_zip: String(body.origin_zip ?? "").trim(),
    dest_zip: String(body.dest_zip ?? "").trim(),
    transport_type: String(body.transport_type ?? "open"),
    vehicle_year: String(body.vehicle_year ?? "").trim(),
    vehicle_make: String(body.vehicle_make ?? "").trim(),
    vehicle_model: String(body.vehicle_model ?? "").trim(),
    condition: String(body.condition ?? "running"),
    available_date: String(body.available_date ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
  };

  const invalid = (message: string) => c.html(quotePage({ values, error: message }), 400);

  if (!values.name || !values.email || !values.phone) return invalid("Name, email and phone are required.");
  if (!EMAIL_PATTERN.test(values.email)) return invalid("That email does not look right.");
  if (!ZIP_PATTERN.test(values.origin_zip ?? "")) return invalid("Pickup ZIP must be five digits.");
  if (!ZIP_PATTERN.test(values.dest_zip ?? "")) return invalid("Delivery ZIP must be five digits.");

  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition: VehicleCondition = values.condition === "non-running" ? "non-running" : "running";

  const [origin, destination] = await Promise.all([
    lookupZip(values.origin_zip ?? ""),
    lookupZip(values.dest_zip ?? ""),
  ]);

  const distance = origin && destination ? roadMiles(origin, destination) : null;
  const breakdown = distance === null ? null : priceQuote(distance, transport, condition, false);

  await c.env.DB.prepare(
    `INSERT INTO leads
       (name, email, phone, origin_zip, origin_city, origin_state, dest_zip, dest_city, dest_state,
        transport_type, vehicle_year, vehicle_make, vehicle_model, condition, available_date,
        distance_miles, price_estimate, price_is_estimate, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new', ?)`,
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
      Date.now(),
    )
    .run();

  if (!breakdown || !origin || !destination || distance === null) {
    return c.html(
      quotePage({
        values,
        error: "We could not price that route automatically. Dispatch will follow up with a number.",
      }),
    );
  }

  return c.html(
    quotePage({
      values,
      result: {
        origin: `${origin.city}, ${origin.state}`,
        destination: `${destination.city}, ${destination.state}`,
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

function bookValuesFrom(body: Record<string, unknown>): BookValues {
  const pick = (key: keyof BookValues) => String(body[key] ?? "").trim();
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
    ready_date: pick("ready_date") || String(body.available_date ?? "").trim(),
    notes: pick("notes"),
    lead_id: pick("lead_id"),
  };
}

async function priceFor(values: BookValues): Promise<{ distance: number | null; price: number | null }> {
  const [origin, destination] = await Promise.all([lookupZip(values.origin_zip ?? ""), lookupZip(values.dest_zip ?? "")]);
  if (!origin || !destination) return { distance: null, price: null };
  const distance = roadMiles(origin, destination);
  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition: VehicleCondition = values.condition === "non-running" ? "non-running" : "running";
  return { distance, price: priceQuote(distance, transport, condition, false).total };
}

app.get("/book", (c) => c.html(bookPage({}, null)));

app.post("/book", async (c) => {
  const values = bookValuesFrom(await c.req.parseBody());
  const { price } = await priceFor(values);
  return c.html(bookPage(values, price));
});

app.post("/book/submit", async (c) => {
  const values = bookValuesFrom(await c.req.parseBody());
  const invalid = (message: string) => c.html(bookPage(values, null, message), 400);

  if (!values.name || !values.email || !values.phone) return invalid("Name, email and phone are required.");
  if (!EMAIL_PATTERN.test(values.email)) return invalid("That email does not look right.");
  if (!ZIP_PATTERN.test(values.origin_zip ?? "") || !ZIP_PATTERN.test(values.dest_zip ?? "")) {
    return invalid("Both ZIP codes must be five digits.");
  }
  if (!values.origin_street || !values.dest_street) return invalid("Both street addresses are required.");
  if (!values.origin_contact || !values.origin_phone || !values.dest_contact || !values.dest_phone) {
    return invalid("A contact name and phone are required at both ends.");
  }

  const { distance, price } = await priceFor(values);
  if (price === null || distance === null) {
    return invalid("We could not price that route automatically. Call dispatch and we will book it by hand.");
  }

  const order = await createOrder(c.env.DB, {
    leadId: values.lead_id ? Number(values.lead_id) : null,
    customerName: values.name,
    customerEmail: values.email,
    customerPhone: values.phone,
    transportType: values.transport_type === "enclosed" ? "enclosed" : "open",
    condition: values.condition === "non-running" ? "non-running" : "running",
    vehicleYear: values.vehicle_year ?? "",
    vehicleMake: values.vehicle_make ?? "",
    vehicleModel: values.vehicle_model ?? "",
    vin: values.vin ?? "",
    originStreet: values.origin_street ?? "",
    originCity: values.origin_city ?? "",
    originState: (values.origin_state ?? "").toUpperCase(),
    originZip: values.origin_zip ?? "",
    originContact: values.origin_contact ?? "",
    originPhone: values.origin_phone ?? "",
    destStreet: values.dest_street ?? "",
    destCity: values.dest_city ?? "",
    destState: (values.dest_state ?? "").toUpperCase(),
    destZip: values.dest_zip ?? "",
    destContact: values.dest_contact ?? "",
    destPhone: values.dest_phone ?? "",
    readyDate: values.ready_date ?? "",
    distanceMiles: distance,
    price,
    notes: values.notes ?? "",
  });

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
  return c.redirect("/admin", 303);
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

  return c.html(adminPage(results, user.email, user.role === "admin"));
});

/** Keep modal redirects inside the console; anything else falls back to the record page. */
function adminRedirect(body: Record<string, unknown>, fallback: string): string {
  const next = String(body.next ?? "");
  return next === "/admin" || next.startsWith("/admin/") ? next : fallback;
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

app.get("/admin/orders", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const status = c.req.query("status") ?? "all";
  const filtered = status !== "all" && isOrderStatus(status);
  const statement = filtered
    ? c.env.DB.prepare("SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200").bind(status)
    : c.env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200");
  const { results } = await statement.all<OrderRow>();

  return c.html(adminOrdersPage(results, status, user.role === "admin"));
});

app.get("/admin/orders/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const [{ results: events }, { results: invoices }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").bind(id).all<OrderEventRow>(),
    c.env.DB.prepare("SELECT * FROM invoices WHERE order_id = ? ORDER BY id DESC").bind(id).all<InvoiceRow>(),
  ]);

  return c.html(adminOrderPage(order, events, invoices, new URL(c.req.url).origin));
});

app.post("/admin/orders/:id/status", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const status = String(body.status ?? "");
  if (!isOrderStatus(status)) return c.redirect(`/admin/orders/${id}`, 303);

  await setStatus(c.env.DB, id, status, user.email, String(body.note ?? ""));
  return c.redirect(adminRedirect(body, `/admin/orders/${id}`), 303);
});

app.post("/admin/orders/:id/carrier", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const name = String(body.carrier_name ?? "").trim();
  if (!name) return c.redirect(`/admin/orders/${id}`, 303);

  await assignCarrier(
    c.env.DB,
    id,
    { name, mc: String(body.carrier_mc ?? "").trim(), phone: String(body.carrier_phone ?? "").trim() },
    user.email,
  );
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
