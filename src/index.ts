import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { SESSION_COOKIE, sessionMaxAge, signSession, timingSafeEqual, verifySession } from "./auth";
import { lookupZip, priceQuote, roadMiles, type TransportType, type VehicleCondition } from "./quote";
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
} from "./views";

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

async function currentAdmin(c: { env: Bindings; req: { header: (name: string) => string | undefined } }, token: string | undefined) {
  const email = await verifySession(c.env.SESSION_SECRET, token);
  return email;
}

app.get("/admin/login", (c) => c.html(adminLoginPage()));

app.post("/admin/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const expectedEmail = (c.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const expectedPassword = c.env.ADMIN_PASSWORD ?? "";

  if (!expectedEmail || !expectedPassword) {
    return c.html(adminLoginPage("Dispatch login is not configured yet."), 500);
  }
  if (email !== expectedEmail || !timingSafeEqual(password, expectedPassword)) {
    return c.html(adminLoginPage("Wrong email or password."), 401);
  }

  const token = await signSession(c.env.SESSION_SECRET, email);
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
  const email = await currentAdmin(c, getCookie(c, SESSION_COOKIE));
  if (!email) return c.redirect("/admin/login", 303);

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, email, phone, origin_zip, dest_zip, transport_type, condition,
            distance_miles, price_estimate, status, created_at
       FROM leads ORDER BY id DESC LIMIT 100`,
  ).all<LeadRow>();

  return c.html(adminPage(results, email));
});

app.notFound((c) => c.html(notFoundPage(), 404));

export default app;
