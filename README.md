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

The quote form takes up to five optional JPEG, PNG or WebP photos, 5 MB each. Files are stored in the `UPLOADS` KV namespace under `leads/<uuid>.<ext>`; `lead_photos` rows reference them. Signed-in staff see a gallery in the quote modal and fetch each image from `/admin/photos/:id`, which redirects to login when unauthenticated.

Apply `migrations/0004_lead_photo.sql` and `migrations/0006_lead_photos.sql` before deploying. KV is used because R2 is not enabled on the account; moving to R2 later only changes the binding and the storage calls.

## Deploy

The live Worker is still `car-haul-specialist`; it holds the production secrets and binds the D1 database of the same name. `wrangler.jsonc` names the eventual target `bondautotransport`, and Cloudflare D1 does not support renaming a database in place.

```bash
npm run deploy:live    # updates car-haul-specialist in place, keeping its secrets
```

After the rename cutover, use `npm run deploy`. The first deploy under `bondautotransport` creates a fresh Worker, so set `SESSION_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` for it first. The old Worker keeps running until you delete it.

For automatic deploys, connect the GitHub repository in the Cloudflare dashboard: Workers & Pages → Create → Connect to Git → pick the repo. Build command `npm install`; use deploy command `npm run deploy:live` until the rename cutover.

The live Worker is **`bondautotransport`** at https://bondautotransport.muntean2stefan.workers.dev. The old `car-haul-specialist` Worker remains deployed for rollback (`npm run deploy:live`). D1 cannot be renamed in place, so the database keeps the `car-haul-specialist` name; both Workers share it.

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

## Website chat → Telegram

The floating chat on public pages posts to `POST /api/chat`. Messages are stored in the `chat_messages` table and forwarded to Telegram when both secrets are set:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --name bondautotransport
npx wrangler secret put TELEGRAM_CHAT_ID --name bondautotransport
```

Create the bot with @BotFather, then use its token and the destination chat ID. Without the secrets, messages are still stored but not forwarded. The chat is hidden on `/admin`.

## Moving to bondautotransport.com

The domain is currently on Wix nameservers (`ns12/ns13.wixdns.net`) and is not in this Cloudflare account. The cutover needs the registrar, not just code:

1. Add `bondautotransport.com` as a zone in Cloudflare.
2. Recreate the email records before switching nameservers:
   - MX `10 aspmx.l.google.com` (Google Workspace)
   - TXT `v=spf1 include:_spf.google.com ~all`
   - TXT `google-site-verification=qJebw3aJF0rXDs2b0c1qfVv-pELrYUR6tk-wQJ6bZrs`
   - Any DKIM/DMARC records shown in the Google Workspace admin console (none were publicly visible at the last check).
3. Change the nameservers at the registrar to the pair Cloudflare assigns.
4. Attach `bondautotransport.com` and `www.bondautotransport.com` as Worker custom domains.
5. Verify inbound email before and after the switch.

Business details imported from the live Wix site: **MGV Advisors LLC DBA Bond Auto Transport**, San Diego, CA 92122, (858) 699-4828, operations@bondautotransport.com, **MC #1647505**, **DOT #4250470**.

Customer contacts/leads live in the Wix backend. Export them from Wix (Contacts / Forms) as CSV to import into the D1 `leads` table; they are not reachable without Wix credentials.
