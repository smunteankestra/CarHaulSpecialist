import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { CSRF_COOKIE, SESSION_COOKIE, sessionMaxAge, signSession, timingSafeEqual, verifySession } from "./auth.ts";
import { contractDocx, contractDocument } from "./contract.ts";
import { isLeadStatus } from "./leads.ts";
import { buildInvoiceMail, sendMail } from "./mail.ts";
import {
  addNote,
  assignCarrier,
  createInvoice,
  confirmOrder,
  createOrder,
  isOrderStatus,
  markInvoicePaid,
  randomToken,
  STATUS_LABELS,
  setStatus,
  type InvoiceRow,
  type OrderEventRow,
  type OrderRow,
  type OrderContractRow,
  type OrderUnitRow,
} from "./orders.ts";
import { conditionLabel, lookupZip, parseCondition, priceQuote, roadMiles, type TransportType } from "./quote.ts";
import { stateCode, stateName } from "./states.ts";
import { BLOG_POSTS, findBlogPost } from "./blog.ts";
import { LEGACY_PAGES } from "./content.ts";
import { blogIndexPage, blogPostPage, legacyPage } from "./views-content.ts";
import { buildCalendar, type CalendarEvent } from "./calendar.ts";
import { loadRevenueTrends, loadStaffPerformance, parseStaffMetric, parseStaffPeriod } from "./staff.ts";
import { stateTimezone, zonedToUtc } from "./timezone.ts";
import { formatPhone } from "./phone.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { staffPerformancePage } from "./views-staff.ts";
import {
  accountPage,
  telegramPage,
  adminOrderPage,
  adminOrdersPage,
  adminUsersPage,
  historyTable,
  orderModalCard,
  bookPage,
  invoicePage,
  trackPage,
  type BookValues,
  type ExtraUnit,
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
  site,
  when,
  type LeadPhotoRow,
  type LeadRow,
  type QuoteFormValues,
} from "./views.ts";


const SITEMAP_PATHS = [
  "/",
  "/get-quote",
  "/booking-form",
  "/open-vehicle-transport",
  "/enclosed-vehicle-transport",
  "/services/expedited",
  "/services/door-to-door",
  "/how-it-works",
  "/pricing",
  "/faq",
  "/contact",
  "/about",
  "/reviews",
  "/our-partners",
  "/who-we-serve",
  "/transport-options",
  "/blog",
  ...BLOG_POSTS.map((post) => `/post/${post.slug}`),
  "/app-landing-page",
  "/terms",
  "/privacy",
];

interface Bindings {
  DB: D1Database;
  UPLOADS: KVNamespace;
  ASSETS: Fetcher;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  MAIL_FROM?: string;
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, value, Date.now())
    .run();
}

function parseChatIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => /^-?\d{5,20}$/.test(part));
}

async function loadAdsShare(db: D1Database): Promise<{ ads: number; tax: number }> {
  const read = async (key: string, fallback: number) => {
    const stored = await getSetting(db, key).catch(() => null);
    if (stored === null || stored.trim() === "") return fallback;
    const number = Number(stored);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback;
  };
  return { ads: await read("ads_percent", 15), tax: await read("tax_percent", 17) };
}

/** The console setting wins over the environment variable, so recipients can change without a deploy. */
async function telegramTargets(env: Bindings, db: D1Database): Promise<string[]> {
  const stored = await getSetting(db, "telegram_chat_id").catch(() => null);
  const ids = parseChatIds(stored);
  return ids.length > 0 ? ids : parseChatIds(env.TELEGRAM_CHAT_ID);
}

async function sendTelegram(env: Bindings, db: D1Database, text: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatIds = await telegramTargets(env, db);
  if (!token || chatIds.length === 0) return false;

  const results = await Promise.all(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true }),
      })
        .then((response) => response.ok)
        .catch(() => false),
    ),
  );
  return results.some(Boolean);
}

function notify(
  c: { env: Bindings; executionCtx?: { waitUntil: (promise: Promise<unknown>) => void } },
  text: string,
): void {
  const promise = sendTelegram(c.env, c.env.DB, text).catch(() => { });
  try {
    c.executionCtx?.waitUntil(promise);
  } catch {
    // Local dev may not expose executionCtx; the notification is best-effort.
  }
}

const app = new Hono<{ Bindings: Bindings }>();

// Admin pages are per-session; never let a browser or edge cache them.
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

app.use("/admin", async (c, next) => {
  await next();
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) c.header(key, value);
});

app.use("/admin/*", async (c, next) => {
  // Origin guard: a browser that sends Origin must be on this host. Requests
  // without Origin (curl, calendar apps) are unaffected — this only stops
  // cross-site browser calls, which is all an Origin check can ever do.
  const origin = c.req.header("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(c.req.url).host) {
        return c.text("Blocked: this endpoint only answers its own origin.", 403);
      }
    } catch {
      return c.text("Blocked: malformed origin.", 403);
    }
  }

  // CSRF: every admin write must carry the token from the login cookie, or at
  // least come from this origin. Login itself is exempt (no session yet).
  if (c.req.method === "POST" && c.req.path !== "/admin/login") {
    const cookie = getCookie(c, CSRF_COOKIE) ?? "";
    const header = c.req.header("x-csrf-token") ?? "";
    let bodyToken = "";
    if (!header) {
      const type = c.req.header("content-type") ?? "";
      if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
        try {
          const parsed = await c.req.parseBody();
          bodyToken = String(parsed.csrf ?? "");
        } catch {
          bodyToken = "";
        }
      }
    }
    const supplied = header || bodyToken;
    const sameOrigin = (() => {
      const origin = c.req.header("origin") ?? c.req.header("referer") ?? "";
      if (!origin) return false;
      try {
        return new URL(origin).host === new URL(c.req.url).host;
      } catch {
        return false;
      }
    })();
    const tokenOk = Boolean(cookie && supplied && timingSafeEqual(supplied, cookie));
    if (!tokenOk && !sameOrigin) {
      return c.html(
        `<p>Request blocked: the form did not carry a valid security token. Reload the page and try again.</p>`,
        403,
      );
    }
  }
  await next();
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) c.header(key, value);
});

// Tracking links are per-customer; never index them.
app.use("/track/*", async (c, next) => {
  await next();
  c.header("X-Robots-Tag", "noindex, nofollow");
});

const STATUS_EMOJI: Record<string, string> = {
  quoted: "🧾",
  confirmed: "✅",
  contract_draft: "📝",
  assigned: "🚚",
  picked_up: "📦",
  delivered: "📬",
  paid: "💵",
  cancelled: "❌",
};

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

app.get("/get-quote", (c) => c.html(quotePage({ values: {} })));

/** Accept only a valid date today or later. */
function futureDate(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  // One day of slack: a viewer west of UTC can pick "today" while UTC is already tomorrow.
  return Date.UTC(year, month - 1, day) >= utcToday - 86_400_000 ? value : "";
}

