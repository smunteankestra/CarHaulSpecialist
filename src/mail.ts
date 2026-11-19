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
  /** Public origin, used to build the QR image URL. */
  pay_base?: string;
  /** Where a PayPal payment goes. */
  paypal_link?: string;
  /** Where a Cash App payment goes. */
  cashapp_link?: string;
  /** Where a Venmo payment goes. */
  venmo_link?: string;
  /** Method chosen for this invoice; falls back to the order's own method. */
  invoice_method?: string | null;
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
  pay?: { amount: number; url: string; qrUrl: string; label: string };
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
    ${options.pay
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;border:1px solid #e3eaf0;border-radius:8px;">
      <tr>
        <td style="padding:12px 14px;vertical-align:middle;">
          <div style="font-size:13px;font-weight:700;color:#10161c;">Pay ${esc(usd(options.pay.amount))} with ${esc(options.pay.label)}</div>
          <div style="font-size:12px;color:#33475b;line-height:1.6;margin-top:4px;">
            ${options.pay.label === "Zelle"
              ? `Open your bank's app, scan the code, then send <strong>${esc(usd(options.pay.amount))}</strong>.`
              : `Scan the code with your phone camera, then send <strong>${esc(usd(options.pay.amount))}</strong>.`}
          </div>
          ${options.pay.url
            ? `<div style="font-size:12px;color:#33475b;margin-top:6px;">
            Or open <a href="${esc(options.pay.url)}" style="color:#4d7020;font-weight:600;">${esc(options.pay.url.replace("https://", ""))}</a>
          </div>`
            : ""}
        </td>
        <td style="padding:12px 14px;text-align:right;width:150px;">
          <img src="${esc(options.pay.qrUrl)}" width="132" height="132" alt="${esc(options.pay.label)} QR code" style="display:block;border:0;">
        </td>
      </tr>
    </table>`
      : ""}
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
/** The "scan and pay" block: PayPal uses the account's own code, Cash App is generated. */
function payBlock(
  order: InvoiceOrder,
  kind: "client" | "carrier",
  amount: number,
): { amount: number; url: string; qrUrl: string; label: string } | undefined {
  if (kind !== "client" || amount <= 0 || !order.pay_base) return undefined;
  const method = (order.invoice_method ?? order.payment_method ?? "").trim().toLowerCase();
  if (method === "paypal") {
    return {
      amount,
      label: "PayPal",
      url: order.paypal_link ?? "",
      // The account's own code, so the payer lands on the real profile.
      qrUrl: `${order.pay_base}/pay/paypal-qr.png`,
    };
  }
  if (method === "cashapp") {
    return {
      amount,
      label: "Cash App",
      url: order.cashapp_link ?? "",
      qrUrl: `${order.pay_base}/pay/cashapp-qr.png`,
    };
  }
  if (method === "venmo") {
    return {
      amount,
      label: "Venmo",
      url: order.venmo_link ?? "",
      qrUrl: `${order.pay_base}/pay/venmo-qr.png`,
    };
  }
  if (method === "zelle") {
    return {
      amount,
      label: "Zelle",
      url: "",
      // Zelle has no payment links: this is the bank's own enrolment code.
      qrUrl: `${order.pay_base}/pay/zelle-qr.png`,
    };
  }
  return undefined;
}

/** PayPal takes a cut; the invoice shows it as a line instead of hiding it in the price. */
const PAYPAL_FEE_PERCENT = 3;

function paymentFee(order: InvoiceOrder, kind: "client" | "carrier", amount: number): number {
  if (kind !== "client" || amount <= 0) return 0;
  const method = (order.invoice_method ?? order.payment_method ?? "").trim().toLowerCase();
  if (method !== "paypal") return 0;
  return Math.round(amount * PAYPAL_FEE_PERCENT) / 100;
}

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
  const base = lines.reduce((sum, line) => sum + line.amount, 0);
  const fee = paymentFee(order, kind, base);
  if (fee > 0) {
    lines.push({ qty: 1, description: `PayPal processing fee (${PAYPAL_FEE_PERCENT}%)`, amount: fee });
  }
  const amount = base + fee;
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
      pay: payBlock(order, kind, amount),
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
  // Dispatch address on the verified domain; the Resend sandbox only as a last resort.
  const from = env.MAIL_FROM?.trim() || "Bond Auto Transport <operations@bondautotransport.com>";
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
