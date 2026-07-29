import { parseAppDate } from "./dates";

// Ported verbatim from App.vue's periodStart/maxNotificationLeadMinutes/
// parseDurationToken/buildPaymentTimeline/alignTimelineStart/
// formatTimelineLabel/linePoints/chartHits/areaPoints/roundPoint — the hand-
// rolled SVG line-chart math used by StatsView (no charting library).

export function periodStart(period) {
  if (period === "all") return null;
  const days = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "1y": 365 }[period] || 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function parseDurationToken(value) {
  const match = String(value || "").toLowerCase().match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2] === "m" ? 1 : match[2] === "h" ? 60 : 1440;
  return amount > 0 ? { amount, unit: match[2], minutes: amount * multiplier } : null;
}

export function maxNotificationLeadMinutes(value) {
  const leads = String(value || "5m,2h,1d,3d,5d")
    .split(",")
    .map((item) => parseDurationToken(item.trim()))
    .filter(Boolean);
  return Math.max(...leads.map((lead) => lead.minutes), 1);
}

export function alignTimelineStart(date, stepHours) {
  const value = new Date(date);
  value.setMinutes(0, 0, 0);
  if (stepHours >= 24) value.setHours(0);
  else value.setHours(Math.floor(value.getHours() / stepHours) * stepHours);
  return value;
}

export function formatTimelineLabel(date, stepHours, locale = "ru", timezone = "Europe/Moscow") {
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";
  if (stepHours < 24) {
    return new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", hour: "2-digit", timeZone: timezone }).format(date);
  }
  return new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit", timeZone: timezone }).format(date);
}

export function buildPaymentTimeline(payments, period, locale = "ru", timezone = "Europe/Moscow") {
  const now = new Date();
  const validPayments = payments.map((payment) => ({ ...payment, date: parseAppDate(payment.paidAt) })).filter((payment) => !Number.isNaN(payment.date.getTime()));
  const since = periodStart(period) || validPayments.reduce((min, payment) => (payment.date < min ? payment.date : min), new Date(now.getTime() - 90 * 86400_000));
  const stepHours = { "7d": 6, "30d": 24, "90d": 24, "180d": 72, "1y": 168, all: 168 }[period] || 24;
  const stepMs = stepHours * 3600_000;
  const start = alignTimelineStart(since, stepHours);
  const rows = [];
  for (let time = start.getTime(); time <= now.getTime() + stepMs; time += stepMs) {
    const date = new Date(time);
    rows.push({ time, label: formatTimelineLabel(date, stepHours, locale, timezone), amount: 0, count: 0 });
  }
  for (const payment of validPayments) {
    const index = Math.floor((payment.date.getTime() - start.getTime()) / stepMs);
    if (rows[index]) {
      rows[index].amount += Number(payment.amount || 0);
      rows[index].count += 1;
    }
  }
  return rows.slice(-80);
}

export function roundPoint(value) {
  return Math.round(value * 100) / 100;
}

export function linePoints(rows, key) {
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  const last = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = rows.length === 1 ? 50 : (index / last) * 100;
      const y = 38 - (Number(row[key] || 0) / max) * 32;
      return `${roundPoint(x)},${roundPoint(y)}`;
    })
    .join(" ");
}

export function areaPoints(rows, key) {
  const points = linePoints(rows, key);
  if (!points) return "";
  return `0,40 ${points} 100,40`;
}

export function chartHits(rows, key) {
  if (!rows.length) return [];
  const max = Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  const last = Math.max(1, rows.length - 1);
  const hitWidth = rows.length === 1 ? 100 : 100 / rows.length;
  return rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : (index / last) * 100;
    const y = 38 - (Number(row[key] || 0) / max) * 32;
    return {
      key: `${key}-${row.time}`,
      x: roundPoint(Math.max(0, x - hitWidth / 2)),
      width: roundPoint(index === rows.length - 1 ? 100 - Math.max(0, x - hitWidth / 2) : hitWidth),
      point: { x: roundPoint(x), y: roundPoint(y), row },
    };
  });
}