function moneyOrNull(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

app.post("/get-quote", async (c) => {
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
  if (!values.available_date) return invalid("Choose a pickup date — today or later.");
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
  const extras = extraUnits(form);
  const breakdown = distance === null ? null : priceQuote(distance, transport, condition, false);
  const extraTotal = distance === null ? 0 : extras.reduce((sum, unit) => sum + priceQuote(distance, transport, parseCondition(unit.condition), false).total, 0);


  const unitRows = distance === null ? [] : [
    {
      label: [values.vehicle_year, values.vehicle_make, values.vehicle_model].filter(Boolean).join(" ") || "Vehicle 1",
      condition: conditionLabel(condition),
      conditionValue: values.condition || "running",
      year: values.vehicle_year ?? "",
      make: values.vehicle_make ?? "",
      model: values.vehicle_model ?? "",
      price: priceQuote(distance, transport, condition, false).total,
    },
    ...extras.map((unit, index) => {
      const unitCondition = parseCondition(unit.condition);
      return {
        label: [unit.year, unit.make, unit.model].filter(Boolean).join(" ") || `Vehicle ${index + 2}`,
        condition: conditionLabel(unitCondition),
        conditionValue: unit.condition,
        year: unit.year,
        make: unit.make,
        model: unit.model,
        price: priceQuote(distance, transport, unitCondition, false).total,
      };
    }),
  ];

  const extraDeposit = distance === null ? 0 : extras.reduce((sum, unit) => sum + priceQuote(distance, transport, parseCondition(unit.condition), false).deposit, 0);

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
      `🧾 New quote request (needs pricing)\n${values.name} · ${values.phone}\n${values.origin_zip} → ${values.dest_zip}\n${new URL(c.req.url).origin}${leadId ? `/admin#quote-${leadId}` : "/admin"}`,
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
      customerPhone: formatPhone(values.phone ?? ""),
      transportType: transport,
      condition,
      vehicleYear: values.vehicle_year ?? "",
      vehicleMake: values.vehicle_make ?? "",
      vehicleModel: values.vehicle_model ?? "",
      vin: field("vin"),
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
      readyAsap: field("available_date_asap") === "1",
      distanceMiles: distance,
      price: breakdown.total + extraTotal,
      notes: values.notes ?? "",
    },
    "quoted",
  );

  // Every vehicle on the quote becomes a unit on the order, not just the first.
  const quoteUnits = [
    {
      year: values.vehicle_year ?? "",
      make: values.vehicle_make ?? "",
      model: values.vehicle_model ?? "",
      vin: field("vin"),
      condition,
    },
    ...extras.map((unit) => ({
      year: unit.year,
      make: unit.make,
      model: unit.model,
      vin: unit.vin,
      condition: parseCondition(unit.condition),
    })),
  ];
  const quoteNow = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM order_units WHERE order_id = ?").bind(quoteOrder.id),
    ...quoteUnits.map((unit, index) =>
      c.env.DB.prepare(
        `INSERT INTO order_units (order_id, position, vehicle_year, vehicle_make, vehicle_model, vin, vehicle_type, condition, price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        quoteOrder.id,
        index + 1,
        unit.year || null,
        unit.make || null,
        unit.model || null,
        unit.vin || null,
        transport,
        unit.condition,
        priceQuote(distance, transport, unit.condition, false).total,
        quoteNow,
      ),
    ),
  ]);

  if (leadId) {
    await c.env.DB.prepare(
      "INSERT INTO order_photos (order_id, photo_key, created_at) SELECT ?, photo_key, created_at FROM lead_photos WHERE lead_id = ?",
    )
      .bind(quoteOrder.id, leadId)
      .run();
  }

  notify(
    c,
    `🧾 New quote\n${values.name} · ${values.phone}\n${origin.city}, ${stateName(origin.state)} → ${destination.city}, ${stateName(destination.state)}\n${distance.toLocaleString()} mi · ${transport} · $${breakdown.total.toLocaleString()}\n${new URL(c.req.url).origin}/admin/orders#order-${quoteOrder.id}`,
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
        total: breakdown.total + extraTotal,
        deposit: breakdown.deposit + extraDeposit,
        breakdown: breakdown.base.toLocaleString(),
        vehicles: extras.length + 1,
        units: unitRows,
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
    ready_asap:
      pick("ready_asap") ||
      String(body instanceof FormData ? (body.get("available_date_asap") ?? "") : (body.available_date_asap ?? "")).trim(),
    notes: pick("notes"),
    lead_id: pick("lead_id"),
    order_token: pick("order_token"),
  };
}

type QuoteUnit = ExtraUnit;

/**
 * Multi-vehicle quotes, verified end to end against a local worker:
 *   form      — "+ Add another vehicle" appends blocks numbered 2 and 3 with fields
 *               vehicle_year_2 … condition_3; Remove renumbers; the button disables at 10.
 *   pricing   — 1 running ($699) + 1 inoperable ($849) + 1 running ($699) = $2,247, and the
 *               Booking summary shows "Vehicles: 3".
 *   booking   — POST /book/submit stores orders.price = 2247 and three order_units rows
 *               (699 / 849 / 699) carrying position, year, make, model and condition.
 *   admin     — the order modal renders the Vehicles table with those three units.
 *   carry-over— the quote → booking hand-off keeps the extra units as hidden inputs.
 */
/** Extra vehicles from the instant quote (up to 10 in total, so indices 2–10). */
function extraUnits(form: FormData): QuoteUnit[] {
  const units: QuoteUnit[] = [];
  for (let index = 2; index <= 10; index += 1) {
    const year = String(form.get(`vehicle_year_${index}`) ?? "").trim();
    const make = String(form.get(`vehicle_make_${index}`) ?? "").trim();
    const model = String(form.get(`vehicle_model_${index}`) ?? "").trim();
    if (!year && !make && !model) continue;
    const condition = String(form.get(`condition_${index}`) ?? "").trim();
    const vin = String(form.get(`vin_${index}`) ?? "").trim();
    units.push({ year, make, model, vin, condition: condition || "running" });
  }
  return units;
}

/** Fill city and state from the ZIP codes so the booking form arrives pre-answered. */
async function hydrateFromZips(values: BookValues): Promise<void> {
  const [origin, destination] = await Promise.all([
    lookupZip(values.origin_zip ?? ""),
    lookupZip(values.dest_zip ?? ""),
  ]);
  if (origin) {
    if (!values.origin_city) values.origin_city = origin.city;
    if (!values.origin_state) values.origin_state = stateCode(origin.state);
  }
  if (destination) {
    if (!values.dest_city) values.dest_city = destination.city;
    if (!values.dest_state) values.dest_state = stateCode(destination.state);
  }
}

async function priceFor(
  values: BookValues,
  extras: QuoteUnit[] = [],
): Promise<{ distance: number | null; price: number | null }> {
  const [origin, destination] = await Promise.all([lookupZip(values.origin_zip ?? ""), lookupZip(values.dest_zip ?? "")]);
  if (!origin || !destination) return { distance: null, price: null };
  const distance = roadMiles(origin, destination);
  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition = parseCondition(values.condition ?? "running");
  const price = [condition, ...extras.map((unit) => parseCondition(unit.condition))].reduce(
    (sum, unitCondition) => sum + priceQuote(distance, transport, unitCondition, false).total,
    0,
  );
  return { distance, price };
}

app.get("/booking-form", (c) => c.html(bookPage({}, null)));
app.get("/quote", (c) => c.redirect("/get-quote", 301));
app.get("/book", (c) => c.redirect("/booking-form", 301));

app.post("/booking-form", async (c) => {
  const form = await c.req.formData();
  const values = bookValuesFrom(form);
  values.ready_date = futureDate(values.ready_date);
  await hydrateFromZips(values);
  const extras = extraUnits(form);
  const { price } = await priceFor(values, extras);
  return c.html(bookPage(values, price, undefined, extras));
});

app.post("/quote", async (c) => {
  const form = await c.req.formData();
  const values = bookValuesFrom(form);
  values.ready_date = futureDate(values.ready_date);
  await hydrateFromZips(values);
  const extras = extraUnits(form);
  const { price } = await priceFor(values, extras);
  return c.html(bookPage(values, price, undefined, extras));
});

app.post("/book", async (c) => {
  const form = await c.req.formData();
  const values = bookValuesFrom(form);
  values.ready_date = futureDate(values.ready_date);
  await hydrateFromZips(values);
  const extras = extraUnits(form);
  const { price } = await priceFor(values, extras);
  return c.html(bookPage(values, price, undefined, extras));
});

/** Re-price the quote page after a customer edits a detail in the summary. No lead, no notification. */
app.post("/quote/refresh", async (c) => {
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

  const [origin, destination] = await Promise.all([
    lookupZip(values.origin_zip ?? ""),
    lookupZip(values.dest_zip ?? ""),
  ]);
  const transport: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const condition = parseCondition(values.condition ?? "running");
  const distance = origin && destination ? roadMiles(origin, destination) : null;
  const extras = extraUnits(form);
  const breakdown = distance === null ? null : priceQuote(distance, transport, condition, false);
  const extraTotal = distance === null ? 0 : extras.reduce((sum, unit) => sum + priceQuote(distance, transport, parseCondition(unit.condition), false).total, 0);
  const unitRows = distance === null ? [] : [
    {
      label: [values.vehicle_year, values.vehicle_make, values.vehicle_model].filter(Boolean).join(" ") || "Vehicle 1",
      condition: conditionLabel(condition),
      conditionValue: values.condition || "running",
      year: values.vehicle_year ?? "",
      make: values.vehicle_make ?? "",
      model: values.vehicle_model ?? "",
      price: priceQuote(distance, transport, condition, false).total,
    },
    ...extras.map((unit, index) => {
      const unitCondition = parseCondition(unit.condition);
      return {
        label: [unit.year, unit.make, unit.model].filter(Boolean).join(" ") || `Vehicle ${index + 2}`,
        condition: conditionLabel(unitCondition),
        conditionValue: unit.condition,
        year: unit.year,
        make: unit.make,
        model: unit.model,
        price: priceQuote(distance, transport, unitCondition, false).total,
      };
    }),
  ];

  const extraDeposit = distance === null ? 0 : extras.reduce((sum, unit) => sum + priceQuote(distance, transport, parseCondition(unit.condition), false).deposit, 0);

  const leadId = field("lead_id") ? Number(field("lead_id")) : undefined;
  const orderToken = field("order_token") || undefined;

  if (!origin || !destination || distance === null || !breakdown) {
    return c.html(
      quotePage({ values, leadId, orderToken, error: "Check both ZIP codes — we could not price that route." }),
      400,
    );
  }

  return c.html(
    quotePage({
      values,
      leadId,
      orderToken,
      result: {
        origin: `${origin.city}, ${stateName(origin.state)}`,
        destination: `${destination.city}, ${stateName(destination.state)}`,
        distance,
        transport: transport === "enclosed" ? "Enclosed trailer" : "Open trailer",
        total: breakdown.total + extraTotal,
        deposit: breakdown.deposit + extraDeposit,
        breakdown: breakdown.base.toLocaleString(),
        vehicles: extras.length + 1,
        units: unitRows,
        estimated: false,
      },
    }),
  );
});

app.post("/book/submit", async (c) => {
  const form = await c.req.formData();
  const values = bookValuesFrom(form);
  values.ready_date = futureDate(values.ready_date);
  await hydrateFromZips(values);
  const invalid = (message: string) => c.html(bookPage(values, null, message), 400);

  if (!values.name || !values.email || !values.phone) return invalid("Name, email and phone are required.");
  if (!EMAIL_PATTERN.test(values.email)) return invalid("That email does not look right.");
  if (!values.ready_date) return invalid("Choose a pickup date — today or later.");
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

  const extras = extraUnits(form);
  const { distance, price } = await priceFor(values, extras);
  if (price === null || distance === null) {
    return invalid("We could not price that route automatically. Call dispatch and we will book it by hand.");
  }

  const leadId = values.lead_id ? Number(values.lead_id) : null;
  const orderInput = {
    leadId,
    customerName: values.name,
    customerEmail: values.email,
    customerPhone: formatPhone(values.phone ?? ""),
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
    originPhone: formatPhone(values.origin_phone ?? ""),
    destStreet: values.dest_street ?? "",
    destCity: values.dest_city ?? "",
    destState: stateCode(values.dest_state ?? ""),
    destZip: values.dest_zip ?? "",
    destContact: values.dest_contact ?? "",
    destPhone: formatPhone(values.dest_phone ?? ""),
    readyDate: values.ready_date ?? "",
    readyAsap: values.ready_asap === "1",
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

  // One row per vehicle; the order keeps the first one for list views.
  const transportKind: TransportType = values.transport_type === "enclosed" ? "enclosed" : "open";
  const unitInputs = [
    {
      year: values.vehicle_year ?? "",
      make: values.vehicle_make ?? "",
      model: values.vehicle_model ?? "",
      vin: values.vin ?? "",
      condition: parseCondition(values.condition ?? "running"),
    },
    ...extras.map((unit) => ({
      year: unit.year,
      make: unit.make,
      model: unit.model,
      vin: unit.vin,
      condition: parseCondition(unit.condition),
    })),
  ];
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM order_units WHERE order_id = ?").bind(order.id),
    ...unitInputs.map((unit, index) =>
      c.env.DB.prepare(
        `INSERT INTO order_units (order_id, position, vehicle_year, vehicle_make, vehicle_model, vin, vehicle_type, condition, price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        order.id,
        index + 1,
        unit.year || null,
        unit.make || null,
        unit.model || null,
        unit.vin || null,
        transportKind,
        unit.condition,
        priceQuote(distance, transportKind, unit.condition, false).total,
        now,
      ),
    ),
  ]);

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
    `${quotedOrder ? "✅ Order confirmed" : "📦 New order"}\n${order.number} · ${order.customer_name}\n${order.origin_zip} → ${order.dest_zip}\n$${order.price.toLocaleString()}\n${new URL(c.req.url).origin}/admin/orders#order-${order.id}`,
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

  return c.html(trackPage(order, events, invoices, c.req.query("new") === "1"));
});

app.get("/services/:slug", (c) => {
  const slug = c.req.param("slug");
  if (slug === "open") return c.redirect("/open-vehicle-transport", 301);
  if (slug === "enclosed") return c.redirect("/enclosed-vehicle-transport", 301);
  const page = servicePage(slug);
  return page ? c.html(page) : c.html(notFoundPage(), 404);
});

app.get("/how-it-works", (c) => c.html(howItWorksPage()));
app.get("/pricing", (c) => c.html(pricingPage()));
app.get("/faq", (c) => c.html(faqPage()));
app.get("/contact", (c) => c.html(contactPage()));
app.get("/terms", (c) => c.html(legalPage("terms")));
app.get("/privacy", (c) => c.html(legalPage("privacy")));


for (const slug of Object.keys(LEGACY_PAGES)) {
  app.get(`/${slug}`, (c) => c.html(legacyPage(slug) ?? notFoundPage()));
}

app.get("/blog", (c) => c.html(blogIndexPage()));
app.get("/post/:slug", (c) => {
  const post = findBlogPost(c.req.param("slug"));
  return post ? c.html(blogPostPage(post)) : c.html(notFoundPage(), 404);
});

app.get("/open-vehicle-transport", (c) => c.html(servicePage("open", "/open-vehicle-transport") ?? notFoundPage()));
app.get("/enclosed-vehicle-transport", (c) => c.html(servicePage("enclosed", "/enclosed-vehicle-transport") ?? notFoundPage()));

// The old Wix store had no products; keep the URLs alive rather than 404.
app.get("/category/:slug", (c) => c.redirect("/", 301));
app.get("/store/:slug", (c) => c.redirect("/", 301));

app.get("/sitemap.xml", (c) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_PATHS.map(
    (path) => `<url><loc>${site.url}${path}</loc><lastmod>${lastmod}</lastmod></url>`,
  ).join("");
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    200,
    { "content-type": "application/xml; charset=utf-8" },
  );
});

app.get("/robots.txt", (c) =>
  c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /track/\nSitemap: ${site.url}/sitemap.xml\n`),
);

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

type VehicleMake = { id: number; name: string };

async function loadVehicleMakes(vehicleType: "car" | "motorcycle"): Promise<VehicleMake[]> {
  const cache = caches.default;
  const cacheKey = new Request(`https://vehicle-catalog.internal/makes-data?type=${vehicleType}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = (await cached.json()) as { makes?: VehicleMake[] };
    return data.makes ?? [];
  }

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${vehicleType}?format=json`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { Results?: { MakeId?: number; MakeName?: string }[] };
    const makes = Array.from(
      new Map(
        (data.Results ?? [])
          .filter((row) => typeof row.MakeId === "number" && row.MakeName)
          .map((row) => [row.MakeName!.trim().toLowerCase(), { id: row.MakeId!, name: row.MakeName!.trim() }]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name));
    const cachedResponse = new Response(JSON.stringify({ makes }), {
      headers: { "content-type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
    await cache.put(cacheKey, cachedResponse);
    return makes;
  } catch {
    return [];
  }
}

app.get("/api/vehicles/makes", async (c) => {
  const requested = String(c.req.query("type") ?? "car").trim();
  const vehicleType = requested === "motorcycle" ? "motorcycle" : "car";
  const makes = await loadVehicleMakes(vehicleType);
  const result = c.json({ makes: makes.map((row) => row.name) });
  result.headers.set("Cache-Control", "public, max-age=86400");
  return result;
});

app.get("/api/vehicles/models", async (c) => {
  const make = String(c.req.query("make") ?? "").trim();
  const year = String(c.req.query("year") ?? "").trim();
  const requested = String(c.req.query("type") ?? "car").trim();
  const vehicleType = requested === "motorcycle" ? "motorcycle" : "car";
  if (!make) return c.json({ models: [] });
  if (year && !/^\d{4}$/.test(year)) return c.json({ models: [] }, 400);

  const modelYear = year || String(new Date().getUTCFullYear());
  const cache = caches.default;
  const cacheKey = new Request(
    `https://vehicle-catalog.internal/models?make=${encodeURIComponent(make.toLowerCase())}&year=${modelYear}&type=${vehicleType}`,
  );
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const makes = await loadVehicleMakes(vehicleType);
  const makeRow = makes.find((row) => row.name.toLowerCase() === make.toLowerCase());
  if (!makeRow) return c.json({ models: [] });

  const modelTypes = vehicleType === "motorcycle" ? ["motorcycle"] : ["car", "truck", "mpv"];

  try {
    const results = await Promise.all(
      modelTypes.map(async (modelType) => {
        const response = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeIdYear/makeId/${makeRow.id}/modelyear/${modelYear}/vehicletype/${modelType}?format=json`,
        );
        if (!response.ok) return [] as string[];
        const data = (await response.json()) as { Results?: { Model_Name?: string }[] };
        return (data.Results ?? [])
          .map((row) => row.Model_Name?.trim())
          .filter((name): name is string => Boolean(name));
      }),
    );
    const models = Array.from(new Set(results.flat())).sort((a, b) => a.localeCompare(b));
    const result = c.json({ models });
    result.headers.set("Cache-Control", "public, max-age=86400");
    c.executionCtx.waitUntil(cache.put(cacheKey, result.clone()));
    return result;
  } catch {
    return c.json({ models: [] }, 502);
  }
});

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
    const text = `💬 New website chat\nName: ${name}\nContact: ${contact || "—"}\nPage: ${page || "—"}\n\n${message}`;
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

  // Human check first: no point comparing passwords for a bot.
  const human = await verifyTurnstile(
    c.env.TURNSTILE_SECRET,
    String(body["cf-turnstile-response"] ?? ""),
    c.req.header("cf-connecting-ip") ?? undefined,
  );
  if (!human) return c.html(adminLoginPage("That human check did not pass. Try again."), 403);

  // Brute-force throttle: five failures in fifteen minutes locks that email.
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const windowStart = Date.now() - 15 * 60000;
  const { results: recent } = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND created_at > ?",
  )
    .bind(email, windowStart)
    .all<{ n: number }>();
  if ((recent[0]?.n ?? 0) >= 5) {
    return c.html(adminLoginPage("Too many attempts. Wait 15 minutes or reset the password."), 429);
  }

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
    await c.env.DB.prepare("INSERT INTO login_attempts (email, ip, created_at) VALUES (?, ?, ?)")
      .bind(email, ip, Date.now())
      .run();
    return c.html(adminLoginPage("Wrong email or password."), 401);
  }

  // A good password clears the counter.
  await c.env.DB.prepare("DELETE FROM login_attempts WHERE email = ?").bind(email).run();

  await touchLogin(c.env.DB, user.id);
  const token = await signSession(c.env.SESSION_SECRET, user.email);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: sessionMaxAge,
    secure: new URL(c.req.url).protocol === "https:",
  });
  // Double-submit CSRF token: paired with every admin POST. Readable by our own
  // script so it can stamp every form, which is the point of the pattern.
  setCookie(c, CSRF_COOKIE, randomToken().slice(0, 32), {
    httpOnly: false,
    sameSite: "Lax",
    path: "/",
    maxAge: sessionMaxAge,
    secure: new URL(c.req.url).protocol === "https:",
  });
  return c.redirect("/admin/orders", 303);
});

app.post("/admin/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  deleteCookie(c, CSRF_COOKIE, { path: "/" });
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
function parseDateTime(body: Record<string, string | File>, prefix: string, zone?: string): number | null {
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
  const hour24 = (hour % 12) + (ampm === "PM" ? 12 : 0);
  const stamp = zone
    ? zonedToUtc(year, month, safeDay, hour24, minute, zone)
    : Date.UTC(year, month - 1, safeDay, hour24, minute);
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
  distance: "distance_miles",
  price: "price",
  status: `CASE status
    WHEN 'quoted' THEN 1
    WHEN 'confirmed' THEN 2
    WHEN 'contract_draft' THEN 3
    WHEN 'assigned' THEN 4
    WHEN 'picked_up' THEN 5
    WHEN 'delivered' THEN 6
    WHEN 'paid' THEN 7
    WHEN 'cancelled' THEN 8
    ELSE 9
  END`,
  created: "created_at",
  delivery_eta: "delivery_eta",
  client_invoice: "client_invoice_amount",
  carrier_invoice: "carrier_invoice_amount",
};

app.get("/admin/orders", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const status = c.req.query("status") ?? "all";
  const sort = c.req.query("sort") ?? "created";
  const dir = c.req.query("dir") === "asc" ? "asc" : "desc";
  const query = (c.req.query("q") ?? "").trim().slice(0, 80);
  const filtered = status !== "all" && isOrderStatus(status);
  const direction = dir === "asc" ? "ASC" : "DESC";
  const orderBy =
    sort === "route"
      ? `origin_zip ${direction}, dest_zip ${direction}`
      : `${ORDER_SORTS[sort] ?? "created_at"} ${direction}`;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filtered) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (query) {
    // one box, every column a dispatcher might type into it
    const columns = [
      "number",
      "customer_name",
      "customer_email",
      "customer_phone",
      "origin_zip",
      "origin_city",
      "origin_state",
      "dest_zip",
      "dest_city",
      "dest_state",
      "vehicle_year",
      "vehicle_make",
      "vehicle_model",
      "vin",
      "carrier_name",
      "carrier_mc",
      "driver_name",
      "notes",
      "status",
    ];
    conditions.push(`(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`);
    for (let i = 0; i < columns.length; i += 1) params.push(`%${query}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // Page through the list: 50 at a time, one extra row tells us whether more exist.
  const show = Math.min(Math.max(Number(c.req.query("show")) || 50, 50), 1000);
  const statement = c.env.DB.prepare(`SELECT * FROM orders ${where} ORDER BY ${orderBy} LIMIT ${show + 1}`).bind(...params);
  const { results } = await statement.all<OrderRow>();
  const hasMore = results.length > show;
  if (hasMore) results.pop();

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

  const errorOrder = Number(c.req.query("error_order"));
  return c.html(
    adminOrdersPage(
      results,
      status,
      user.role === "admin",
      photos,
      sort,
      dir,
      events,
      counts,
      Number.isFinite(errorOrder) && errorOrder > 0 ? errorOrder : null,
      c.req.query("error"),
      query,
      show,
      hasMore,
    ),
  );
});

app.get("/admin/orders/:id", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const [{ results: events }, { results: invoices }, { results: photos }, { results: units }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").bind(id).all<OrderEventRow>(),
    c.env.DB.prepare("SELECT * FROM invoices WHERE order_id = ? ORDER BY id DESC").bind(id).all<InvoiceRow>(),
    c.env.DB.prepare("SELECT * FROM order_photos WHERE order_id = ? ORDER BY id").bind(id).all<OrderPhotoRow>(),
    c.env.DB.prepare("SELECT * FROM order_units WHERE order_id = ? ORDER BY position").bind(id).all<OrderUnitRow>(),
  ]);

  return c.html(
    adminOrderPage(order, events, invoices, new URL(c.req.url).origin, photos, c.req.query("error"), units),
  );
});

/** Data the current step must have before the order can move on. */
function missingStepData(
  status: string,
  data: {
    finalQuote: number | null;
    pickupEta: number | null;
    pickedUpAt: number | null;
    deliveryEta: number | null;
    deliveredAt: number | null;
    brokerFee: number | null;
    carrierFee: number | null;
    originContact: string | null;
    destContact: string | null;
    carrierName: string | null;
    carrierMc: string | null;
    carrierCompanyPhone: string | null;
    carrierEmail: string | null;
    driverName: string | null;
    carrierPhone: string | null;
    paymentMethod: string | null;
  },
): string | null {
  if (status === "quoted" && data.finalQuote === null) return "Set the final quote before moving to Booked.";
  if (status === "confirmed") {
    const missing: string[] = [];
    if (!data.pickupEta) missing.push("Pickup ETA");
    if (!data.deliveryEta) missing.push("Delivery ETA");
    if (data.finalQuote === null) missing.push("Final quote");
    if (data.brokerFee === null) missing.push("Broker fee");
    if (data.carrierFee === null) missing.push("Carrier fee");
    if (!data.originContact) missing.push("Pickup contact");
    if (!data.destContact) missing.push("Delivery contact");
    if (missing.length) return `Add ${missing.join(", ")} before moving to Contract draft.`;
  }
  if (status === "contract_draft" && !data.pickupEta) return "Add the pickup ETA before moving to Carrier assigned.";
  if (status === "contract_draft" && !data.paymentMethod) return "Add the payment method before moving to Carrier assigned.";
  if (status === "assigned" && !data.pickupEta) return "Add the pickup ETA before moving to Picked up.";
  if (status === "assigned" && !data.originContact) return "Add the pickup contact before moving to Picked up.";
  if (status === "assigned" && !data.destContact) return "Add the delivery contact before moving to Picked up.";
  if (status === "assigned") {
    const carrierMissing: string[] = [];
    if (!data.carrierName) carrierMissing.push("carrier company");
    if (!data.carrierMc) carrierMissing.push("MC number");
    if (!data.carrierCompanyPhone) carrierMissing.push("carrier phone");
    if (!data.carrierEmail) carrierMissing.push("carrier email");
    if (!data.driverName) carrierMissing.push("driver name");
    if (!data.carrierPhone) carrierMissing.push("driver phone");
    if (carrierMissing.length) return `Add the ${carrierMissing.join(", ")} before moving to Picked up.`;
  }
  if (status === "picked_up" && !data.pickedUpAt) return "Add the pickup date and time before moving to Delivered.";
  if (status === "picked_up" && !data.deliveryEta) return "Add the delivery ETA before moving to Delivered.";
  if (status === "delivered" && !data.deliveredAt) return "Add the delivered date and time before moving to Payments.";
  return null;
}

app.post("/admin/orders/:id/status", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const moveRaw = String(body.move_status ?? "");
  const moving = isOrderStatus(moveRaw) ? moveRaw : null;
  const status = moving ?? String(body.status ?? "");
  if (!isOrderStatus(status)) return c.redirect(`/admin/orders/${id}`, 303);

  const statusOrder = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  const destZone = statusOrder ? (statusOrder.dest_tz ?? stateTimezone(statusOrder.dest_state)) : undefined;
  const pickedUpAt = parseDateTime(body, "picked_up");
  const pickupEta = parseDateTime(body, "pickup_eta", statusOrder ? stateTimezone(statusOrder.origin_state) : undefined);
  const deliveryEta = parseDateTime(body, "delivery_eta", destZone);
  const deliveredAt = parseDateTime(body, "delivered");

  // Timestamps that record something that already happened cannot be in the future.
  if (pickedUpAt && pickedUpAt > Date.now() + 60000) {
    return c.redirect(`/admin/orders?error=${encodeURIComponent("The pickup date cannot be in the future.")}&error_order=${id}#order-${id}`, 303);
  }
  if (deliveredAt && deliveredAt > Date.now() + 60000) {
    return c.redirect(`/admin/orders?error=${encodeURIComponent("The delivery date cannot be in the future.")}&error_order=${id}#order-${id}`, 303);
  }
  const paidRaw = String(body.paid_amount ?? "").trim();
  const paidNumber = paidRaw ? Number(paidRaw) : NaN;
  const paidAmount = Number.isFinite(paidNumber) && paidNumber >= 0 ? Math.round(paidNumber) : null;
  const paymentMethodRaw = String(body.payment_method ?? "").trim();
  const paymentMethod = PAYMENT_METHODS.includes(paymentMethodRaw) ? paymentMethodRaw : null;
  const hasFinal = Object.prototype.hasOwnProperty.call(body, "final_quote");
  const hasBroker = Object.prototype.hasOwnProperty.call(body, "broker_fee");
  const hasCarrier = Object.prototype.hasOwnProperty.call(body, "carrier_fee");
  const finalQuote = moneyOrNull(body.final_quote);
  const brokerFee = moneyOrNull(body.broker_fee);
  const carrierFee = moneyOrNull(body.carrier_fee);
  const note = String(body.note ?? "").trim();
  const finalNote = hasFinal && finalQuote !== null ? `Final quote $${finalQuote.toLocaleString()}` : "";
  const brokerNote = hasBroker && brokerFee !== null ? `Broker fee $${brokerFee.toLocaleString()}` : "";
  const carrierNote = hasCarrier && carrierFee !== null ? `Carrier fee $${carrierFee.toLocaleString()}` : "";
  const pickupNote = pickedUpAt ? `Picked up ${when(pickedUpAt)}` : "";
  const etaNote = pickupEta ? `Pickup ETA ${when(pickupEta)}` : "";
  const deliveryNote = deliveryEta ? `Delivery ETA ${when(deliveryEta)}` : "";
  const deliveredNote = deliveredAt ? `Delivered ${when(deliveredAt)}` : "";
  const paidNote = paidAmount !== null ? `Paid $${paidAmount.toLocaleString()}${paymentMethod ? ` via ${paymentMethod}` : ""}` : "";
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();

  if (moving && order) {
    const missing = missingStepData(order.status, {
      finalQuote: finalQuote ?? order.final_quote,
      pickupEta: pickupEta ?? order.pickup_eta,
      pickedUpAt: pickedUpAt ?? order.picked_up_at,
      deliveryEta: deliveryEta ?? order.delivery_eta,
      deliveredAt: deliveredAt ?? order.delivered_at,
      brokerFee: brokerFee ?? order.broker_fee,
      carrierFee: carrierFee ?? order.carrier_fee,
      originContact: order.origin_contact,
      destContact: order.dest_contact,
      carrierName: order.carrier_name,
      carrierMc: order.carrier_mc,
      carrierCompanyPhone: order.carrier_company_phone,
      carrierEmail: order.carrier_email,
      driverName: order.driver_name,
      carrierPhone: order.carrier_phone,
      paymentMethod: order.payment_method,
    });
    if (missing) {
      return c.redirect(`/admin/orders?error=${encodeURIComponent(missing)}&error_order=${id}#order-${id}`, 303);
    }
  }

  // Booking at a lower negotiated price: keep the original for the discount line.
  if (status === "confirmed" && order && order.final_quote !== null && order.final_quote < order.price) {
    await c.env.DB.prepare("UPDATE orders SET original_price = COALESCE(original_price, ?), price = ? WHERE id = ?")
      .bind(order.price, order.final_quote, id)
      .run();
  }

  await setStatus(
    c.env.DB,
    id,
    status,
    user.email,
    [note, pickupNote, etaNote, deliveryNote, deliveredNote, paidNote, finalNote, brokerNote, carrierNote]
      .filter(Boolean)
      .join(" · "),
    pickedUpAt,
    pickupEta,
    deliveryEta,
    deliveredAt,
    paidAmount,
    paymentMethod,
  );
  if (hasFinal) {
    await c.env.DB.prepare("UPDATE orders SET final_quote = ? WHERE id = ?").bind(finalQuote, id).run();
  }
  if (hasBroker) {
    await c.env.DB.prepare("UPDATE orders SET broker_fee = ? WHERE id = ?").bind(brokerFee, id).run();
  }
  if (hasCarrier) {
    await c.env.DB.prepare("UPDATE orders SET carrier_fee = ? WHERE id = ?").bind(carrierFee, id).run();
  }
  if (order) {
    const fromLabel = isOrderStatus(order.status) ? STATUS_LABELS[order.status] : order.status;
    notify(
      c,
      `${STATUS_EMOJI[status] ?? "🔄"} Order ${order.number} status\n${fromLabel} → ${STATUS_LABELS[status]}\nby ${user.email}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
    );
  }
  // Land on the tab the order now belongs to, scrolled to the order itself.
  const destination = `/admin/orders?status=${status}#order-${id}`;
  if (c.req.header("x-async") === "1") return c.json({ ok: true, redirect: destination });
  return c.redirect(destination, 303);
});

const PAYMENT_METHODS = ["Zelle", "Venmo", "CashApp", "PayPal", "ACH", "Wire"];

const ORDER_FIELD_LABELS: Record<string, string> = {
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
  ready_date: "Pickup date",
  distance_miles: "Distance",
  price: "Price",
  final_quote: "Final quote",
  broker_fee: "Broker fee",
  carrier_fee: "Carrier fee",
  notes: "Customer notes",
  carrier_name: "Carrier company",
  carrier_mc: "MC number",
  carrier_company_phone: "Company phone",
  carrier_email: "Company email",
  driver_name: "Driver name",
  carrier_phone: "Driver phone",
  paid_amount: "Paid amount",
  payment_method: "Payment method",
  payment_state: "Payment status",
  picked_up_at: "Picked up at",
  pickup_eta: "Pickup ETA",
  delivery_eta: "Delivery ETA",
  delivered_at: "Delivered at",
};

function formatOrderField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "condition") return conditionLabel(String(value));
  if (key === "transport_type") return value === "enclosed" ? "Enclosed trailer" : "Open trailer";
  if (key === "distance_miles") return `${Number(value).toLocaleString()} mi`;
  if (key === "price" || key === "paid_amount" || key === "final_quote" || key === "broker_fee" || key === "carrier_fee") {
    return `$${Number(value).toLocaleString()}`;
  }
  if (key === "picked_up_at" || key === "pickup_eta" || key === "delivery_eta" || key === "delivered_at") {
    return when(Number(value));
  }
  return String(value);
}

type FieldGroup = {
  label: string;
  columns: string[];
  parse: (body: Record<string, string | File>) => Record<string, unknown> | null;
};

function fieldText(body: Record<string, string | File>, name: string): string {
  return String(body[name] ?? "").trim();
}

function numberField(body: Record<string, string | File>, name: string): Record<string, unknown> | null {
  const raw = fieldText(body, name);
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? { [name]: Math.round(number) } : null;
}

function datetimeField(body: Record<string, string | File>, name: string): Record<string, unknown> | null {
  if (fieldText(body, `${name}_clear`) === "1") return { [name]: null };
  // Saving always stores what the selects show; "Clear" removes the value.
  const parsed = parseDateTime(body, name);
  return parsed === null ? null : { [name]: parsed };
}

function contactFields(body: Record<string, string | File>, prefix: "origin" | "dest"): Record<string, unknown> {
  return {
    [`${prefix}_contact`]: fieldText(body, `${prefix}_contact`) || null,
    [`${prefix}_phone`]: fieldText(body, `${prefix}_phone`) || null,
  };
}

function addressFields(body: Record<string, string | File>, prefix: "origin" | "dest"): Record<string, unknown> | null {
  const zip = fieldText(body, `${prefix}_zip`);
  if (!ZIP_PATTERN.test(zip)) return null;
  return {
    [`${prefix}_street`]: fieldText(body, `${prefix}_street`) || null,
    [`${prefix}_city`]: fieldText(body, `${prefix}_city`) || null,
    [`${prefix}_state`]: stateCode(fieldText(body, `${prefix}_state`)) || null,
    [`${prefix}_zip`]: zip,
  };
}

/** One editable block per row of the order modal. Columns are a fixed whitelist. */
const ORDER_FIELD_GROUPS: Record<string, FieldGroup> = {
  customer: {
    label: "Customer",
    columns: ["customer_name", "customer_email", "customer_phone"],
    parse: (body) => {
      const name = fieldText(body, "customer_name");
      const email = fieldText(body, "customer_email");
      const phone = fieldText(body, "customer_phone");
      if (!name || !phone || !EMAIL_PATTERN.test(email)) return null;
      return { customer_name: name, customer_email: email, customer_phone: phone };
    },
  },
  vehicle: {
    label: "Vehicle",
    columns: ["vehicle_year", "vehicle_make", "vehicle_model", "transport_type", "condition"],
    parse: (body) => ({
      vehicle_year: fieldText(body, "vehicle_year") || null,
      vehicle_make: fieldText(body, "vehicle_make") || null,
      vehicle_model: fieldText(body, "vehicle_model") || null,
      transport_type: fieldText(body, "transport_type") === "enclosed" ? "enclosed" : "open",
      condition: parseCondition(fieldText(body, "condition") || "running"),
    }),
  },
  vin: { label: "VIN", columns: ["vin"], parse: (body) => ({ vin: fieldText(body, "vin") || null }) },
  origin_address: {
    label: "Pickup address",
    columns: ["origin_street", "origin_city", "origin_state", "origin_zip"],
    parse: (body) => addressFields(body, "origin"),
  },
  origin_contact: {
    label: "Pickup contact",
    columns: ["origin_contact", "origin_phone"],
    parse: (body) => contactFields(body, "origin"),
  },
  dest_address: {
    label: "Delivery address",
    columns: ["dest_street", "dest_city", "dest_state", "dest_zip"],
    parse: (body) => addressFields(body, "dest"),
  },
  dest_contact: {
    label: "Delivery contact",
    columns: ["dest_contact", "dest_phone"],
    parse: (body) => contactFields(body, "dest"),
  },
  picked_up_at: { label: "Picked up at", columns: ["picked_up_at"], parse: (body) => datetimeField(body, "picked_up_at") },
  pickup_eta: { label: "Pickup ETA", columns: ["pickup_eta"], parse: (body) => datetimeField(body, "pickup_eta") },
  delivery_eta: { label: "Delivery ETA", columns: ["delivery_eta", "dest_tz"], parse: (body) => datetimeField(body, "delivery_eta") },
  delivered_at: { label: "Delivered at", columns: ["delivered_at"], parse: (body) => datetimeField(body, "delivered_at") },
  paid_amount: {
    label: "Paid amount",
    columns: ["paid_amount"],
    parse: (body) => ({ paid_amount: moneyOrNull(fieldText(body, "paid_amount")) }),
  },
  payment_state: {
    label: "Payment status",
    columns: ["payment_state"],
    parse: (body) => {
      const state = fieldText(body, "payment_state");
      return { payment_state: ["unpaid", "partial", "full"].includes(state) ? state : "unpaid" };
    },
  },
  payment_method: {
    label: "Payment method",
    columns: ["payment_method"],
    parse: (body) => {
      const method = fieldText(body, "payment_method");
      return { payment_method: PAYMENT_METHODS.includes(method) ? method : null };
    },
  },
  ready_date: {
    label: "Pickup date",
    columns: ["ready_date"],
    parse: (body) => {
      const date = fieldText(body, "ready_date");
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { ready_date: date || null };
    },
  },
  distance_miles: { label: "Distance", columns: ["distance_miles"], parse: (body) => numberField(body, "distance_miles") },
  price: { label: "Price", columns: ["price"], parse: (body) => numberField(body, "price") },
  final_quote: {
    label: "Final quote",
    columns: ["final_quote"],
    parse: (body) => ({ final_quote: moneyOrNull(fieldText(body, "final_quote")) }),
  },
  broker_fee: {
    label: "Broker fee",
    columns: ["broker_fee"],
    parse: (body) => ({ broker_fee: moneyOrNull(fieldText(body, "broker_fee")) }),
  },
  carrier_fee: {
    label: "Carrier fee",
    columns: ["carrier_fee"],
    parse: (body) => ({ carrier_fee: moneyOrNull(fieldText(body, "carrier_fee")) }),
  },
  carrier: {
    label: "Carrier",
    columns: ["carrier_name", "carrier_mc", "carrier_company_phone", "carrier_email", "driver_name", "carrier_phone"],
    parse: (body) => ({
      carrier_name: fieldText(body, "carrier_name") || null,
      carrier_mc: fieldText(body, "carrier_mc") || null,
      carrier_company_phone: fieldText(body, "carrier_company_phone") || null,
      carrier_email: fieldText(body, "carrier_email") || null,
      driver_name: fieldText(body, "driver_name") || null,
      carrier_phone: fieldText(body, "carrier_phone") || null,
    }),
  },
  notes: { label: "Customer notes", columns: ["notes"], parse: (body) => ({ notes: fieldText(body, "notes") || null }) },
};

app.post("/admin/orders/:id/field", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const old = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!old) return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const requested = String(body.next ?? "");
  const back = requested.startsWith("/admin") ? requested : `/admin/orders#order-${id}`;
  const key = String(body.field ?? "");
  const group = Object.hasOwn(ORDER_FIELD_GROUPS, key) ? ORDER_FIELD_GROUPS[key] : undefined;
  if (!group) return c.redirect(back, 303);

  // Times are typed as wall-clock where the car is, not where dispatch sits.
  const originZone = old.dest_tz && key === "delivery_eta" ? old.dest_tz : stateTimezone(old.origin_state);
  const destZone = old.dest_tz ?? stateTimezone(old.dest_state);
  const values =
    key === "delivery_eta" || key === "pickup_eta"
      ? (() => {
          if (fieldText(body, `${key}_clear`) === "1") return { [key]: null } as Record<string, unknown>;
          const zone = key === "delivery_eta" ? destZone : originZone;
          const parsed = parseDateTime(body, key, zone);
          if (parsed === null) return null;
          return key === "delivery_eta"
            ? ({ delivery_eta: parsed, dest_tz: destZone } as Record<string, unknown>)
            : ({ pickup_eta: parsed } as Record<string, unknown>);
        })()
      : group.parse(body);
  if (!values) return c.redirect(back, 303);

  const oldRecord = old as unknown as Record<string, unknown>;
  const changes = group.columns
    .filter((column) => {
      const before = column === "condition" ? parseCondition(String(oldRecord[column] ?? "running")) : oldRecord[column];
      return String(before ?? "") !== String(values[column] ?? "");
    })
    .map((column) => {
      const before = column === "condition" ? parseCondition(String(oldRecord[column] ?? "running")) : oldRecord[column];
      return `${ORDER_FIELD_LABELS[column] ?? column}: ${formatOrderField(column, before)} → ${formatOrderField(column, values[column])}`;
    });
  // Phone columns are normalised on the way in, so the database is consistent
  // whether the value came from a form, a paste or the API.
  for (const column of ["customer_phone", "origin_phone", "dest_phone", "carrier_phone", "carrier_company_phone"]) {
    if (values && typeof values[column] === "string") values[column] = formatPhone(values[column] as string);
  }

  const async = c.req.header("x-async") === "1";

  // Timestamps that record something that already happened cannot be in the future.
  const futureGuard: Record<string, string> = {
    picked_up_at: "The pickup date cannot be in the future.",
    delivered_at: "The delivery date cannot be in the future.",
  };
  if (values && futureGuard[key]) {
    const value = values[key];
    if (typeof value === "number" && value > Date.now() + 60000) {
      const message = futureGuard[key] as string;
      if (async) {
        const current = await loadOrderCardData(c.env.DB, id);
        return c.html(orderModalCard(old, current.photos, current.events, message, current.units, current.contracts));
      }
      return c.redirect(`/admin/orders?error=${encodeURIComponent(message)}&error_order=${id}#order-${id}`, 303);
    }
  }

  // A carrier is either fully on the order or not at all — no half-assigned trucks.
  if (key === "carrier") {
    const carrierFields: [string, string][] = [
      ["carrier_name", "company name"],
      ["carrier_mc", "MC number"],
      ["carrier_company_phone", "company phone"],
      ["carrier_email", "company email"],
      ["driver_name", "driver name"],
      ["carrier_phone", "driver phone"],
    ];
    const blank = carrierFields.filter(([column]) => !String(values[column] ?? "").trim());
    if (blank.length) {
      const message = `Carrier not saved — add the ${blank.map(([, label]) => label).join(", ")}.`;
      if (async) {
        const partial = await loadOrderCardData(c.env.DB, id);
        return c.html(orderModalCard(old, partial.photos, partial.events, message, partial.units, partial.contracts));
      }
      return c.redirect(`/admin/orders?error=${encodeURIComponent(message)}&error_order=${id}#order-${id}`, 303);
    }
  }

  if (!changes.length) {
    // Nothing changed: still answer with the card so the modal never gets a redirect.
    if (async) {
      const unchanged = await loadOrderCardData(c.env.DB, id);
      return c.html(orderModalCard(old, unchanged.photos, unchanged.events, undefined, unchanged.units, unchanged.contracts));
    }
    return c.redirect(back, 303);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE orders SET ${group.columns.map((column) => `${column} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
  )
    .bind(...group.columns.map((column) => values[column]), now, id)
    .run();

  // Total price is always broker + carrier, so the order price follows the fees.
  if (key === "broker_fee" || key === "carrier_fee") {
    await c.env.DB.prepare(
      "UPDATE orders SET price = COALESCE(broker_fee, 0) + COALESCE(carrier_fee, 0) WHERE id = ?",
    )
      .bind(id)
      .run();
  }

  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)",
  )
    .bind(id, `${group.label} updated — ${changes.join("; ")}`, user.email, now)
    .run();

  notify(
    c,
    `✏️ Order ${old.number} edited\nby ${user.email}\n${changes.join("; ")}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
  );

  // The modal saves in place: send back just this card instead of the whole orders page.
  if (async) {
    const card = await loadOrderCardData(c.env.DB, id);
    // Reuse the row we already read instead of asking D1 for it again.
    const order = { ...old, ...values } as OrderRow;
    return c.html(orderModalCard(order, card.photos, card.events, undefined, card.units, card.contracts));
  }

  return c.redirect(back, 303);
});

/** Mark one invoice as paid; the order's payment state follows from the two invoices. */
app.post("/admin/orders/:id/invoice/:kind/paid", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const kind = c.req.param("kind") === "carrier" ? "carrier" : "client";
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const now = Date.now();
  const paidAmount =
    kind === "carrier"
      ? (order.carrier_invoice_amount ?? order.carrier_fee ?? 0)
      : (order.client_invoice_amount ?? order.final_quote ?? order.price);
  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, kind, note, actor, created_at, amount) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      `invoice_${kind}_paid`,
      `${kind === "carrier" ? "Carrier" : "Client"} invoice paid — ${paidAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
      user.email,
      now,
      paidAmount,
    )
    .run();

  const { results: events } = await c.env.DB.prepare("SELECT kind FROM order_events WHERE order_id = ?").bind(id).all<{
    kind: string;
  }>();
  const clientPaid = events.some((event) => event.kind === "invoice_client_paid");
  const carrierPaid = events.some((event) => event.kind === "invoice_carrier_paid");
  const state = clientPaid && carrierPaid ? "full" : clientPaid || carrierPaid ? "partial" : "unpaid";
  await c.env.DB.prepare("UPDATE orders SET payment_state = ?, updated_at = ? WHERE id = ?").bind(state, now, id).run();

  notify(c, `💰 Invoice paid on ${order.number}\n${kind === "carrier" ? "Carrier" : "Client"} invoice\nby ${user.email}`);
  return c.redirect(`/admin/orders?status=paid#order-${id}`, 303);
});

