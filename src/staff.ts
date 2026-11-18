import { ROLE_LABELS, listUsers, type Role } from "./users.ts";

export type StaffPeriod = "day" | "week" | "month" | "year";
export type StaffMetric = "actions" | "status" | "deliveries" | "edits" | "revenue";

export interface StaffBucket {
  key: string;
  label: string;
}

export interface StaffSeries {
  email: string;
  name: string;
  role: string;
  color: string;
  actions: number[];
  status: number[];
  deliveries: number[];
  edits: number[];
  revenue: number[];
  totalActions: number;
  totalStatus: number;
  totalDeliveries: number;
  totalEdits: number;
  totalRevenue: number;
  orders: number;
  lastActivity: number | null;
  comparison: { today: number; week: number; month: number; year: number };
}

export interface StaffPerformance {
  period: StaffPeriod;
  metric: StaffMetric;
  buckets: StaffBucket[];
  series: StaffSeries[];
  totalRevenue: number;
  totalActions: number;
  totalOrders: number;
  activeStaff: number;
}

const COLORS = [
  "#76a03c",
  "#0f766e",
  "#3730a3",
  "#6b21a8",
  "#9a3412",
  "#075985",
  "#166534",
  "#8f1d14",
  "#33475b",
  "#b45309",
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_KINDS = new Set(["quoted", "confirmed", "assigned", "picked_up", "delivered", "paid", "paid_in_full", "cancelled"]);

const pad = (value: number) => String(value).padStart(2, "0");

function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function startOfWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

function bucketKey(date: Date, period: StaffPeriod): string {
  if (period === "year") return String(date.getUTCFullYear());
  if (period === "month") return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
  if (period === "week") return isoDate(startOfWeek(date));
  return isoDate(date);
}

function buildBuckets(period: StaffPeriod): { buckets: StaffBucket[]; since: number } {
  const now = new Date();
  const buckets: StaffBucket[] = [];

  if (period === "year") {
    const currentYear = now.getUTCFullYear();
    const firstYear = currentYear - 4;
    for (let year = firstYear; year <= currentYear; year += 1) {
      buckets.push({ key: String(year), label: String(year) });
    }
    return { buckets, since: Date.UTC(firstYear, 0, 1) };
  }

  if (period === "month") {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + index, 1));
      buckets.push({
        key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`,
        label: `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
      });
    }
    return { buckets, since: first.getTime() };
  }

  if (period === "week") {
    const current = startOfWeek(now);
    const first = new Date(current);
    first.setUTCDate(first.getUTCDate() - 11 * 7);
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(first);
      date.setUTCDate(first.getUTCDate() + index * 7);
      buckets.push({
        key: isoDate(date),
        label: `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`,
      });
    }
    return { buckets, since: first.getTime() };
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const first = new Date(today);
  first.setUTCDate(first.getUTCDate() - 13);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    buckets.push({
      key: isoDate(date),
      label: `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`,
    });
  }
  return { buckets, since: first.getTime() };
}

export interface TrendSeries {
  buckets: StaffBucket[];
  revenue: number[];
  profit: number[];
  orders: number[];
  revenueTotal: number;
  profitTotal: number;
  orderTotal: number;
}

export interface RevenueTrends {
  day: TrendSeries;
  week: TrendSeries;
  month: TrendSeries;
}

function emptyTrend(period: StaffPeriod): TrendSeries {
  const { buckets } = buildBuckets(period);
  return {
    buckets,
    revenue: Array(buckets.length).fill(0),
    profit: Array(buckets.length).fill(0),
    orders: Array(buckets.length).fill(0),
    revenueTotal: 0,
    profitTotal: 0,
    orderTotal: 0,
  };
}

