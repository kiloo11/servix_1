"use client";

import { useEffect, useMemo, useState } from "react";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import RevenueTrendChart from "../dashboard/RevenueTrendChart";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFormat } from "../../lib/format";
import { formatMoney as formatMoneyRaw } from "../../lib/money";

const DEFAULT_SUMMARY = { cashRevenue: 0, bookingsMrr: 0, recognizedMrr: 0, arpu: 0, grossMargin: 0, infraCostPerSubscriber: 0, churnRate: 0 };
const DEFAULT_FORECAST = { dataPointsUsed: 0, confidence: "insufficient", history: [], forecast: [] };

const MOVEMENT_ORDER = ["new", "expansion", "reactivated", "retained", "contraction", "churned"];
const POSITIVE_BUCKETS = new Set(["new", "expansion", "reactivated"]);
const NEGATIVE_BUCKETS = new Set(["contraction", "churned"]);
const MOVEMENT_LABEL_KEYS = {
  new: "dashboard.movementNew",
  expansion: "dashboard.movementExpansion",
  reactivated: "dashboard.movementReactivated",
  retained: "dashboard.movementRetained",
  contraction: "dashboard.movementContraction",
  churned: "dashboard.movementChurned",
};
const CONFIDENCE_LABEL_KEYS = {
  low: "dashboard.confidenceLow",
  medium: "dashboard.confidenceMedium",
  high: "dashboard.confidenceHigh",
  insufficient: "dashboard.confidenceInsufficient",
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Bedolaga's numbers are RUB-native (unlike the rest of the app, which is
// currency-agnostic over user-entered asset prices) — no currency picker
// here, always render in RUB.
function formatRub(value, locale) {
  return formatMoneyRaw(value || 0, "RUB", locale);
}

function monthLabelOf(monthKey, intlLocale) {
  return new Intl.DateTimeFormat(intlLocale, { month: "short", year: "2-digit" }).format(new Date(`${monthKey}-01T00:00:00`));
}

// The former standalone primary-page Дашборд (SaaS/MRR metrics from the
// Python backend's /api/dashboard/* endpoints), now the "Дашборд" tab of the
// merged Finance section. Data is fetched directly here the same way the
// Overview tab fetches bot revenue — this isn't core CRUD data, so it
// doesn't belong in DataContext.
export default function FinanceDashboardTab() {
  const { t, locale } = useLocale();
  const { call } = useAuth();
  const toast = useToast();
  const { formatShort } = useFormat();
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";

  const [month, setMonth] = useState(currentMonthKey);
  // Assumed true until the first response lands, so the "not configured"
  // empty state doesn't flash before we actually know either way.
  const [configured, setConfigured] = useState(true);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [movement, setMovement] = useState({});
  const [trend, setTrend] = useState([]);
  const [forecast, setForecast] = useState(DEFAULT_FORECAST);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      options.push({ value, label: new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(date) });
    }
    return options;
  }, [intlLocale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call(`/api/dashboard/summary?month=${month}`);
        if (!cancelled) {
          setSummary(data);
          setConfigured(Boolean(data.configured));
        }
      } catch {
        if (!cancelled) {
          setSummary(DEFAULT_SUMMARY);
          toast(t("dashboard.loadError"));
        }
      }
      try {
        const data = await call(`/api/dashboard/mrr-movement?month=${month}`);
        if (!cancelled) setMovement(data.buckets || {});
      } catch {
        if (!cancelled) setMovement({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call, month, t, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call("/api/dashboard/trend?months=12");
        if (!cancelled) setTrend((data.months || []).map((row) => ({ ...row, monthLabel: monthLabelOf(row.month, intlLocale) })));
      } catch {
        if (!cancelled) setTrend([]);
      }
      try {
        const data = await call("/api/dashboard/forecast?metric=bookingsMrr&months=3");
        if (!cancelled) {
          setForecast({ ...data, forecast: (data.forecast || []).map((row) => ({ ...row, monthLabel: monthLabelOf(row.month, intlLocale) })) });
        }
      } catch {
        if (!cancelled) setForecast(DEFAULT_FORECAST);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call, intlLocale]);

  const movementRows = useMemo(() => {
    const rows = MOVEMENT_ORDER.map((key) => ({ key, ...(movement[key] || { count: 0, revenue: 0 }) }));
    const maxRevenue = Math.max(1, ...rows.map((row) => Math.abs(row.revenue || 0)));
    return rows.map((row) => ({ ...row, width: (Math.abs(row.revenue || 0) / maxRevenue) * 100 }));
  }, [movement]);

  const hasMovementData = movementRows.some((row) => row.count > 0);
  const formatMoney = (value) => formatRub(value, locale);

  return (
    <>
      <div className="section-head tab-head">
        <span className="finance-tab-subtitle">{t("dashboard.subtitle")}</span>
        <AppSelect value={month} onChange={setMonth} className="period-select" aria-label={t("dashboard.month")}>
          {monthOptions.map((option) => (
            <AppSelectItem key={option.value} value={option.value}>
              {option.label}
            </AppSelectItem>
          ))}
        </AppSelect>
      </div>

      {!configured ? (
        <div className="inline-empty">{t("dashboard.notConfigured")}</div>
      ) : (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span>{t("dashboard.cardCashRevenue")}</span>
              <strong>{formatMoney(summary.cashRevenue)}</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardBookingsMrr")}</span>
              <strong>{formatMoney(summary.bookingsMrr)}</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardRecognizedMrr")}</span>
              <strong>{formatMoney(summary.recognizedMrr)}</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardArpu")}</span>
              <strong>{formatMoney(summary.arpu)}</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardGrossMargin")}</span>
              <strong>{(summary.grossMargin * 100).toFixed(1)}%</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardChurnRate")}</span>
              <strong>{(summary.churnRate * 100).toFixed(1)}%</strong>
            </article>
            <article className="stat-card">
              <span>{t("dashboard.cardInfraCostPerSubscriber")}</span>
              <strong>{formatMoney(summary.infraCostPerSubscriber)}</strong>
            </article>
          </div>

          <div className="charts-grid">
            <article className="chart-panel">
              <h2>{t("dashboard.movementTitle")}</h2>
              {hasMovementData ? (
                <div className="bar-list">
                  {movementRows.map((row) => {
                    const color = POSITIVE_BUCKETS.has(row.key) ? "var(--success)" : NEGATIVE_BUCKETS.has(row.key) ? "var(--danger)" : "var(--muted)";
                    return (
                      <div key={row.key} className="bar-row">
                        <span>
                          <i style={{ background: color }} />
                          {t(MOVEMENT_LABEL_KEYS[row.key])} ({row.count})
                        </span>
                        <div>
                          <i style={{ width: `${row.width}%`, background: color }} />
                        </div>
                        <strong style={{ color }}>{formatMoney(row.revenue)}</strong>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="inline-empty">{t("dashboard.movementEmpty")}</div>
              )}
            </article>

            <article className="chart-panel wide-chart">
              <div className="chart-title-row">
                <h2>{t("dashboard.trendTitle")}</h2>
                <span>{t(CONFIDENCE_LABEL_KEYS[forecast.confidence] || CONFIDENCE_LABEL_KEYS.insufficient)}</span>
              </div>
              {trend.some((row) => row.bookingsMrr) ? (
                <div className="month-profit-chart-wrap">
                  <RevenueTrendChart trendMonths={trend} forecastRows={forecast.forecast} currency="RUB" t={t} formatMoney={formatMoney} formatShort={formatShort} />
                </div>
              ) : (
                <div className="inline-empty">{t("dashboard.trendEmpty")}</div>
              )}
            </article>
          </div>
        </>
      )}
    </>
  );
}