/** Add, edit or delete a vehicle on an order; the order price follows the units. */
async function recalcOrderPrice(db: D1Database, orderId: number): Promise<void> {
  const { results } = await db.prepare("SELECT price FROM order_units WHERE order_id = ?").bind(orderId).all<{ price: number | null }>();
  if (!results.length) return;
  const total = results.reduce((sum, row) => sum + (row.price ?? 0), 0);
  await db.prepare("UPDATE orders SET price = ?, updated_at = ? WHERE id = ?").bind(total, Date.now(), orderId).run();
}

app.post("/admin/orders/:id/units/add", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const text = (key: string) => String(body[key] ?? "").trim();
  const { results: existing } = await c.env.DB.prepare("SELECT position FROM order_units WHERE order_id = ? ORDER BY position DESC LIMIT 1")
    .bind(id)
    .all<{ position: number }>();
  const position = (existing[0]?.position ?? 0) + 1;
  const condition = parseCondition(text("condition") || "running");
  const transport: TransportType = order.transport_type === "enclosed" ? "enclosed" : "open";
  const price = order.distance_miles ? priceQuote(order.distance_miles, transport, condition, false).total : null;

  await c.env.DB.prepare(
    `INSERT INTO order_units (order_id, position, vehicle_year, vehicle_make, vehicle_model, vin, vehicle_type, condition, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, position, text("vehicle_year") || null, text("vehicle_make") || null, text("vehicle_model") || null, text("vin") || null, transport, condition, price, Date.now())
    .run();

  await c.env.DB.prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)")
    .bind(id, `Vehicle ${position} added`, user.email, Date.now())
    .run();
  await recalcOrderPrice(c.env.DB, id);
  return c.redirect(`/admin/orders#order-${id}`, 303);
});

