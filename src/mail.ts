/** Outbound email. Returns a payload only once a template and transport exist. */
export interface InvoiceMail {
  subject: string;
  html: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Build the invoice email for an order.
 * Placeholder until the HTML template is supplied — returning null keeps the
 * send button honest instead of mailing something unfinished.
 */
export function buildInvoiceMail(_order: unknown, _kind: "client" | "carrier"): InvoiceMail | null {
  return null;
}

/** Sends via Resend when RESEND_API_KEY is set; throws a readable error otherwise. */
export async function sendMail(env: { RESEND_API_KEY?: string }, message: MailMessage): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("Email is not configured: set the RESEND_API_KEY secret.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Bond Auto Transport <operations@bondautotransport.com>",
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
}
