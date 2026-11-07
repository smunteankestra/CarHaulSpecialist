export const site = {
  name: "Car Haul Specialist",
  tagline: "Vehicle transport, dispatched properly.",
  phone: "(000) 000-0000",
  email: "dispatch@carhaulspecialist.com",
  hours: "Monday to Saturday, 8am – 8pm ET",
  mc: "MC #000000",
  dot: "DOT #000000",
};

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAV = [
  { href: "/services/open", label: "Open transport" },
  { href: "/services/enclosed", label: "Enclosed transport" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function layout(options: { title: string; description: string; body: string; canonical?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(options.title)}</title>
<meta name="description" content="${esc(options.description)}">
${options.canonical ? `<link rel="canonical" href="${esc(options.canonical)}">` : ""}
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MovingCompany",
    name: site.name,
    description: options.description,
    telephone: site.phone,
    email: site.email,
    areaServed: "United States",
    url: options.canonical ?? "/",
  })}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/">Car Haul <span>Specialist</span></a>
    <nav class="nav">
      ${NAV.map((item) => `<a href="${item.href}">${esc(item.label)}</a>`).join("")}
    </nav>
    <a class="btn btn-accent header-cta" href="/quote">Get a quote</a>
  </div>
</header>
<main>${options.body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-brand">Car Haul Specialist</p>
      <p class="muted">${esc(site.tagline)}</p>
      <p class="muted small">${esc(site.mc)} · ${esc(site.dot)}</p>
    </div>
    <div>
      <p class="footer-heading">Services</p>
      <a href="/services/open">Open transport</a>
      <a href="/services/enclosed">Enclosed transport</a>
      <a href="/services/expedited">Expedited pickup</a>
      <a href="/services/door-to-door">Door to door</a>
    </div>
    <div>
      <p class="footer-heading">Company</p>
      <a href="/how-it-works">How it works</a>
      <a href="/pricing">Pricing</a>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <p class="footer-heading">Reach dispatch</p>
      <a href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">${esc(site.phone)}</a>
      <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      <p class="muted small">${esc(site.hours)}</p>
      <p class="muted small"><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

export interface QuoteFormValues {
  name?: string;
  email?: string;
  phone?: string;
  origin_zip?: string;
  dest_zip?: string;
  transport_type?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  condition?: string;
  available_date?: string;
  notes?: string;
}

export function quoteForm(values: QuoteFormValues = {}, error?: string): string {
  const v = (key: keyof QuoteFormValues) => esc(values[key] ?? "");
  return `<form class="quote-form" method="post" action="/quote">
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
  <div class="field-row">
    <label class="field">
      <span>Pickup ZIP *</span>
      <input name="origin_zip" inputmode="numeric" maxlength="5" required value="${v("origin_zip")}" placeholder="e.g. 33101">
    </label>
    <label class="field">
      <span>Delivery ZIP *</span>
      <input name="dest_zip" inputmode="numeric" maxlength="5" required value="${v("dest_zip")}" placeholder="e.g. 10001">
    </label>
  </div>

  <div class="field-row">
    <label class="field">
      <span>Vehicle year</span>
      <input name="vehicle_year" maxlength="4" value="${v("vehicle_year")}" placeholder="2019">
    </label>
    <label class="field">
      <span>Make</span>
      <input name="vehicle_make" value="${v("vehicle_make")}" placeholder="Toyota">
    </label>
    <label class="field">
      <span>Model</span>
      <input name="vehicle_model" value="${v("vehicle_model")}" placeholder="Camry">
    </label>
  </div>

  <div class="field-row">
    <label class="field">
      <span>Transport</span>
      <select name="transport_type">
        <option value="open"${values.transport_type !== "enclosed" ? " selected" : ""}>Open trailer</option>
        <option value="enclosed"${values.transport_type === "enclosed" ? " selected" : ""}>Enclosed trailer</option>
      </select>
    </label>
    <label class="field">
      <span>Condition</span>
      <select name="condition">
        <option value="running"${values.condition !== "non-running" ? " selected" : ""}>Runs and drives</option>
        <option value="non-running"${values.condition === "non-running" ? " selected" : ""}>Not running</option>
      </select>
    </label>
    <label class="field">
      <span>Ready date</span>
      <input name="available_date" type="date" value="${v("available_date")}">
    </label>
  </div>

  <div class="field-row">
    <label class="field">
      <span>Your name *</span>
      <input name="name" required value="${v("name")}" autocomplete="name">
    </label>
    <label class="field">
      <span>Email *</span>
      <input name="email" type="email" required value="${v("email")}" autocomplete="email">
    </label>
    <label class="field">
      <span>Phone *</span>
      <input name="phone" required value="${v("phone")}" autocomplete="tel" placeholder="(305) 555-0134">
    </label>
  </div>

  <label class="field">
    <span>Anything we should know?</span>
    <textarea name="notes" rows="3" placeholder="Modifications, tight access, second vehicle…">${v("notes")}</textarea>
  </label>

  <button class="btn btn-accent btn-block" type="submit">See my price</button>
  <p class="form-note">No card needed. We quote from your route, then a dispatcher confirms the pickup window.</p>
</form>`;
}

export function homePage(): string {
  return layout({
    title: "Car Haul Specialist — vehicle transport with a real dispatch desk",
    description:
      "Instant vehicle shipping estimates for open and enclosed transport. Nationwide pickup, vetted carriers, and a dispatch team you can actually reach.",
    canonical: "/",
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Nationwide vehicle transport</p>
      <h1>Move a car without the runaround.</h1>
      <p class="lede">Get a real price from your route in under a minute, then a dispatcher confirms the pickup window. Open or enclosed, running or not, one car or a whole lot.</p>
      <ul class="ticks">
        <li>Instant estimate, no card required</li>
        <li>Vetted carriers with active insurance</li>
        <li>One dispatcher owns your order start to finish</li>
      </ul>
    </div>
    <div class="hero-card">
      <h2>Get your price</h2>
      ${quoteForm()}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap trust-row">
    <div><strong>${esc(site.mc)}</strong><span>Broker authority</span></div>
    <div><strong>${esc(site.dot)}</strong><span>Registered carrier network</span></div>
    <div><strong>48 states</strong><span>Pickup coverage</span></div>
    <div><strong>7 days</strong><span>Dispatch availability</span></div>
  </div>
</section>

<section class="wrap section">
  <h2 class="section-title">Three steps, no phone tag</h2>
  <ol class="steps">
    <li><span class="step-num">1</span><h3>Tell us the route</h3><p>Two ZIPs and the vehicle. That is enough to price it.</p></li>
    <li><span class="step-num">2</span><h3>Confirm the window</h3><p>A dispatcher calls or emails within one business hour with the pickup window and the carrier.</p></li>
    <li><span class="step-num">3</span><h3>Track it to the door</h3><p>You get the carrier, the driver contact and status updates until it is delivered.</p></li>
  </ol>
</section>

<section class="wrap section">
  <h2 class="section-title">What we move</h2>
  <div class="cards">
    <a class="card" href="/services/open"><h3>Open transport</h3><p>The default for daily drivers and dealer inventory. Best price per mile.</p></a>
    <a class="card" href="/services/enclosed"><h3>Enclosed transport</h3><p>Hard-sided trailers for classics, exotics and anything you would not park outside.</p></a>
    <a class="card" href="/services/expedited"><h3>Expedited pickup</h3><p>When the vehicle has to move this week and waiting for a full load is not an option.</p></a>
    <a class="card" href="/services/door-to-door"><h3>Door to door</h3><p>Residential pickup and delivery where the truck can legally reach.</p></a>
  </div>
</section>

<section class="wrap section">
  <h2 class="section-title">Why people call us back</h2>
  <div class="cards">
    <div class="card"><h3>Dispatchers, not a queue</h3><p>You get a name and a direct line. The same person owns your order until delivery.</p></div>
    <div class="card"><h3>Carriers we can vouch for</h3><p>Active MC authority, current insurance, and a track record on the lane before we assign.</p></div>
    <div class="card"><h3>No surprise line items</h3><p>The quote breaks down base rate, condition fee and deposit. Nothing appears later.</p></div>
  </div>
</section>
`,
  });
}

export function quotePage(options: {
  values: QuoteFormValues;
  result?: {
    origin: string;
    destination: string;
    distance: number;
    transport: string;
    total: number;
    deposit: number;
    breakdown: string;
    estimated: boolean;
  };
  error?: string;
}): string {
  const result = options.result;
  return layout({
    title: "Get a vehicle shipping quote — Car Haul Specialist",
    description: "Instant open and enclosed vehicle transport pricing from your pickup and delivery ZIP codes.",
    canonical: "/quote",
    body: `
<section class="wrap section">
  <h1 class="page-title">Get your price</h1>
  <div class="quote-layout">
    <div>${quoteForm(options.values, options.error)}</div>
    <aside class="quote-side">
      ${
        result
          ? `<div class="price-card">
        <p class="eyebrow">Your estimate</p>
        <p class="price">$${result.total.toLocaleString()}</p>
        <p class="muted small">${esc(result.origin)} → ${esc(result.destination)} · ${result.distance.toLocaleString()} miles · ${esc(result.transport)}</p>
        <ul class="breakdown">
          <li><span>Base</span><span>$${result.breakdown}</span></li>
          <li><span>Deposit to book</span><span>$${result.deposit.toLocaleString()}</span></li>
        </ul>
        <p class="muted small">${result.estimated ? "This route used a regional estimate; dispatch will confirm the exact mileage." : "Mileage from ZIP centroids; final price is confirmed by dispatch."}</p>
        <p class="muted small">A dispatcher has your request and will reach out within one business hour.</p>
      </div>`
          : `<div class="price-card price-card-empty">
        <p class="eyebrow">How pricing works</p>
        <ul class="breakdown">
          <li><span>Open trailer</span><span>from $0.95 / mile</span></li>
          <li><span>Enclosed trailer</span><span>from $1.35 / mile</span></li>
          <li><span>Not running</span><span>+ $150</span></li>
          <li><span>Minimum</span><span>$450 open · $650 enclosed</span></li>
        </ul>
        <p class="muted small">Prices are per vehicle, door to door, before any optional services.</p>
      </div>`
      }
    </aside>
  </div>
</section>`,
  });
}

const SERVICE_PAGES: Record<string, { title: string; intro: string; points: string[] }> = {
  open: {
    title: "Open vehicle transport",
    intro:
      "A multi-car open trailer is how most vehicles move in the United States. It is the cheapest per mile and the right answer for daily drivers, dealer trades and fleet moves.",
    points: [
      "Best price per mile of any trailer type",
      "Shared loads, so pickup depends on the route filling",
      "Dust and road spray are normal; the vehicle arrives as it left",
      "Covered for the vehicle's actual cash value by the carrier's insurance",
    ],
  },
  enclosed: {
    title: "Enclosed vehicle transport",
    intro:
      "Hard-sided trailers for cars that should not see weather, gravel or a parking lot overnight: classics, exotics, low-mileage collector cars and anything with paint you care about.",
    points: [
      "Fully enclosed, single or multi-car trailers",
      "Soft straps and wheel baskets rather than chains",
      "Higher per-mile cost, tighter scheduling",
      "Ideal for auction wins, museum moves and private collections",
    ],
  },
  expedited: {
    title: "Expedited vehicle pickup",
    intro:
      "When the car has to move now, we look for a truck already heading your way instead of waiting for a full load to assemble.",
    points: [
      "Priority placement on the next available truck",
      "Typical pickup inside 24 to 48 hours on major lanes",
      "Higher cost than standard dispatch",
      "Best for auction deadlines, lease returns and relocations",
    ],
  },
  "door-to-door": {
    title: "Door-to-door transport",
    intro:
      "Pickup and delivery at the addresses you give us, where a full-size truck can legally stop. If the street is too tight, we agree a nearby meeting point before dispatch.",
    points: [
      "Residential and commercial addresses",
      "Access notes captured at booking",
      "Meeting-point fallback for narrow streets and low branches",
      "Same driver from pickup to delivery where the route allows",
    ],
  },
};

export function servicePage(slug: string): string | null {
  const page = SERVICE_PAGES[slug];
  if (!page) return null;
  return layout({
    title: `${page.title} — Car Haul Specialist`,
    description: page.intro.slice(0, 155),
    canonical: `/services/${slug}`,
    body: `
<section class="wrap section">
  <p class="eyebrow">Service</p>
  <h1 class="page-title">${esc(page.title)}</h1>
  <p class="lede narrow">${esc(page.intro)}</p>
  <ul class="ticks">
    ${page.points.map((point) => `<li>${esc(point)}</li>`).join("")}
  </ul>
  <div class="cta-row">
    <a class="btn btn-accent" href="/quote">Get a price for this route</a>
    <a class="btn btn-ghost" href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">Call dispatch</a>
  </div>
</section>`,
  });
}

export function howItWorksPage(): string {
  return layout({
    title: "How vehicle shipping works — Car Haul Specialist",
    description: "What happens between your quote and your car arriving: dispatch, carrier assignment, pickup inspection and delivery.",
    canonical: "/how-it-works",
    body: `
<section class="wrap section">
  <h1 class="page-title">How it works</h1>
  <ol class="steps steps-wide">
    <li><span class="step-num">1</span><h3>Quote</h3><p>Two ZIPs and the vehicle. The price comes from distance, trailer type and condition.</p></li>
    <li><span class="step-num">2</span><h3>Book</h3><p>You confirm the price and pay a deposit. That reserves the slot and starts dispatch.</p></li>
    <li><span class="step-num">3</span><h3>Assign</h3><p>We match the order to a carrier with authority, insurance and history on your lane.</p></li>
    <li><span class="step-num">4</span><h3>Pick up</h3><p>The driver inspects the vehicle with you and signs the bill of lading. Photographs go on the record.</p></li>
    <li><span class="step-num">5</span><h3>Deliver</h3><p>Same inspection at the destination, then the balance is settled. Damage claims are handled from the record, not from memory.</p></li>
  </ol>
</section>`,
  });
}

export function pricingPage(): string {
  return layout({
    title: "Vehicle transport pricing — Car Haul Specialist",
    description: "How vehicle shipping is priced: distance, trailer type, condition and season, with the fees we charge and why.",
    canonical: "/pricing",
    body: `
<section class="wrap section">
  <h1 class="page-title">How your price is built</h1>
  <p class="lede narrow">Four things move the number: distance, trailer type, whether the vehicle runs, and how busy the lane is.</p>
  <table class="table">
    <thead><tr><th>Line</th><th>Open</th><th>Enclosed</th></tr></thead>
    <tbody>
      <tr><td>Rate per mile</td><td>from $0.95</td><td>from $1.35</td></tr>
      <tr><td>Minimum charge</td><td>$450</td><td>$650</td></tr>
      <tr><td>Not running</td><td>+ $150</td><td>+ $150</td></tr>
      <tr><td>Oversize or lifted</td><td>+ $200</td><td>+ $200</td></tr>
      <tr><td>Deposit to book</td><td>20%</td><td>20%</td></tr>
    </tbody>
  </table>
  <p class="muted small">Rates are planning figures. A dispatcher confirms the final price against the actual lane and dates before you pay anything.</p>
</section>`,
  });
}

const FAQS = [
  ["How long does pickup take?", "On busy lanes, usually two to five business days after booking. Expedited service targets 24 to 48 hours."],
  ["Is my car insured while it is on the truck?", "Yes. The carrier's cargo insurance covers the vehicle up to its actual cash value, and we check that the policy is current before assigning."],
  ["Can you ship a car that does not run?", "Yes, with a winch fee. Tell us at quote time so the truck arrives prepared."],
  ["Do you ship multiple vehicles?", "Yes. Add the second vehicle in the notes and dispatch will price the pair together."],
  ["What if the truck cannot reach my street?", "We agree a nearby meeting point before pickup. Large trucks need room to turn and load."],
  ["When is the balance due?", "On delivery, after the inspection. The deposit is what reserves the slot."],
];

export function faqPage(): string {
  return layout({
    title: "Vehicle transport FAQ — Car Haul Specialist",
    description: "Answers on pickup times, insurance, non-running vehicles, multiple cars and payment.",
    canonical: "/faq",
    body: `
<section class="wrap section">
  <h1 class="page-title">Questions we get every day</h1>
  <dl class="faq">
    ${FAQS.map(([question, answer]) => `<div><dt>${esc(question)}</dt><dd>${esc(answer)}</dd></div>`).join("")}
  </dl>
</section>`,
  });
}

export function contactPage(): string {
  return layout({
    title: "Contact dispatch — Car Haul Specialist",
    description: "Call or email the dispatch desk. We answer Monday to Saturday, 8am to 8pm ET.",
    canonical: "/contact",
    body: `
<section class="wrap section">
  <h1 class="page-title">Talk to dispatch</h1>
  <div class="cards">
    <div class="card"><h3>Phone</h3><p><a href="tel:${esc(site.phone.replace(/[^0-9+]/g, ""))}">${esc(site.phone)}</a></p><p class="muted small">${esc(site.hours)}</p></div>
    <div class="card"><h3>Email</h3><p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p><p class="muted small">We reply within one business hour.</p></div>
    <div class="card"><h3>Quote first</h3><p><a href="/quote">Get an instant price</a></p><p class="muted small">Fastest route to a booking.</p></div>
  </div>
</section>`,
  });
}

export function legalPage(kind: "terms" | "privacy"): string {
  const isTerms = kind === "terms";
  return layout({
    title: `${isTerms ? "Terms of service" : "Privacy policy"} — Car Haul Specialist`,
    description: isTerms ? "Terms covering quotes, bookings, deposits and claims." : "What we collect, why, and how to have it removed.",
    canonical: `/${kind}`,
    body: `
<section class="wrap section prose">
  <h1 class="page-title">${isTerms ? "Terms of service" : "Privacy policy"}</h1>
  <p class="muted small">Placeholder draft. This must be reviewed by your counsel before launch.</p>
  ${
    isTerms
      ? `<h2>Quotes</h2><p>Quotes are estimates based on the route and vehicle described. A dispatcher confirms the final price before booking.</p>
         <h2>Bookings and deposits</h2><p>A deposit reserves capacity on a carrier's route. The balance is due on delivery after inspection.</p>
         <h2>Claims</h2><p>Condition is recorded on the bill of lading at pickup and delivery. Claims are assessed against that record and the carrier's insurance.</p>`
      : `<h2>What we collect</h2><p>Contact details, the addresses and vehicle information you provide, and the quote and order records that follow.</p>
         <h2>Why</h2><p>To price and dispatch your shipment, to contact you about it, and to keep the record required for insurance and tax.</p>
         <h2>Removal</h2><p>Email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> to request a copy or deletion of your data, subject to records we must retain.</p>`
  }
</section>`,
  });
}

export function notFoundPage(): string {
  return layout({
    title: "Page not found — Car Haul Specialist",
    description: "That page does not exist.",
    body: `<section class="wrap section"><h1 class="page-title">That page moved.</h1><p class="lede narrow">Try the quote form, or call dispatch on ${esc(site.phone)}.</p><a class="btn btn-accent" href="/quote">Get a price</a></section>`,
  });
}

export interface LeadRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  origin_zip: string;
  dest_zip: string;
  transport_type: string;
  condition: string;
  distance_miles: number | null;
  price_estimate: number | null;
  status: string;
  created_at: number;
}

export function adminLoginPage(error?: string): string {
  return layout({
    title: "Dispatch login — Car Haul Specialist",
    description: "Staff sign in.",
    body: `
<section class="wrap section narrow-wrap">
  <h1 class="page-title">Dispatch login</h1>
  <form class="quote-form" method="post" action="/admin/login">
    ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
    <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="username"></label>
    <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn btn-accent btn-block" type="submit">Sign in</button>
  </form>
</section>`,
  });
}

export function adminPage(leads: LeadRow[], email: string): string {
  const rows = leads
    .map(
      (lead) => `<tr>
      <td>${lead.id}</td>
      <td>${esc(lead.name)}<br><span class="muted small">${esc(lead.email)} · ${esc(lead.phone)}</span></td>
      <td>${esc(lead.origin_zip)} → ${esc(lead.dest_zip)}<br><span class="muted small">${esc(lead.transport_type)} · ${esc(lead.condition)}</span></td>
      <td>${lead.distance_miles ? `${lead.distance_miles.toLocaleString()} mi` : "—"}</td>
      <td>${lead.price_estimate ? `$${lead.price_estimate.toLocaleString()}` : "—"}</td>
      <td>${esc(lead.status)}</td>
      <td class="muted small">${new Date(lead.created_at).toLocaleString()}</td>
    </tr>`,
    )
    .join("");

  return layout({
    title: "Leads — Car Haul Specialist",
    description: "Dispatch console.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div><p class="eyebrow">Dispatch</p><h1 class="page-title">Quote requests</h1></div>
    <div class="admin-user"><span class="muted small">${esc(email)}</span><form method="post" action="/admin/logout"><button class="btn btn-ghost" type="submit">Sign out</button></form></div>
  </div>
  ${leads.length === 0 ? `<p class="muted">No requests yet.</p>` : `<table class="table"><thead><tr><th>#</th><th>Customer</th><th>Route</th><th>Miles</th><th>Quote</th><th>Status</th><th>Received</th></tr></thead><tbody>${rows}</tbody></table>`}
</section>`,
  });
}