app.post("/admin/orders/:id/units/:unitId", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const unitId = Number(c.req.param("unitId"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const text = (key: string) => String(body[key] ?? "").trim();
  const condition = parseCondition(text("condition") || "running");
  const transport: TransportType = order.transport_type === "enclosed" ? "enclosed" : "open";
  // A price typed by dispatch wins; otherwise price it from the lane.
  const typedPrice = Number(text("price"));
  const price = Number.isFinite(typedPrice) && text("price") !== ""
    ? Math.max(0, Math.round(typedPrice))
    : order.distance_miles
      ? priceQuote(order.distance_miles, transport, condition, false).total
      : null;

  await c.env.DB.prepare(
    `UPDATE order_units SET vehicle_year = ?, vehicle_make = ?, vehicle_model = ?, vin = ?, condition = ?, price = ? WHERE id = ? AND order_id = ?`,
  )
    .bind(text("vehicle_year") || null, text("vehicle_make") || null, text("vehicle_model") || null, text("vin") || null, condition, price, unitId, id)
    .run();

  await c.env.DB.prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)")
    .bind(id, `Vehicle ${unitId} updated`, user.email, Date.now())
    .run();
  await recalcOrderPrice(c.env.DB, id);
  return c.redirect(`/admin/orders#order-${id}`, 303);
});

