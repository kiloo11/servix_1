"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import TrendTag from "../ui/TrendTag";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useFormat } from "../../lib/format";
import { formatMoney as formatMoneyRaw } from "../../lib/money";
import { exportMonthlyReportPdf } from "../../lib/pdfExport";
import { computeTrend } from "../../lib/trend";

function monthLabelOf(monthKey, intlLocale) {
  return new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(new Date(`${monthKey}-01T00:00:00`));
}

// Bedolaga's numbers are RUB-native, same reasoning as FinanceDashboardTab.jsx
// — no currency picker here, always render in RUB.
function formatRub(value, locale) {
  return formatMoneyRaw(value || 0, "RUB", locale);
}

// Replaces the former "Курсы валют" tab. Data is fetched directly here (not
// core CRUD data, so it doesn't belong in DataContext), straight from
// GET /api/dashboard/reports — which itself just re-runs the same per-month
// aggregation functions the Дашборд/P&L tabs already call, for every
// COMPLETED month with any data. Nothing is stored server-side; a month's
// report is always computed fresh, and the PDF is rendered client-side
// (lib/pdfExport.js) from that response, same pattern as the Payments tab's
// CSV/PDF export.
export default function FinanceReportsTab() {
  const { t, locale } = useLocale();
  const { meta, call } = useAuth();
  const { formatDateTime } = useFormat();
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";

  const [months, setMonths] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    call("/api/dashboard/reports")
      .then((data) => {
        if (cancelled) return;
        setMonths(data.months || []);
        setConfigured(Boolean(data.configured));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [call]);

  const formatMoney = (value) => formatRub(value, locale);

  // Renders the same ↑/↓ direction+color TrendTag shows on screen, as plain
  // text for the canvas-rendered PDF (see lib/trend.js — shared math, two
  // renderers).
  function trendFor(row, previousRow, key, invert = false) {
    const trend = computeTrend(row[key], previousRow?.[key], invert);
    if (!trend) return null;
    if (trend.flat) return { text: t("summary.trendFlat"), good: null };
    return { text: `${trend.up ? "↑" : "↓"} ${trend.percent.toFixed(1)}%`, good: trend.good };
  }

  function downloadReport(row, previousRow) {
    const monthLabel = monthLabelOf(row.month, intlLocale);
    const sections = [
      {
        heading: t("reports.sectionFinance"),
        rows: [
          { label: t("pnl.cardRevenueMonth"), value: formatMoney(row.cashRevenue), trend: trendFor(row, previousRow, "cashRevenue") },
          { label: t("pnl.cardCostMonth"), value: formatMoney(row.expense), trend: trendFor(row, previousRow, "expense", true) },
          { label: t("pnl.cardNetMonth"), value: formatMoney(row.net), trend: trendFor(row, previousRow, "net") },
        ],
      },
    ];
    if (configured) {
      sections.push({
        heading: t("reports.sectionSaas"),
        rows: [
          { label: t("dashboard.cardBookingsMrr"), value: formatMoney(row.bookingsMrr), trend: trendFor(row, previousRow, "bookingsMrr") },
          { label: t("dashboard.cardRecognizedMrr"), value: formatMoney(row.recognizedMrr), trend: trendFor(row, previousRow, "recognizedMrr") },
          { label: t("dashboard.cardArpu"), value: formatMoney(row.arpu), trend: trendFor(row, previousRow, "arpu") },
          { label: t("dashboard.cardGrossMargin"), value: `${(row.grossMargin * 100).toFixed(1)}%`, trend: trendFor(row, previousRow, "grossMargin") },
          { label: t("dashboard.cardChurnRate"), value: `${(row.churnRate * 100).toFixed(1)}%`, trend: trendFor(row, previousRow, "churnRate", true) },
        ],
      });
    }
    exportMonthlyReportPdf({
      siteTitle: meta.siteTitle || "SERVIX",
      title: t("reports.pdfTitle"),
      monthLabel,
      generatedAt: t("reports.generatedAt", { value: formatDateTime(new Date().toISOString()) }),
      sections,
      filename: `report-${row.month}.pdf`,
    });
  }

  return (
    <>
      <div className="section-head tab-head">
        <span className="finance-tab-subtitle">{t("reports.subtitle")}</span>
      </div>

      <article className="chart-panel table-panel">
        {months.length ? (
          <div className="payments-table">
            <div className="payments-table-head pnl-table-row">
              <span>{t("reports.colMonth")}</span>
              <span className="cell-num">{t("reports.colRevenue")}</span>
              <span className="cell-num">{t("reports.colExpense")}</span>
              <span className="cell-num">{t("reports.colNet")}</span>
              <span className="cell-num">{t("reports.colMrr")}</span>
              <span className="cell-num">{t("reports.colDownload")}</span>
            </div>
            {months.map((row, index) => {
              // `months` is sorted newest-first and only includes months
              // with some financial activity (see the backend endpoint) —
              // so the next entry is the last month that had activity, not
              // necessarily the immediately preceding calendar month. That's
              // the more meaningful comparison anyway for a lumpy expense
              // (e.g. a quarterly renewal) skipping the quiet months between.
              const previousRow = months[index + 1];
              return (
                <div key={row.month} className="payments-table-row pnl-table-row">
                  <span>{monthLabelOf(row.month, intlLocale)}</span>
                  <span className="reports-value-cell">
                    <strong>{formatMoney(row.cashRevenue)}</strong>
                    <TrendTag current={row.cashRevenue} previous={previousRow?.cashRevenue} />
                  </span>
                  <span className="reports-value-cell">
                    <strong>{formatMoney(row.expense)}</strong>
                    <TrendTag current={row.expense} previous={previousRow?.expense} invert />
                  </span>
                  <span className="reports-value-cell">
                    <strong>{formatMoney(row.net)}</strong>
                    <TrendTag current={row.net} previous={previousRow?.net} />
                  </span>
                  <span className="reports-value-cell">
                    {configured ? (
                      <>
                        <strong>{formatMoney(row.bookingsMrr)}</strong>
                        <TrendTag current={row.bookingsMrr} previous={previousRow?.bookingsMrr} />
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="cell-num">
                    <button className="secondary-button icon-only" type="button" onClick={() => downloadReport(row, previousRow)} aria-label={t("reports.colDownload")}>
                      <Download size={16} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="inline-empty">{loaded ? t("reports.empty") : t("reports.loading")}</div>
        )}
      </article>
    </>
  );
}
