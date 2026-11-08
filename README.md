# Bond Auto Transport

Vehicle transport website and dispatch console. Public marketing site with an instant quote engine, plus a staff console for quote requests.

Built to run on Cloudflare Workers with D1, deployed from GitHub.

## Stack

| Piece | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers | Global, cheap, no servers to patch |
| Router / HTML | Hono, server-rendered | Marketing pages need real HTML for SEO; no client framework needed for forms |
| Database | D1 (SQLite) | Orders and leads are small, relational, and low volume |
| Static files | Workers Assets (`public/`) | One stylesheet, no build step |
| Uploads | Cloudflare KV (`UPLOADS`) | Optional lead photos; R2 is not enabled on the account |

No bundler, no client-side JavaScript. Every form posts and re-renders on the server, so the site works with JavaScript disabled and search engines see the full page.

## Local development

```bash
npm install
npm run db:local          # create tables in the local D1 database
cp .dev.vars.example .dev.vars   # then edit the values
npm run dev               # http://localhost:8787
```

`npm run check` typechecks, `npm test` runs the pricing tests.

## Configuration

Secrets live in `.dev.vars` locally and in Worker secrets in production. Never commit them.

| Name | Purpose |
|---|---|
| `SESSION_SECRET` | Signs the staff session cookie. 64 hex characters. |
| `ADMIN_EMAIL` | The staff login email |
| `ADMIN_PASSWORD` | The staff password |

The public site reads contact details from `site` in `src/views.ts` — phone, email, hours, MC and DOT numbers. **These are placeholders and must be replaced before launch.**

## Pricing

`src/quote.ts` holds the engine and the default rate card:

| Line | Open | Enclosed |
|---|---|---|
| Rate per mile | $0.95 | $1.35 |
| Minimum, 0–25 mi | $125 | $175 |
| Minimum, 26–75 mi | $200 | $275 |
| Minimum, 76–150 mi | $300 | $425 |
| Minimum, 151–300 mi | $400 | $550 |
| Minimum, 301+ mi | $450 | $650 |
| Inoperable (steer and roll) | +$150 | +$150 |
| Inoperable (no steer/roll/keys) | +$250 | +$250 |
| Oversize | +$200 | +$200 |
| Deposit | 20% | 20% |

Distance comes from ZIP centroids looked up through `zippopotam.us`, then multiplied by 1.2 to approximate road miles. If a lookup fails the lead is still captured and the visitor is told dispatch will follow up, rather than being shown a made-up number.

## Lead photos

The quote form takes an optional JPEG, PNG or WebP up to 5 MB. The file is stored in the `UPLOADS` KV namespace under `leads/<uuid>.<ext>`; the lead row keeps only `photo_key`. Signed-in staff see it in the quote modal and fetch it from `/admin/leads/:id/photo`, which redirects to login when unauthenticated.

Apply `migrations/0004_lead_photo.sql` before deploying. KV is used because R2 is not enabled on the account; moving to R2 later only changes the binding and the storage calls, not the column or route.

## Deploy

The production Worker is named `bondautotransport`. It still binds the existing D1 database `car-haul-specialist`, because Cloudflare D1 does not support renaming a database in place.

```bash
npx wrangler d1 execute car-haul-specialist --remote --file=migrations/0001_init.sql
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npm run deploy
```

The first deploy under the new Worker name creates a fresh Worker, so its secrets must be set again. The old `car-haul-specialist` Worker keeps running until you delete it.

For automatic deploys, connect the GitHub repository in the Cloudflare dashboard: Workers & Pages → Create → Connect to Git → pick the repo. Build command `npm install`, deploy command `npx wrangler deploy`.

### Custom domain

`bondautotransport.com` is not yet a zone in this Cloudflare account; it currently resolves to Wix. To serve the Worker on it, add the site in Cloudflare, switch the registrar to the assigned nameservers, recreate the existing DNS records (including the Google Workspace MX and SPF records), then add `bondautotransport.com` and `www` as Custom Domains on the Worker.

## Routes

| Path | What |
|---|---|
| `/` | Home with the quote form |
| `/quote` | Quote form and result |
| `/services/{open,enclosed,expedited,door-to-door}` | Service pages |
| `/how-it-works`, `/pricing`, `/faq`, `/contact` | Content |
| `/terms`, `/privacy` | Legal placeholders — **must be reviewed** |
| `/admin/login`, `/admin` | Staff console: quote requests |

## Status

Phase 1 of the plan: public site, quote engine, lead capture, staff console.

Not built yet: booking form → order, customer portal, carrier management, documents (bill of lading, contracts), invoices, payments, email notifications. See the roadmap in the project plan.