app.post("/admin/orders/:id/units/:unitId/delete", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const unitId = Number(c.req.param("unitId"));
  const unit = await c.env.DB.prepare("SELECT position FROM order_units WHERE id = ? AND order_id = ?").bind(unitId, id).first<{ position: number }>();

  await c.env.DB.prepare("DELETE FROM order_units WHERE id = ? AND order_id = ?").bind(unitId, id).run();

  // keep the numbering contiguous after a removal
  const { results: left } = await c.env.DB.prepare("SELECT id FROM order_units WHERE order_id = ? ORDER BY position").bind(id).all<{ id: number }>();
  await c.env.DB.batch(
    left.map((row, index) => c.env.DB.prepare("UPDATE order_units SET position = ? WHERE id = ?").bind(index + 1, row.id)),
  );
  await c.env.DB.prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)")
    .bind(id, `Vehicle ${unit?.position ?? ""} removed`.trim(), user.email, Date.now())
    .run();
  await recalcOrderPrice(c.env.DB, id);
  return c.redirect(`/admin/orders#order-${id}`, 303);
});

/** The order modal body, fetched when a row is opened. */
/**
 * Finds deliveries inside the 24h and 2h windows and claims each reminder once
 * by inserting an event row; a failed insert means someone else already fired it.
 */
