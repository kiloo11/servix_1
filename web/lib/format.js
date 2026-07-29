"use client";

import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { DAY_MS, WEEK_MINUTES, minutesUntil, dueStateClass, formatDate, formatDateTime, formatDuration, parseAppDate, quickRenewDays } from "./dates";

// See lib/dates.js for the pure date math this binds to meta.timezone/locale —
// mirrors App.vue's formatDateTime/formatDate/daysText/dueStateClass/
// assetNextPaymentDate/quickRenewLabel, which all read `this.currentLocale`/
// `this.meta.timezone` implicitly.
export function useFormat() {
  const { meta } = useAuth();
  const { locale, t, tc } = useLocale();
  const timezone = meta.timezone || "Europe/Moscow";

  function fDateTime(value) {
    return formatDateTime(value, locale, timezone, t("common.notSpecified"));
  }
  function fDate(value) {
    return formatDate(value, locale, timezone, t("common.notSpecified"));
  }
  function daysText(value) {
    const minutes = minutesUntil(value);
    if (minutes < 0) return t("duration.overdue", { duration: formatDuration(Math.abs(minutes), locale) });
    if (minutes === 0) return t("duration.expiresNow");
    return t("duration.expiresIn", { duration: formatDuration(minutes, locale) });
  }
  function alertWhen(item) {
    if (item.minutesLeft < 0) return t("duration.overdueLower", { duration: formatDuration(Math.abs(item.minutesLeft), locale) });
    if (item.minutesLeft === 0) return t("common.now");
    return t("duration.in", { duration: formatDuration(item.minutesLeft, locale) });
  }
  function assetNextPaymentDate(asset) {
    const expires = parseAppDate(asset.expiresAt);
    if (!expires || Number.isNaN(expires.getTime())) return "";
    return fDate(new Date(expires.getTime() - DAY_MS));
  }
  function quickRenewLabel(asset) {
    return t("assets.quickRenew", { days: tc("day", quickRenewDays(asset)) });
  }
  function formatShort(value) {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  return {
    formatDateTime: fDateTime,
    formatDate: fDate,
    formatDuration: (m) => formatDuration(m, locale),
    formatShort,
    daysText,
    alertWhen,
    dueStateClass,
    minutesUntil,
    assetNextPaymentDate,
    quickRenewLabel,
  };
}

export { DAY_MS, WEEK_MINUTES };