/** Paid revenue and broker profit bucketed per day, week and month in one pass. */
export async function loadRevenueTrends(db: D1Database): Promise<RevenueTrends> {
  const trends: RevenueTrends = { day: emptyTrend("day"), week: emptyTrend("week"), month: emptyTrend("month") };
  const periods = ["day", "week", "month"] as const;
  const indexes = new Map(periods.map((period) => [period, new Map(trends[period].buckets.map((bucket, index) => [bucket.key, index]))]));

  const paidEvents = (
    await db
      .prepare(
        `SELECT e.order_id, e.actor, e.created_at
           FROM order_events e
           JOIN orders o ON o.id = e.order_id
          WHERE e.kind = 'paid' AND o.paid_amount IS NOT NULL
          ORDER BY e.created_at`,
      )
      .all<{ order_id: number; actor: string; created_at: number }>()
  ).results;

  const paidAt = new Map<number, number>();
  for (const event of paidEvents) {
    if (event.actor === "customer") continue;
    paidAt.set(event.order_id, event.created_at);
  }

  const orders = (
    await db
      .prepare("SELECT id, paid_amount, broker_fee, updated_at FROM orders WHERE paid_amount IS NOT NULL AND status IN ('paid','paid_in_full')")
      .all<{ id: number; paid_amount: number; broker_fee: number | null; updated_at: number }>()
  ).results;

  for (const order of orders) {
    const at = paidAt.get(order.id) ?? order.updated_at;
    for (const period of periods) {
      const trend = trends[period];
      const index = indexes.get(period)?.get(bucketKey(new Date(at), period));
      if (index === undefined) continue;
      trend.revenue[index] = (trend.revenue[index] ?? 0) + order.paid_amount;
      trend.profit[index] = (trend.profit[index] ?? 0) + (order.broker_fee ?? 0);
      trend.orders[index] = (trend.orders[index] ?? 0) + 1;
      trend.revenueTotal += order.paid_amount;
      trend.profitTotal += order.broker_fee ?? 0;
      trend.orderTotal += 1;
    }
  }

  return trends;
}

export function parseStaffPeriod(value: string | undefined): StaffPeriod {
  return value === "week" || value === "month" || value === "year" ? value : "day";
}

export function parseStaffMetric(value: string | undefined): StaffMetric {
  return value === "status" || value === "deliveries" || value === "edits" || value === "revenue" ? value : "actions";
}