async function collectDeliveryReminders(db: D1Database, now: number): Promise<
  { id: number; number: string; customer_name: string; delivery_eta: number; window: "24h" | "2h" }[]
> {
  // `from` keeps the 24h reminder from firing late on a delivery that is already
  // inside the 2h window — nobody wants both at once.
  const windows: { kind: string; window: "24h" | "2h"; from: number; limit: number }[] = [
    { kind: "reminder_24h", window: "24h", from: 2 * 3600000, limit: 24 * 3600000 },
    { kind: "reminder_2h", window: "2h", from: 0, limit: 2 * 3600000 },
  ];

  const claimed: { id: number; number: string; customer_name: string; delivery_eta: number; window: "24h" | "2h" }[] = [];

  for (const rule of windows) {
    const { results } = await db
      .prepare(
        `SELECT o.id, o.number, o.customer_name, o.delivery_eta
           FROM orders o
          WHERE o.delivery_eta IS NOT NULL
            AND o.delivery_eta > ?
            AND o.delivery_eta <= ?
            AND o.status IN ('confirmed', 'contract_draft', 'assigned', 'picked_up')
            AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.kind = ?)
          LIMIT 5`,
      )
      .bind(now + rule.from, now + rule.limit, rule.kind)
      .all<{ id: number; number: string; customer_name: string; delivery_eta: number }>();

    for (const order of results) {
      const claim = await db
        .prepare(
          `INSERT INTO order_events (order_id, kind, note, actor, created_at)
           SELECT ?, ?, ?, 'system', ?
            WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = ? AND kind = ?)`,
        )
        .bind(
          order.id,
          rule.kind,
          `Delivery ${rule.window === "24h" ? "in 24 hours" : "in 2 hours"}`,
          now,
          order.id,
          rule.kind,
        )
        .run();
      if ((claim.meta.changes ?? 0) === 0) continue;
      claimed.push({ ...order, window: rule.window });
    }
  }

  return claimed;
}

