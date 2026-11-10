/** Outbound email: invoice payloads and the transport that delivers them. */
export interface InvoiceMail {
  subject: string;
  html: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface InvoiceOrder {
  number: string;
  customer_name: string;
  customer_email: string;
  carrier_name?: string | null;
  carrier_email?: string | null;
  origin_city?: string | null;
  origin_state?: string | null;
  origin_zip: string;
  dest_city?: string | null;
  dest_state?: string | null;
  dest_zip: string;
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  pickup_eta?: number | null;
  delivery_eta?: number | null;
  payment_method?: string | null;
  invoice_amount?: number | null;
  track_url?: string;
}

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const usd = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const day = (value: number | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "To be confirmed";

function shell(title: string, intro: string, rows: [string, string][], note: string, trackUrl?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#10161c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0b1620;padding:20px 24px;">
          <p style="margin:0;color:#9fd356;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">Bond Auto Transport</p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;">${esc(title)}</h1>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
            ${rows
              .map(
                ([label, value]) =>
                  `<tr><td style="padding:7px 0;border-bottom:1px solid #e8eef4;color:#5b7186;">${esc(label)}</td><td style="padding:7px 0;border-bottom:1px solid #e8eef4;text-align:right;font-weight:600;">${esc(value)}</td></tr>`,
              )
              .join("")}
          </table>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#33475b;">${note}</p>
          ${
            trackUrl
              ? `<p style="margin:20px 0 0;"><a href="${esc(trackUrl)}" style="display:inline-block;background:#76a03c;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:600;">Track this shipment</a></p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;color:#5b7186;font-size:11px;line-height:1.5;">
          MGV Advisors LLC DBA Bond Auto Transport · MC #1647505 · USDOT #4250470<br>
          (858) 699-4828 · operations@bondautotransport.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Client or carrier invoice built from the order. */
export function buildInvoiceMail(order: InvoiceOrder, kind: "client" | "carrier"): InvoiceMail {
  const vehicle = [order.vehicle_year, order.vehicle_make, order.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
  const route = `${order.origin_city ?? order.origin_zip}, ${order.origin_state ?? ""} → ${order.dest_city ?? order.dest_zip}, ${order.dest_state ?? ""}`.replace(/,\s*,/g, ",");
  const amount = usd(order.invoice_amount);

  if (kind === "carrier") {
    return {
      subject: `Carrier settlement ${order.number} — ${vehicle}`,
      html: shell(
        `Carrier settlement ${order.number}`,
        `Hello ${esc(order.carrier_name || "carrier")}, this is the settlement summary for the vehicle you are moving for Bond Auto Transport.`,
        [
          ["Order", order.number],
          ["Vehicle", vehicle],
          ["Route", route],
          ["Pickup", day(order.pickup_eta)],
          ["Delivery", day(order.delivery_eta)],
          ["Carrier payment", amount],
        ],
        "Payment is released per the terms agreed with dispatch. Reply to this email with any question about the amount.",
        order.track_url,
      ),
    };
  }

  return {
    subject: `Invoice ${order.number} — Bond Auto Transport`,
    html: shell(
      `Invoice ${order.number}`,
      `Hello ${esc(order.customer_name)}, here is the invoice for your vehicle transport.`,
      [
        ["Order", order.number],
        ["Vehicle", vehicle],
        ["Route", route],
        ["Pickup", day(order.pickup_eta)],
        ["Delivery", day(order.delivery_eta)],
        ["Payment method", order.payment_method || "As agreed with dispatch"],
        ["Amount due", amount],
      ],
      "No card is charged online. A dispatcher confirms the carrier and pickup window before anything is collected.",
      order.track_url,
    ),
  };
}

/** Sends via Resend. `MAIL_FROM` overrides the sender once a domain is verified. */
export async function sendMail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  message: MailMessage,
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("Email is not configured: set the RESEND_API_KEY secret.");
  const from = env.MAIL_FROM?.trim() || "Bond Auto Transport <onboarding@resend.dev>";
  // Always the address stored on the order — no test redirection.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the message (${response.status}): ${detail.slice(0, 180)}`);
  }
}