export async function loadStaffPerformance(
  db: D1Database,
  period: StaffPeriod,
  metric: StaffMetric,
): Promise<StaffPerformance> {
  const { buckets, since } = buildBuckets(period);
  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  const users = await listUsers(db);
  const events = (
    await db
      .prepare(
        "SELECT order_id, kind, actor, created_at FROM order_events WHERE created_at >= ? AND actor <> 'customer' ORDER BY created_at",
      )
      .bind(since)
      .all<{ order_id: number; kind: string; actor: string; created_at: number }>()
  ).results;

  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = startOfWeek(now).getTime();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);

  const comparisonEvents = (
    await db
      .prepare(
        "SELECT kind, actor, created_at FROM order_events WHERE created_at >= ? AND actor <> 'customer'",
      )
      .bind(yearStart)
      .all<{ kind: string; actor: string; created_at: number }>()
  ).results;

  const paidOrders = (
    await db
      .prepare("SELECT id, paid_amount, updated_at FROM orders WHERE paid_amount IS NOT NULL AND status IN ('paid','paid_in_full')")
      .all<{ id: number; paid_amount: number; updated_at: number }>()
  ).results;

  const paidEvents = (
    await db
      .prepare(
        `SELECT e.order_id, e.actor, e.created_at
           FROM order_events e
           JOIN orders o ON o.id = e.order_id
          WHERE e.kind = 'paid' AND o.paid_amount IS NOT NULL
          ORDER BY e.created_at`,
      )
      .all<{ order_id: number; actor: string; created_at: number }>()
  ).results;

  const latestPaid = new Map<number, { actor: string; created_at: number }>();
  for (const event of paidEvents) {
    if (event.actor === "customer") continue;
    latestPaid.set(event.order_id, { actor: event.actor, created_at: event.created_at });
  }

  const seriesMap = new Map<string, StaffSeries>();
  const orderSets = new Map<string, Set<number>>();

  const ensureSeries = (email: string, name?: string | null, role?: string): StaffSeries => {
    const key = email.toLowerCase();
    const existing = seriesMap.get(key);
    if (existing) {
      if (name && existing.name === existing.email) existing.name = name;
      if (role && existing.role === "—") existing.role = role;
      return existing;
    }
    const series: StaffSeries = {
      email: key,
      name: name?.trim() || key,
      role: role || "—",
      color: COLORS[seriesMap.size % COLORS.length] ?? "#33475b",
      actions: Array(buckets.length).fill(0),
      status: Array(buckets.length).fill(0),
      deliveries: Array(buckets.length).fill(0),
      edits: Array(buckets.length).fill(0),
      revenue: Array(buckets.length).fill(0),
      totalActions: 0,
      totalStatus: 0,
      totalDeliveries: 0,
      totalEdits: 0,
      totalRevenue: 0,
      orders: 0,
      lastActivity: null,
      comparison: { today: 0, week: 0, month: 0, year: 0 },
    };
    seriesMap.set(key, series);
    orderSets.set(key, new Set());
    return series;
  };

  // Only people who can still sign in get a row: deleted accounts and the
  // "system" actor stay in the audit trail but out of the performance chart.
  const knownActors = new Set(users.filter((user) => user.active).map((user) => user.email.toLowerCase()));

  for (const user of users) {
    if (!user.active) continue;
    ensureSeries(user.email.toLowerCase(), user.name, ROLE_LABELS[user.role as Role] ?? user.role);
  }

  for (const event of events) {
    const actor = String(event.actor || "").toLowerCase();
    if (!actor || actor === "customer" || actor === "system" || !knownActors.has(actor)) continue;
    const index = bucketIndex.get(bucketKey(new Date(event.created_at), period));
    if (index === undefined) continue;
    const series = ensureSeries(actor);
    series.actions[index] = (series.actions[index] ?? 0) + 1;
    series.totalActions += 1;
    if (STATUS_KINDS.has(event.kind)) {
      series.status[index] = (series.status[index] ?? 0) + 1;
      series.totalStatus += 1;
    }
    if (event.kind === "delivered") {
      series.deliveries[index] = (series.deliveries[index] ?? 0) + 1;
      series.totalDeliveries += 1;
    }
    if (event.kind === "edited") {
      series.edits[index] = (series.edits[index] ?? 0) + 1;
      series.totalEdits += 1;
    }
    orderSets.get(actor)?.add(event.order_id);
    series.lastActivity = Math.max(series.lastActivity ?? 0, event.created_at);
  }

  for (const order of paidOrders) {
    const paid = latestPaid.get(order.id);
    const rawActor = (paid?.actor || "unattributed").toLowerCase();
    if (rawActor !== "unattributed" && (rawActor === "system" || !knownActors.has(rawActor))) continue;
    const actor = rawActor;
    const at = paid?.created_at ?? order.updated_at;
    if (metric === "revenue" && at >= yearStart) {
      const comparisonSeries = ensureSeries(actor, actor === "unattributed" ? "Unattributed" : undefined);
      comparisonSeries.comparison.year += order.paid_amount;
      if (at >= monthStart) comparisonSeries.comparison.month += order.paid_amount;
      if (at >= weekStart) comparisonSeries.comparison.week += order.paid_amount;
      if (at >= todayStart) comparisonSeries.comparison.today += order.paid_amount;
    }
    if (at < since) continue;
    const index = bucketIndex.get(bucketKey(new Date(at), period));
    if (index === undefined) continue;
    const series = ensureSeries(actor, actor === "unattributed" ? "Unattributed" : undefined);
    series.revenue[index] = (series.revenue[index] ?? 0) + order.paid_amount;
    series.totalRevenue += order.paid_amount;
    orderSets.get(actor)?.add(order.id);
    series.lastActivity = Math.max(series.lastActivity ?? 0, at);
  }

  const qualifies = (kind: string): boolean => {
    if (metric === "actions") return true;
    if (metric === "status") return STATUS_KINDS.has(kind);
    if (metric === "deliveries") return kind === "delivered";
    if (metric === "edits") return kind === "edited";
    return false;
  };

  for (const event of comparisonEvents) {
    const actor = String(event.actor || "").toLowerCase();
    if (!actor || actor === "customer" || actor === "system" || !knownActors.has(actor)) continue;
    if (!qualifies(event.kind)) continue;
    const series = ensureSeries(actor);
    series.comparison.year += 1;
    if (event.created_at >= monthStart) series.comparison.month += 1;
    if (event.created_at >= weekStart) series.comparison.week += 1;
    if (event.created_at >= todayStart) series.comparison.today += 1;
  }

  for (const [email, set] of orderSets) {
    const series = seriesMap.get(email);
    if (series) series.orders = set.size;
  }

  const allOrders = new Set<number>();
  for (const set of orderSets.values()) {
    for (const id of set) allOrders.add(id);
  }

  const series = Array.from(seriesMap.values());
  const totalActions = series.reduce((sum, item) => sum + item.totalActions, 0);
  const totalRevenue = series.reduce((sum, item) => sum + item.totalRevenue, 0);
  const activeStaff = series.filter(
    (item) => item.email !== "unattributed" && (item.totalActions > 0 || item.totalRevenue > 0),
  ).length;

  return {
    period,
    metric,
    buckets,
    series,
    totalRevenue,
    totalActions,
    totalOrders: allOrders.size,
    activeStaff,
  };
}