/**
 * Live inbox stream. Workers cannot hold a socket open indefinitely, so the stream
 * lives ~27s, checks D1 every 3s, then closes and lets EventSource reconnect.
 */
app.get("/admin/api/stream", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.text("unauthorized", 401);

  let cursor = Number(c.req.query("since")) || 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const deadline = Date.now() + 27000;
      const push = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      try {
        while (Date.now() < deadline) {
          const { results } = await c.env.DB.prepare(
            "SELECT id, number, customer_name, origin_zip, dest_zip, price, created_at FROM orders WHERE status = 'quoted' AND created_at > ? ORDER BY created_at LIMIT 20",
          )
            .bind(cursor)
            .all<{ id: number; number: string; customer_name: string; origin_zip: string; dest_zip: string; price: number; created_at: number }>();

          if (results.length) {
            cursor = results[results.length - 1]!.created_at;
            push({ quotes: results, cursor });
          } else {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }

          // Delivery reminders: once at T-24h, once at T-2h. The event row is the lock,
          // so two open tabs cannot both fire the same reminder.
          const now = Date.now();
          const reminders = await collectDeliveryReminders(c.env.DB, now);
          if (reminders.length) push({ reminders });

          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch {
        // stream ends; the browser reconnects
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
});

/** Signed contract uploads: max 3 per order, stored in KV like the photos. */
const MAX_CONTRACTS = 3;
const CONTRACT_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
]);

app.post("/admin/orders/:id/contracts", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const back = `/admin/orders#order-${id}`;
  const form = await c.req.formData();
  const file = form.get("contract");
  if (!(file instanceof File) || file.size === 0) return c.redirect(back, 303);

  const { results: existing } = await c.env.DB.prepare("SELECT id FROM order_contracts WHERE order_id = ?")
    .bind(id)
    .all<{ id: number }>();
  if (existing.length >= MAX_CONTRACTS) return c.redirect(`${back}`, 303);
  if (file.size > 10 * 1024 * 1024) return c.redirect(back, 303);
  const extension = CONTRACT_TYPES.get(file.type);
  if (!extension) return c.redirect(back, 303);

  const key = `contracts/${id}/${crypto.randomUUID()}.${extension}`;
  await c.env.UPLOADS.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  await c.env.DB.prepare(
    "INSERT INTO order_contracts (order_id, filename, content_type, size, storage_key, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, file.name || `contract.${extension}`, file.type, file.size, key, user.email, Date.now())
    .run();
  await c.env.DB.prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)")
    .bind(id, `Signed contract uploaded: ${file.name || extension}`, user.email, Date.now())
    .run();

  notify(c, `📄 Signed contract uploaded on order ${id}\nby ${user.email}`);
  return c.redirect(back, 303);
});

app.post("/admin/orders/:id/contracts/:contractId/delete", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const contractId = Number(c.req.param("contractId"));
  const row = await c.env.DB.prepare("SELECT storage_key, filename FROM order_contracts WHERE id = ? AND order_id = ?")
    .bind(contractId, id)
    .first<{ storage_key: string; filename: string }>();

  if (row) {
    await c.env.UPLOADS.delete(row.storage_key);
    await c.env.DB.prepare("DELETE FROM order_contracts WHERE id = ? AND order_id = ?").bind(contractId, id).run();
    await c.env.DB.prepare("INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, 'edited', ?, ?, ?)")
      .bind(id, `Signed contract removed: ${row.filename}`, user.email, Date.now())
      .run();
  }
  return c.redirect(`/admin/orders#order-${id}`, 303);
});

app.get("/admin/order-contracts/:contractId", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const contractId = Number(c.req.param("contractId"));
  const row = await c.env.DB.prepare("SELECT storage_key, content_type, filename FROM order_contracts WHERE id = ?")
    .bind(contractId)
    .first<{ storage_key: string; content_type: string | null; filename: string }>();
  if (!row) return c.html(notFoundPage(), 404);

  const object = await c.env.UPLOADS.get(row.storage_key, "arrayBuffer");
  if (!object) return c.html(notFoundPage(), 404);

  return new Response(object, {
    headers: {
      "content-type": row.content_type || "application/octet-stream",
      "content-disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
});

/** History table for the order card, fetched when the plus is pressed. */
app.get("/admin/orders/:id/history", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.html(notFoundPage(), 404);

  const id = Number(c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id")
    .bind(id)
    .all<OrderEventRow>();
  return c.html(historyTable(results));
});

/** Everything the order card needs, in a single D1 round trip. */
async function loadOrderCardData(db: D1Database, id: number) {
  const [photos, events, units, contracts] = await db.batch([
    db.prepare("SELECT * FROM order_photos WHERE order_id = ? ORDER BY id").bind(id),
    db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id").bind(id),
    db.prepare("SELECT * FROM order_units WHERE order_id = ? ORDER BY position").bind(id),
    db.prepare("SELECT * FROM order_contracts WHERE order_id = ? ORDER BY id").bind(id),
  ]);
  return {
    photos: (photos?.results ?? []) as OrderPhotoRow[],
    events: (events?.results ?? []) as OrderEventRow[],
    units: (units?.results ?? []) as OrderUnitRow[],
    contracts: (contracts?.results ?? []) as OrderContractRow[],
  };
}

app.get("/admin/orders/:id/modal", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.html(notFoundPage(), 404);

  const id = Number(c.req.param("id"));
  const [order, card] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>(),
    loadOrderCardData(c.env.DB, id),
  ]);
  if (!order) return c.html(notFoundPage(), 404);

  return c.html(orderModalCard(order, card.photos, card.events, c.req.query("error"), card.units, card.contracts));
});

/** Draft contract: printable, and downloadable when ?download=1. */
app.get("/admin/orders/:id/contract", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const { results: units } = await c.env.DB.prepare("SELECT * FROM order_units WHERE order_id = ? ORDER BY position")
    .bind(id)
    .all<OrderUnitRow>();

  if (c.req.query("download") === "1") {
    if (c.req.query("format") === "html") {
      return c.body(contractDocument(order, units), 200, {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="Transportation-Agreement-${order.number}.html"`,
      });
    }
    // Word by default: dispatch edits these in Word before sending them out.
    const docx = contractDocx(order, units);
    return c.body(docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer, 200, {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="Transportation-Agreement-${order.number}.docx"`,
    });
  }
  return c.html(contractDocument(order, units));
});

