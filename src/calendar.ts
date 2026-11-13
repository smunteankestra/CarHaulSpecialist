/** Read-only iCalendar feed of pickups and deliveries, for Apple/Google/Outlook subscriptions. */

export interface CalendarEvent {
  id: number;
  number: string;
  kind: "pickup" | "delivery";
  at: number;
  customer: string;
  origin: string;
  destination: string;
  carrier: string | null;
}

function stamp(at: number): string {
  return new Date(at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 wants lines folded at 75 octets. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildCalendar(events: CalendarEvent[], calendarName = "Bond Auto Transport"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bond Auto Transport//Dispatch calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];

  for (const event of events) {
    const label = event.kind === "pickup" ? "Pickup" : "Delivery";
    const summary = `${label} — ${event.number} (${event.customer})`;
    const description = [
      `Order ${event.number}`,
      `${event.kind === "pickup" ? "Pickup" : "Delivery"} ${new Date(event.at).toISOString()}`,
      event.carrier ? `Carrier: ${event.carrier}` : "",
      `${event.origin} → ${event.destination}`,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.kind}-${event.id}@bondautotransport.com`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(event.at)}`,
      `DTEND:${stamp(event.at + 60 * 60000)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `LOCATION:${escapeText(event.kind === "pickup" ? event.origin : event.destination)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
