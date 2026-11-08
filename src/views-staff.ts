import { esc, layout, money, when } from "./views.ts";
import type { UserRow } from "./users.ts";
import type { StaffBucket, StaffMetric, StaffPerformance, StaffPeriod, StaffSeries } from "./staff.ts";

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

export function staffPerformancePage(data: StaffPerformance, viewer: UserRow): string {
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
    ? [{ name: "Revenue", color: "#f26a1b", values: revenueValues }]
    : [];

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
      <td class="muted small">${item.lastActivity ? when(item.lastActivity) : "—"}</td>
    </tr>`,
    )
    .join("");

  return layout({
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

  <h2 class="section-title mt">Staff comparison</h2>
  <table class="table">
    <thead><tr><th>Staff</th><th>Role</th><th>Actions</th><th>Status</th><th>Deliveries</th><th>Edits</th><th>Orders</th><th>Revenue</th><th>Last activity</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</section>`,
  });
}