/** Send the client or carrier invoice for a paid order. */
app.post("/admin/orders/:id/invoice/:kind/send", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const id = Number(c.req.param("id"));
  const kind = c.req.param("kind") === "carrier" ? "carrier" : "client";
  const fail = (message: string) =>
    c.redirect(`/admin/orders?status=paid&error_order=${id}&error=${encodeURIComponent(message)}#order-${id}`, 303);

  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!order) return c.html(notFoundPage(), 404);

  const to = kind === "carrier" ? order.carrier_email : order.customer_email;
  if (!to) {
    return fail(
      kind === "carrier"
        ? "Add the carrier email on this order before sending the carrier invoice."
        : "This order has no customer email.",
    );
  }

  const body = await c.req.parseBody();
  const amount = moneyOrNull(body.amount);
  if (amount === null) return fail("Enter the invoice amount before sending.");

  const method = String(body.method ?? "").trim();
  await c.env.DB.prepare(
    `UPDATE orders SET ${kind === "client" ? "client_invoice_amount" : "carrier_invoice_amount"} = ?, ${
      kind === "client" ? "client_invoice_method" : "carrier_invoice_method"
    } = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(amount, method || null, Date.now(), id)
    .run();

  const origin = new URL(c.req.url).origin;
  const day = (value: number | null) =>
    value ? new Date(value).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }) : "";
  const { results: units } = await c.env.DB.prepare("SELECT * FROM order_units WHERE order_id = ? ORDER BY position")
    .bind(id)
    .all<OrderUnitRow>();
  const mail = buildInvoiceMail(
    {
      ...order,
      units,
      invoice_amount: amount,
      track_url: `${origin}/track/${order.token}`,
      logo_url: `${origin}/logo.png`,
      issued_on: day(Date.now()),
      delivered_on: day(order.delivered_at ?? order.delivery_eta),
    },
    kind,
  );

  try {
    await sendMail(c.env, { to, subject: mail.subject, html: mail.html });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not send the invoice.");
  }

  const now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, kind, note, actor, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, `invoice_${kind}`, `${kind === "carrier" ? "Carrier" : "Client"} invoice emailed to ${to}`, user.email, now)
    .run();

  return c.redirect(`/admin/orders?status=paid#order-${id}`, 303);
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
  const paymentMethod = PAYMENT_METHODS.includes(methodRaw) ? methodRaw : null;

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
    final_quote: moneyOrNull(text("final_quote")),
    broker_fee: moneyOrNull(text("broker_fee")),
    carrier_fee: moneyOrNull(text("carrier_fee")),
    notes: text("notes") || null,
    carrier_name: text("carrier_name") || null,
    carrier_mc: text("carrier_mc") || null,
    carrier_company_phone: text("carrier_company_phone") || null,
    carrier_email: text("carrier_email") || null,
    driver_name: text("driver_name") || null,
    carrier_phone: text("carrier_phone") || null,
    paid_amount: paidAmount,
    payment_method: paymentMethod,
    picked_up_at:
      text("edit_picked_up_set") === "1" ? (parseDateTime(body, "edit_picked_up") ?? old.picked_up_at) : null,
    pickup_eta:
      text("edit_pickup_eta_set") === "1" ? (parseDateTime(body, "edit_pickup_eta") ?? old.pickup_eta) : null,
    delivery_eta:
      text("edit_delivery_eta_set") === "1" ? (parseDateTime(body, "edit_delivery_eta") ?? old.delivery_eta) : null,
    delivered_at:
      text("edit_delivered_set") === "1" ? (parseDateTime(body, "edit_delivered") ?? old.delivered_at) : null,
  };

  const changes: string[] = [];
  const oldRecord = old as unknown as Record<string, unknown>;
  for (const key of Object.keys(newValues) as (keyof typeof newValues)[]) {
    let before = oldRecord[key];
    if (key === "condition") before = parseCondition(String(before ?? "running"));
    const after = newValues[key];
    if (String(before ?? "") !== String(after ?? "")) {
      changes.push(`${ORDER_FIELD_LABELS[key] ?? key}: ${formatOrderField(key, before)} → ${formatOrderField(key, after)}`);
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
      ready_date=?, distance_miles=?, price=?, final_quote=?, broker_fee=?, carrier_fee=?, notes=?,
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
      newValues.final_quote,
      newValues.broker_fee,
      newValues.carrier_fee,
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
    `✏️ Order ${old.number} edited\nby ${user.email}\n${changes.join("; ")}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
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
      `🚚 Carrier assigned\n${order.number} · ${name}${mc ? ` (${mc})` : ""}\nby ${user.email}\n${new URL(c.req.url).origin}/admin/orders#order-${id}`,
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

app.get("/admin/staff", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);

  const period = parseStaffPeriod(c.req.query("period"));
  const metric = parseStaffMetric(c.req.query("metric"));
  const [data, trends, marketing] = await Promise.all([
    loadStaffPerformance(c.env.DB, period, metric),
    loadRevenueTrends(c.env.DB),
    loadAdsShare(c.env.DB),
  ]);
  return c.html(staffPerformancePage(data, user, trends, marketing));
});

app.post("/admin/staff/marketing", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const read = (key: string, fallback: number) => {
    const value = Number(String(body[key] ?? "").trim());
    return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value * 10) / 10 : fallback;
  };

  await setSetting(c.env.DB, "ads_percent", String(read("ads_percent", 15)));
  await setSetting(c.env.DB, "tax_percent", String(read("tax_percent", 17)));
  return c.redirect("/admin/staff", 303);
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

app.get("/admin/telegram", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const stored = await getSetting(c.env.DB, "telegram_chat_id").catch(() => null);
  const targets = await telegramTargets(c.env, c.env.DB);

  let chats: Array<{ id: string; type: string; title: string; last: number }> = [];
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
      const payload = (await response.json()) as {
        ok?: boolean;
        result?: Array<{ message?: { chat?: { id: number; type: string; title?: string; username?: string; first_name?: string }; date?: number } }>;
      };
      if (payload.ok && payload.result) {
        const seen = new Map<string, { id: string; type: string; title: string; last: number }>();
        for (const update of payload.result) {
          const chat = update.message?.chat;
          if (!chat) continue;
          const id = String(chat.id);
          const title = chat.title ?? chat.username ?? chat.first_name ?? "(no name)";
          seen.set(id, { id, type: chat.type, title, last: update.message?.date ?? 0 });
        }
        chats = [...seen.values()].sort((a, b) => b.last - a.last);
      }
    } catch {
      chats = [];
    }
  }

  return c.html(telegramPage(targets.join(", "), !stored, chats));
});

app.post("/admin/telegram", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const body = await c.req.parseBody();
  const raw = String(body.chat_id ?? "").trim();
  const ids = parseChatIds(raw);
  if (ids.length === 0) {
    return c.html(telegramPage(raw, false, [], undefined, "That does not look like a chat ID."), 400);
  }

  await setSetting(c.env.DB, "telegram_chat_id", ids.join(","));
  return c.redirect("/admin/telegram", 303);
});

app.post("/admin/telegram/test", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  if (user.role !== "admin") return c.html(notFoundPage(), 404);

  const sent = await sendTelegram(c.env, c.env.DB, "🧪 Test message from the Bond Auto Transport console.");
  const targets = await telegramTargets(c.env, c.env.DB);
  return c.html(
    telegramPage(
      targets.join(", "),
      false,
      [],
      sent ? `Test message sent to ${targets.length} chat${targets.length === 1 ? "" : "s"}.` : undefined,
      sent ? undefined : "Telegram rejected the message. Check the bot token and that the bot is in that chat.",
    ),
  );
});

/**
 * Calendar subscription: Apple, Google and Outlook can all follow an .ics URL.
 * The token in the path is the credential, because calendar apps cannot log in.
 */
app.get("/calendar/:file", async (c) => {
  const file = c.req.param("file");
  if (!file.endsWith(".ics")) return c.html(notFoundPage(), 404);
  const token = file.slice(0, -4);
  const expected = await getSetting(c.env.DB, "calendar_token").catch(() => null);
  if (!expected || token !== expected) return c.html(notFoundPage(), 404);

  const horizon = Date.now() + 120 * 24 * 3600000;
  const { results } = await c.env.DB.prepare(
    `SELECT id, number, customer_name, origin_zip, dest_zip, carrier_name, pickup_eta, delivery_eta
       FROM orders
      WHERE status IN ('quoted', 'confirmed', 'contract_draft', 'assigned', 'picked_up')
        AND (pickup_eta IS NOT NULL OR delivery_eta IS NOT NULL)
        AND (COALESCE(delivery_eta, pickup_eta) >= ? AND COALESCE(pickup_eta, delivery_eta) <= ?)
      ORDER BY COALESCE(pickup_eta, delivery_eta)
      LIMIT 300`,
  )
    .bind(Date.now() - 7 * 24 * 3600000, horizon)
    .all<{
      id: number;
      number: string;
      customer_name: string;
      origin_zip: string;
      dest_zip: string;
      carrier_name: string | null;
      pickup_eta: number | null;
      delivery_eta: number | null;
    }>();

  const events: CalendarEvent[] = [];
  for (const order of results) {
    if (order.pickup_eta) {
      events.push({
        id: order.id,
        number: order.number,
        kind: "pickup",
        at: order.pickup_eta,
        customer: order.customer_name,
        origin: order.origin_zip,
        destination: order.dest_zip,
        carrier: order.carrier_name,
      });
    }
    if (order.delivery_eta) {
      events.push({
        id: order.id,
        number: order.number,
        kind: "delivery",
        at: order.delivery_eta,
        customer: order.customer_name,
        origin: order.origin_zip,
        destination: order.dest_zip,
        carrier: order.carrier_name,
      });
    }
  }

  return new Response(buildCalendar(events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="bondautotransport.ics"',
      "cache-control": "no-store",
    },
  });
});

/** Creates the subscription token once and returns it. */
async function calendarToken(db: D1Database): Promise<string> {
  const existing = await getSetting(db, "calendar_token").catch(() => null);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  await setSetting(db, "calendar_token", token);
  return token;
}

app.get("/admin/account", async (c) => {
  const user = await sessionUser(c);
  if (!user) return c.redirect("/admin/login", 303);
  const token = await calendarToken(c.env.DB);
  const origin = new URL(c.req.url).origin;
  return c.html(accountPage(user, undefined, undefined, { feed: `${origin}/calendar/${token}.ics`, webcal: `webcal://${origin.replace(/^https?:\/\//, "")}/calendar/${token}.ics` }));
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
