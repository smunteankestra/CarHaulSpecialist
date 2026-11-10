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

const STATUS_KINDS = new Set(["quoted", "confirmed", "assigned", "picked_up", "delivered", "paid", "cancelled"]);

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
      .prepare("SELECT id, paid_amount, broker_fee, updated_at FROM orders WHERE paid_amount IS NOT NULL AND status = 'paid'")
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
      .prepare("SELECT id, paid_amount, updated_at FROM orders WHERE paid_amount IS NOT NULL AND status = 'paid'")
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

  for (const user of users) {
    ensureSeries(user.email.toLowerCase(), user.name, ROLE_LABELS[user.role as Role] ?? user.role);
  }

  for (const event of events) {
    const actor = String(event.actor || "").toLowerCase();
    if (!actor || actor === "customer") continue;
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
    const actor = (paid?.actor || "unattributed").toLowerCase();
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
    if (!actor || actor === "customer") continue;
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
