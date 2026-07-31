import { DAY_MS, assetCycleDays, parseAppDate } from "./dates";

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Projects each active asset's own price forward from its `expiresAt` in
// assetCycleDays() increments, bucketing every renewal that hasn't happened
// yet into the calendar month it falls in — a deterministic renewal
// SCHEDULE, not a statistical trend, since asset costs are already known
// bookkeeping (we know exactly what renews when, and for how much), unlike
// revenue, which needs the regression in forecasting.py instead. Only
// not-yet-due renewals are counted (walked forward past `now`), so the
// current month's bucket never double-counts a renewal that's already been
// paid and already shows up in the real payment history.
export function projectFutureCostByMonth(assets, currency, convertAmount, monthsAhead) {
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < monthsAhead; i++) {
    monthKeys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  const totals = new Map(monthKeys.map((key) => [key, 0]));
  const horizonEnd = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);

  for (const asset of assets) {
    if (asset.inactive) continue;
    const cycleDays = Math.max(1, assetCycleDays(asset));
    const price = convertAmount(Number(asset.price || 0), asset.priceCurrency || "USDT", currency);
    if (!price) continue;
    let next = parseAppDate(asset.expiresAt);
    if (Number.isNaN(next.getTime())) continue;
    while (next.getTime() < now.getTime()) next = new Date(next.getTime() + cycleDays * DAY_MS);
    while (next < horizonEnd) {
      const key = monthKeyOf(next);
      if (totals.has(key)) totals.set(key, totals.get(key) + price);
      next = new Date(next.getTime() + cycleDays * DAY_MS);
    }
  }

  return monthKeys.map((month) => ({ month, projectedCost: totals.get(month) }));
}