/** The three channels we actually run. Everything else folds into direct. */
export type Channel = "google" | "meta" | "direct";

export const CHANNEL_LABELS: Record<Channel, string> = {
  google: "Google Ads",
  meta: "Meta",
  direct: "Direct",
};

/** Maps a stored source/medium pair onto one of the three channels. */
export function channelOf(source: string, medium: string): Channel {
  const value = `${source} ${medium}`.toLowerCase();
  if (value.includes("google") && (value.includes("cpc") || value.includes("ads") || value.includes("paid"))) return "google";
  if (/meta|facebook|instagram|^fb /.test(value) || value.includes(" fb")) return "meta";
  return "direct";
}

export interface ChannelRow {
  channel: Channel;
  quotes: number;
  booked: number;
  paid: number;
  revenue: number;
  broker: number;
  spend: number;
}

export async function loadAdSpend(db: D1Database, month: string): Promise<Record<string, number>> {
  const { results } = await db
    .prepare("SELECT channel, amount FROM ad_spend WHERE month = ?")
    .bind(month)
    .all<{ channel: string; amount: number }>();
  const out: Record<string, number> = {};
  for (const row of results) out[row.channel] = row.amount;
  return out;
}

export async function saveAdSpend(db: D1Database, month: string, amounts: Record<string, number>): Promise<void> {
  for (const [channel, amount] of Object.entries(amounts)) {
    await db
      .prepare(
        `INSERT INTO ad_spend (channel, month, amount, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(channel, month) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
      )
      .bind(channel, month, Math.max(0, Math.round(amount)), Date.now())
      .run();
  }
}

export interface SourceRow {
  source: string;
  medium: string;
  quotes: number;
  booked: number;
  paid: number;
  revenue: number;
  broker: number;
}

/**
 * The funnel by channel: every order carries the source it arrived with, so we
 * can see which channel produces quotes and which one actually produces money.
 */
export async function loadSourceFunnel(db: D1Database): Promise<SourceRow[]> {
  const { results } = await db
    .prepare(
      `SELECT
         channel.source,
         channel.medium,
         COUNT(*) AS quotes,
         SUM(CASE WHEN channel.status IN ('confirmed','contract_draft','assigned','picked_up','delivered','paid','paid_in_full') THEN 1 ELSE 0 END) AS booked,
         SUM(CASE WHEN channel.status IN ('paid','paid_in_full') THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN channel.status IN ('paid','paid_in_full') THEN COALESCE(channel.final_quote, channel.price, 0) ELSE 0 END) AS revenue,
         SUM(CASE WHEN channel.status IN ('paid','paid_in_full') THEN COALESCE(channel.broker_fee, 0) ELSE 0 END) AS broker
       FROM (
         SELECT
           -- normalise before grouping, otherwise NULL and 'direct' split into two rows
           LOWER(TRIM(COALESCE(NULLIF(source, ''), 'direct'))) AS source,
           LOWER(TRIM(COALESCE(NULLIF(medium, ''), 'none'))) AS medium,
           status, final_quote, price, broker_fee
         FROM orders
       ) AS channel
       GROUP BY channel.source, channel.medium
       ORDER BY quotes DESC`,
    )
    .all<SourceRow>();
  return results;
}

export interface CommissionBase {
  rate: number;
  actor: string;
  orders: { day: number; week: number; month: number };
  commission: { day: number; week: number; month: number };
}

/**
 * The flat commission only applies to orders a given person marked paid, so the
 * base is that person's paid orders — not every order in the company.
 */
export async function loadCommissionBase(db: D1Database, rate: number, actor: string): Promise<CommissionBase> {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStart = startOfWeek(now).getTime();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const { results } = await db
    .prepare("SELECT order_id, created_at FROM order_events WHERE kind = 'paid' AND LOWER(actor) = ? AND created_at >= ?")
    .bind(actor.toLowerCase(), monthStart)
    .all<{ order_id: number; created_at: number }>();

  const seen = new Map<number, number>();
  for (const row of results) {
    const previous = seen.get(row.order_id) ?? 0;
    if (row.created_at > previous) seen.set(row.order_id, row.created_at);
  }

  const count = (since: number) => Array.from(seen.values()).filter((at) => at >= since).length;
  const orders = { day: count(todayStart), week: count(weekStart), month: count(monthStart) };

  return {
    rate,
    actor,
    orders,
    commission: {
      day: orders.day * rate,
      week: orders.week * rate,
      month: orders.month * rate,
    },
  };
}
