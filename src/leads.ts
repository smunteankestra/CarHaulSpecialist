export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "confirmed",
  "assigned",
  "picked_up",
  "delivered",
  "closed",
  "cancelled",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quoted",
  confirmed: "Confirmed",
  assigned: "Carrier assigned",
  picked_up: "Picked up",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
