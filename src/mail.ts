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
  customer_phone?: string | null;
  carrier_name?: string | null;
  carrier_email?: string | null;
  carrier_company_phone?: string | null;
  driver_name?: string | null;
  vin?: string | null;
  transport_type?: string;
  condition?: string;
  origin_street?: string | null;
  origin_contact?: string | null;
  dest_street?: string | null;
  dest_contact?: string | null;
  price?: number;
  carrier_fee?: number | null;
  units?: { position: number; vehicle_year: string | null; vehicle_make: string | null; vehicle_model: string | null; vin: string | null; condition: string | null; price: number | null }[];
  logo_url?: string;
  issued_on?: string;
  delivered_on?: string;
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

interface InvoiceLine {
  qty: number;
  description: string;
  amount: number;
}

function invoiceShell(options: {
  title: string;
  logoUrl: string;
  meta: [string, string][];
  billTo: [string, string][];
  lines: InvoiceLine[];
  total: number;
  origin: string[];
  destination: string[];
  footnote: string;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:3px 0;color:#5b7186;font-size:12px;white-space:nowrap;padding-right:12px;">${esc(label)}</td><td style="padding:3px 0;font-size:12px;font-weight:600;text-align:right;">${esc(value)}</td></tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#10161c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fa;padding:20px 10px;">
<tr><td align="center">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:680px;background:#ffffff;border:1px solid #e3eaf0;border-radius:10px;overflow:hidden;">

  <tr><td style="padding:20px 24px 12px;border-bottom:2px solid #76a03c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;">
        <img src="${esc(options.logoUrl)}" alt="Bond Auto Transport" width="64" height="45" style="display:block;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:700;">Bond Auto Transport</div>
        <div style="font-size:12px;color:#33475b;line-height:1.5;margin-top:2px;">
          8332 Regents Rd Unit 1B<br>San Diego, CA 92122<br>
          Email: operations@bondautotransport.com<br>Phone: +1 (858) 699-4828
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">${esc(options.title)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left:auto;margin-top:8px;">${options.meta
          .map(([label, value]) => row(label, value))
          .join("")}</table>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:16px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;width:50%;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#5b7186;text-transform:uppercase;margin-bottom:4px;">Bill to</div>
        <table role="presentation" cellpadding="0" cellspacing="0">${options.billTo
          .map(([label, value]) => row(label, value))
          .join("")}</table>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:18px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <th align="left" style="width:44px;padding:8px 10px;background:#f2f6f9;border:1px solid #d9e2f3;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b7186;">Qty</th>
        <th align="left" style="padding:8px 10px;background:#f2f6f9;border:1px solid #d9e2f3;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b7186;">Description</th>
        <th align="right" style="width:110px;padding:8px 10px;background:#f2f6f9;border:1px solid #d9e2f3;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#5b7186;">Line total</th>
      </tr>
      ${options.lines
        .map(
          (line) =>
            `<tr><td style="padding:9px 10px;border:1px solid #d9e2f3;font-size:13px;">${line.qty}</td><td style="padding:9px 10px;border:1px solid #d9e2f3;font-size:13px;">${line.description}</td><td align="right" style="padding:9px 10px;border:1px solid #d9e2f3;font-size:13px;font-weight:600;">${usd(line.amount)}</td></tr>`,
        )
        .join("")}
      <tr><td colspan="2" align="right" style="padding:9px 10px;border:1px solid #d9e2f3;font-size:13px;font-weight:700;">Total due</td><td align="right" style="padding:9px 10px;border:1px solid #d9e2f3;font-size:14px;font-weight:700;color:#166534;">${usd(options.total)}</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:16px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;width:50%;padding-right:12px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#5b7186;text-transform:uppercase;margin-bottom:4px;">Origin</div>
        <div style="font-size:12px;line-height:1.6;color:#33475b;">${options.origin.map((line) => esc(line)).join("<br>")}</div>
      </td>
      <td style="vertical-align:top;width:50%;padding-left:12px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#5b7186;text-transform:uppercase;margin-bottom:4px;">Destination</div>
        <div style="font-size:12px;line-height:1.6;color:#33475b;">${options.destination.map((line) => esc(line)).join("<br>")}</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:18px 24px 22px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#33475b;">${esc(options.footnote)}</p>
  </td></tr>

  <tr><td style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e3eaf0;color:#5b7186;font-size:11px;line-height:1.6;">
    MGV Advisors LLC DBA Bond Auto Transport · MC #1647505 · USDOT #4250470<br>
    If you have any question concerning this invoice, contact Bond Auto Transport or email us at operations@bondautotransport.com
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Client or carrier invoice built from the order. */
export function buildInvoiceMail(order: InvoiceOrder, kind: "client" | "carrier"): InvoiceMail {
  const vehicleType = order.transport_type === "enclosed" ? "Enclosed trailer" : "Open trailer";
  const lineFor = (year: string | null, make: string | null, model: string | null, vin: string | null, condition: string | null) => {
    const label = [year, make, model].filter(Boolean).join(" ") || "Vehicle";
    return `${esc(label)}<br><span style="color:#5b7186;font-size:12px;">VIN: ${esc(vin || "—")} · ${esc(vehicleType)} · ${esc(conditionText(condition))}</span>`;
  };

  const unitList = order.units && order.units.length > 1 ? order.units : [];
  const lines: InvoiceLine[] = unitList.length
    ? unitList.map((unit) => ({
        qty: 1,
        description: lineFor(unit.vehicle_year, unit.vehicle_make, unit.vehicle_model, unit.vin, unit.condition),
        amount: kind === "carrier" ? (order.carrier_fee ?? 0) / unitList.length : (unit.price ?? 0),
      }))
    : [
        {
          qty: 1,
          description: lineFor(order.vehicle_year ?? null, order.vehicle_make ?? null, order.vehicle_model ?? null, order.vin ?? null, order.condition ?? null),
          amount: order.invoice_amount ?? (kind === "carrier" ? (order.carrier_fee ?? 0) : (order.price ?? 0)),
        },
      ];
  const amount = lines.reduce((sum, line) => sum + line.amount, 0);
  const destination = [
    order.dest_contact || "—",
    [order.dest_street, order.dest_city, [order.dest_state, order.dest_zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  ];
  const origin = [
    [order.origin_street, order.origin_city, [order.origin_state, order.origin_zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || order.origin_zip,
    order.origin_contact ? `Contact: ${order.origin_contact}` : "",
  ].filter(Boolean);

  const billTo: [string, string][] =
    kind === "carrier"
      ? [
          ["Company:", order.carrier_name || "Carrier"],
          ["Email:", order.carrier_email || ""],
          ["Phone:", order.carrier_company_phone || ""],
          ["Driver:", order.driver_name || ""],
        ]
      : [
          ["Name:", order.customer_name || ""],
          ["Email:", order.customer_email || ""],
          ["Phone:", order.customer_phone || ""],
        ];

  return {
    subject: kind === "carrier" ? `Settlement ${order.number} — Bond Auto Transport` : `Invoice ${order.number} — Bond Auto Transport`,
    html: invoiceShell({
      title: kind === "carrier" ? "CARRIER SETTLEMENT" : "INVOICE",
      logoUrl: order.logo_url || "",
      meta: [
        ["Invoice #:", order.number],
        ["Order ID:", order.number],
        ["Date:", order.issued_on || ""],
        ["Payment terms:", kind === "client" ? "Due on receipt" : order.payment_method || ""],
        ["Load delivered:", order.delivered_on || "Pending"],
      ],
      billTo,
      lines,
      total: amount,
      origin,
      destination,
      footnote:
        kind === "carrier"
          ? "Payment is released per the terms agreed with dispatch. Reply to this email with any question about the amount."
          : "No card is charged online. A dispatcher confirms the carrier and pickup window before anything is collected.",
    }),
  };
}

function conditionText(condition: string | null | undefined): string {
  if (condition === "inoperable_steer_roll") return "Inoperable (steers and rolls)";
  if (condition === "inoperable_no_steer") return "Inoperable (no steer / no roll)";
  return "Operable";
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
