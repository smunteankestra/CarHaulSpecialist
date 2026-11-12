import { esc, layout, money, whenHtml } from "./views.ts";
import type { UserRow } from "./users.ts";
import type {
  RevenueTrends,
  StaffBucket,
  StaffMetric,
  StaffPerformance,
  StaffPeriod,
  StaffSeries,
  TrendSeries,
} from "./staff.ts";

interface ChartSeries {
  name: string;
  color: string;
  values: number[];
  staff?: StaffSeries;
}

const PERIOD_LABELS: Record<StaffPeriod, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};

const METRIC_LABELS: Record<StaffMetric, string> = {
  actions: "Actions",
  status: "Status changes",
  deliveries: "Deliveries",
  edits: "Edits",
  revenue: "Revenue",
};

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function barChart(
  buckets: StaffBucket[],
  series: ChartSeries[],
  format: "number" | "money",
  metric: StaffMetric,
): string {
  const width = 960;
  const height = 300;
  const left = 64;
  const right = 16;
  const top = 16;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const max = niceMax(maxValue);
  const groupWidth = plotWidth / Math.max(1, buckets.length);
  const barWidth = Math.max(2, (groupWidth * 0.78) / Math.max(1, series.length));

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const value = max * fraction;
      const y = top + plotHeight - fraction * plotHeight;
      const label = format === "money" ? money(Math.round(value)) : Math.round(value).toLocaleString();
      return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#e3eaf0" stroke-width="1"></line>
        <text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6b7c8c">${esc(label)}</text>`;
    })
    .join("");

  const bars = buckets
    .map((bucket, bucketIndex) => {
      const groupX = left + bucketIndex * groupWidth + groupWidth * 0.11;
      return series
        .map((item, seriesIndex) => {
          const value = item.values[bucketIndex] ?? 0;
          if (!value) return "";
          const barHeight = (value / max) * plotHeight;
          const x = groupX + seriesIndex * barWidth;
          const y = top + plotHeight - barHeight;
          const label = format === "money" ? money(value) : value.toLocaleString();
          const staff = item.staff;
          const breakdown = staff
            ? ` data-breakdown="1" data-email="${esc(staff.email)}" data-role="${esc(staff.role)}" data-actions="${staff.actions[bucketIndex] ?? 0}" data-status="${staff.status[bucketIndex] ?? 0}" data-deliveries="${staff.deliveries[bucketIndex] ?? 0}" data-edits="${staff.edits[bucketIndex] ?? 0}" data-revenue="${staff.revenue[bucketIndex] ?? 0}" data-orders="${staff.orders}"`
            : "";
          return `<rect x="${x}" y="${y}" width="${Math.max(1, barWidth - 1)}" height="${barHeight}" rx="2" fill="${item.color}" data-bucket="${esc(bucket.label)}" data-name="${esc(item.name)}" data-metric="${esc(metric)}" data-value="${value}"${breakdown} aria-label="${esc(`${bucket.label}: ${item.name} — ${label}`)}"></rect>`;
        })
        .join("");
    })
    .join("");

  const step = Math.max(1, Math.ceil(buckets.length / 9));
  const labels = buckets
    .map((bucket, index) =>
      index % step === 0
        ? `<text x="${left + index * groupWidth + groupWidth / 2}" y="${height - 18}" text-anchor="middle" font-size="10" fill="#6b7c8c">${esc(bucket.label)}</text>`
        : "",
    )
    .join("");

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Staff performance chart">${grid}${bars}${labels}</svg>`;
}

function metricValues(item: StaffSeries, metric: StaffMetric): number[] {
  switch (metric) {
    case "status":
      return item.status;
    case "deliveries":
      return item.deliveries;
    case "edits":
      return item.edits;
    case "revenue":
      return item.revenue;
    default:
      return item.actions;
  }
}

