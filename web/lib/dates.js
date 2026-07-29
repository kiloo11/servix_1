import { translatePlural } from "./i18n";

export const DAY_MS = 86_400_000;
export const WEEK_MINUTES = 7 * 1440;

// Ported verbatim from App.vue — un-suffixed date strings are treated as
// +03:00/Moscow, not the browser's local timezone (see CLAUDE.md).
export function parseAppDate(value) {
  if (!value) return new Date(Number.NaN);
  const raw = String(value);
  const localValue = raw.includes("T") ? raw : `${raw}T00:00`;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue) ? `${localValue}:00` : localValue;
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(withSeconds) ? new Date(withSeconds) : new Date(`${withSeconds}+03:00`);
}

export function toLocalInput(date) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function formatDuration(minutes, locale = "ru") {
  const total = Math.max(0, Number(minutes || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return `${translatePlural(locale, "day", days)} ${translatePlural(locale, "hour", hours)}`;
  if (hours) return `${translatePlural(locale, "hour", hours)} ${translatePlural(locale, "minute", mins)}`;
  return translatePlural(locale, "minute", mins);
}

export function minutesUntil(value) {
  const date = parseAppDate(value);
  return Math.ceil((date - new Date()) / 60_000);
}

export function dueStateClass(value) {
  const diff = minutesUntil(value);
  if (diff < 0) return "is-overdue";
  if (diff <= WEEK_MINUTES) return "is-soon";
  return "";
}

export function formatDateTime(value, locale = "ru", timezone = "Europe/Moscow", notSpecified = "—") {
  const date = parseAppDate(value);
  if (Number.isNaN(date.getTime())) return notSpecified;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(date);
}

export function formatDate(value, locale = "ru", timezone = "Europe/Moscow", notSpecified = "—") {
  const date = value instanceof Date ? value : parseAppDate(value);
  if (Number.isNaN(date.getTime())) return notSpecified;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", { dateStyle: "short", timeZone: timezone }).format(date);
}

export function assetCycleDays(asset) {
  const payments = [...(asset.payments || [])].filter((payment) => payment.paidAt).sort((a, b) => parseAppDate(a.paidAt) - parseAppDate(b.paidAt));
  if (payments.length >= 2) {
    const diffs = [];
    for (let index = 1; index < payments.length; index += 1) {
      const diff = (parseAppDate(payments[index].paidAt) - parseAppDate(payments[index - 1].paidAt)) / DAY_MS;
      if (diff > 0) diffs.push(diff);
    }
    if (diffs.length) return Math.round(diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length);
  }
  return asset.type === "vps" ? 30 : 365;
}

export function assetLastPayment(asset) {
  const payments = [...(asset.payments || [])].filter((payment) => payment.paidAt);
  if (!payments.length) return null;
  return payments.sort((a, b) => parseAppDate(b.paidAt) - parseAppDate(a.paidAt))[0];
}

export function quickRenewBase(asset) {
  const current = parseAppDate(asset.expiresAt);
  return Number.isNaN(current.getTime()) ? new Date() : current;
}

// Extends by the length of the month the record's term ends in: 31 days in
// January, 28/29 in February, 30 in April. Day 0 of next month is the last
// day of the current one.
export function quickRenewDays(asset) {
  const date = quickRenewBase(asset);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function compareAssetsOrder(a, b) {
  const orderA = Number(a.sortOrder ?? 0);
  const orderB = Number(b.sortOrder ?? 0);
  if (orderA !== orderB) return orderA - orderB;
  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}