function legend(series: ChartSeries[]): string {
  return `<div class="chart-legend">${series
    .map(
      (item) =>
        `<span class="chart-legend-item"><span class="chart-dot" style="background:${item.color}"></span>${esc(item.name)}</span>`,
    )
    .join("")}</div>`;
}

function trendChart(trend: TrendSeries): string {
  const series: ChartSeries[] = [
    { name: "Revenue", color: "#76a03c", values: trend.revenue },
    { name: "Broker profit", color: "#33475b", values: trend.profit },
  ];
  return trend.revenueTotal > 0 || trend.profitTotal > 0
    ? `${barChart(trend.buckets, series, "money", "revenue")}${legend(series)}`
    : '<p class="muted">No paid orders in this range.</p>';
}

const TREND_LABELS: Record<"day" | "week" | "month", string> = {
  day: "Per day — last 14 days",
  week: "Per week — last 12 weeks",
  month: "Per month — last 12 months",
};

export function staffPerformancePage(
  data: StaffPerformance,
  viewer: UserRow,
  trends: RevenueTrends,
  marketing: { ads: number; tax: number },
): string {
  const href = (period: StaffPeriod, metric: StaffMetric) => `/admin/staff?period=${period}&metric=${metric}`;
  const periodTabs = (Object.keys(PERIOD_LABELS) as StaffPeriod[])
    .map(
      (value) =>
        `<a class="chip${data.period === value ? " active" : ""}" href="${href(value, data.metric)}">${PERIOD_LABELS[value]}</a>`,
    )
    .join("");
  const metricTabs = (Object.keys(METRIC_LABELS) as StaffMetric[])
    .map(
      (value) =>
        `<a class="chip${data.metric === value ? " active" : ""}" href="${href(data.period, value)}">${METRIC_LABELS[value]}</a>`,
    )
    .join("");

  const metricSeries = data.series
    .filter((item) => metricValues(item, data.metric).some((value) => value > 0))
    .map((item) => ({ name: item.name, color: item.color, values: metricValues(item, data.metric), staff: item }));
  const revenueValues = data.buckets.map((_, index) =>
    data.series.reduce((sum, item) => sum + (item.revenue[index] ?? 0), 0),
  );
  const revenueSeries: ChartSeries[] = revenueValues.some((value) => value > 0)
    ? [{ name: "Revenue", color: "#76a03c", values: revenueValues }]
    : [];

  // Fixed monthly charts: income, payout and profit over the last 12 months.
  const monthlyMoney: ChartSeries[] = trends.month.revenueTotal > 0
    ? [
        { name: "Income", color: "#76a03c", values: trends.month.revenue },
        {
          name: "Carrier payout",
          color: "#b6c4d2",
          values: trends.month.revenue.map((value, index) => Math.max(0, value - (trends.month.profit[index] ?? 0))),
        },
        { name: "Broker profit", color: "#33475b", values: trends.month.profit },
      ]
    : [];
  const monthlyOrders: ChartSeries[] = trends.month.orderTotal > 0
    ? [{ name: "Orders paid", color: "#2f6f4f", values: trends.month.orders }]
    : [];

  // Paid orders per bucket come from the order trend, not from staff activity.
  const paidTrend = trends[data.period === "year" ? "month" : data.period];
  const paidSeries: ChartSeries[] = paidTrend.orderTotal > 0
    ? [{ name: "Orders paid", color: "#2f6f4f", values: paidTrend.orders }]
    : [];

  const formatComparison = (value: number) =>
    data.metric === "revenue" ? money(value) : value.toLocaleString();
  const comparisonRows = [...data.series]
    .sort((a, b) => b.comparison.year - a.comparison.year || b.comparison.month - a.comparison.month)
    .map(
      (item) => `<tr>
      <td>${esc(item.name)}<br><span class="muted small">${esc(item.email)}</span></td>
      <td>${esc(item.role)}</td>
      <td>${formatComparison(item.comparison.today)}</td>
      <td>${formatComparison(item.comparison.week)}</td>
      <td>${formatComparison(item.comparison.month)}</td>
      <td>${formatComparison(item.comparison.year)}</td>
    </tr>`,
    )
    .join("");

  const tableRows = [...data.series]
    .sort((a, b) => b.totalActions - a.totalActions || b.totalRevenue - a.totalRevenue)
    .map(
      (item) => `<tr>
      <td>${esc(item.name)}<br><span class="muted small">${esc(item.email)}</span></td>
      <td>${esc(item.role)}</td>
      <td>${item.totalActions.toLocaleString()}</td>
      <td>${item.totalStatus.toLocaleString()}</td>
      <td>${item.totalDeliveries.toLocaleString()}</td>
      <td>${item.totalEdits.toLocaleString()}</td>
      <td>${item.orders.toLocaleString()}</td>
      <td>${money(item.totalRevenue)}</td>
      <td class="muted small">${item.lastActivity ? whenHtml(item.lastActivity) : "—"}</td>
    </tr>`,
    )
    .join("");

  return layout({
    admin: true,
    title: "Staff performance — Bond Auto Transport",
    description: "Dispatch performance by staff, period and metric.",
    body: `
<section class="wrap section">
  <div class="admin-head">
    <div>
      <p class="eyebrow">Dispatch</p>
      <h1 class="page-title">Staff performance</h1>
      <nav class="admin-nav">
        <a href="/admin/orders">Orders</a>
        <a href="/admin/staff" class="active">Performance</a>
        ${viewer.role === "admin" ? '<a href="/admin/users">Staff</a>' : ""}
        <a href="/admin/account">Account</a>
      </nav>
    </div>
  </div>

  <div class="filter-row">${periodTabs}</div>
  <div class="filter-row">${metricTabs}</div>

  <div class="staff-stats">
    <div class="staff-stat"><strong>${money(data.totalRevenue)}</strong><span>Revenue · ${PERIOD_LABELS[data.period]}</span></div>
    <div class="staff-stat"><strong>${data.totalActions.toLocaleString()}</strong><span>Actions · ${PERIOD_LABELS[data.period]}</span></div>
    <div class="staff-stat"><strong>${data.totalOrders.toLocaleString()}</strong><span>Orders touched</span></div>
    <div class="staff-stat"><strong>${data.activeStaff}</strong><span>Active staff</span></div>
  </div>

  <div class="card chart-card">
    <h3>Orders that reached Payments per ${PERIOD_LABELS[data.period].toLowerCase()}</h3>
    ${paidSeries.length
        ? `${barChart(paidTrend.buckets, paidSeries, "number", "status")}<p class="muted small">${paidTrend.orderTotal.toLocaleString()} orders marked paid in this range.</p>`
        : '<p class="muted">No order has been marked paid in this period.</p>'}
  </div>

  <div class="card chart-card">
    <h3>${METRIC_LABELS[data.metric]} by staff per ${PERIOD_LABELS[data.period].toLowerCase()}</h3>
    ${metricSeries.length
        ? `${barChart(data.buckets, metricSeries, data.metric === "revenue" ? "money" : "number", data.metric)}${legend(metricSeries)}`
        : '<p class="muted">No activity in this period.</p>'}
  </div>

  <div class="card chart-card">
    <h3>Total revenue per ${PERIOD_LABELS[data.period].toLowerCase()}</h3>
    ${revenueSeries.length
        ? barChart(data.buckets, revenueSeries, "money", "revenue")
        : '<p class="muted">No paid orders in this period.</p>'}
  </div>

  <h2 class="section-title mt">Monthly view</h2>
  <div class="card chart-card">
    <h3>Income, carrier payout and broker profit — per month</h3>
    ${monthlyMoney.length
        ? `${barChart(trends.month.buckets, monthlyMoney, "money", "revenue")}${legend(monthlyMoney)}<p class="muted small">Broker profit is what is left after the carrier is paid.</p>`
        : '<p class="muted">No paid orders yet.</p>'}
  </div>
  <div class="card chart-card">
    <h3>Orders marked paid — per month</h3>
    ${monthlyOrders.length
        ? `${barChart(trends.month.buckets, monthlyOrders, "number", "status")}<p class="muted small">${trends.month.orderTotal.toLocaleString()} paid orders in the last 12 months.</p>`
        : '<p class="muted">No order has been marked paid yet.</p>'}
  </div>

  <h2 class="section-title mt">Revenue and profit</h2>
  <div class="card chart-card">
    <h3>${TREND_LABELS.day}</h3>
    ${trendChart(trends.day)}
  </div>
  <div class="card chart-card">
    <h3>${TREND_LABELS.week}</h3>
    ${trendChart(trends.week)}
  </div>
  <div class="card chart-card">
    <h3>${TREND_LABELS.month}</h3>
    ${trendChart(trends.month)}
  </div>

  <h2 class="section-title mt">Profit, tax and advertising</h2>
  <form class="card quote-form" method="post" action="/admin/staff/marketing">
    <div class="field-row">
      <label class="field"><span>Advertising % of broker profit</span><input name="ads_percent" type="number" min="0" max="100" step="0.1" value="${marketing.ads}"></label>
      <label class="field"><span>Tax reserve % of broker profit</span><input name="tax_percent" type="number" min="0" max="100" step="0.1" value="${marketing.tax}"></label>
    </div>
    <button class="btn btn-accent btn-small" type="submit">Save percentages</button>
    <p class="form-note">Both percentages apply to broker profit — the broker fee on orders marked paid. Dispatchers see the numbers; only admins change them.</p>
  </form>

  <table class="table">
    <thead><tr><th>Range</th><th>Paid orders</th><th>Collected</th><th>Carrier payout</th><th>Broker profit</th><th>Tax (${marketing.tax}%)</th><th>Ads (${marketing.ads}%)</th><th>Kept</th><th>Ad budget / day</th></tr></thead>
    <tbody>${(["day", "week", "month"] as const)
        .map((key) => {
          const trend = trends[key];
          const payout = Math.max(0, trend.revenueTotal - trend.profitTotal);
          const tax = Math.round((trend.profitTotal * marketing.tax) / 100);
          const ads = Math.round((trend.profitTotal * marketing.ads) / 100);
          const days = key === "day" ? 1 : key === "week" ? 7 : 30;
          return `<tr>
      <td>${TREND_LABELS[key]}</td>
      <td>${trend.orderTotal.toLocaleString()}</td>
      <td>${money(trend.revenueTotal)}</td>
      <td>${money(payout)}</td>
      <td>${money(trend.profitTotal)}</td>
      <td>${money(tax)}</td>
      <td>${money(ads)}</td>
      <td><strong>${money(trend.profitTotal - tax - ads)}</strong></td>
      <td class="muted small">${money(Math.round(ads / days))}</td>
    </tr>`;
        })
        .join("")}</tbody>
  </table>
  <p class="muted small">The daily figure is the ad budget divided by the length of the range — what you can spend per day at the current pace.</p>

  <h2 class="section-title mt">Staff comparison</h2>
  <p class="muted small">${METRIC_LABELS[data.metric]} — today, this week, this month and this year.</p>
  <table class="table">
    <thead><tr><th>Staff</th><th>Role</th><th>Today</th><th>This week</th><th>This month</th><th>This year</th></tr></thead>
    <tbody>${comparisonRows}</tbody>
  </table>

  <h3 class="section-title mt">Selected period totals</h3>
  <table class="table">
    <thead><tr><th>Staff</th><th>Role</th><th>Actions</th><th>Status</th><th>Deliveries</th><th>Edits</th><th>Orders</th><th>Revenue</th><th>Last activity</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</section>`,
  });
}
