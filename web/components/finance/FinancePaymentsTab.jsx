"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import LineChart from "../stats/LineChart";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useGrouping } from "../../lib/grouping";
import { useMoney } from "../../lib/money";
import { useFormat } from "../../lib/format";
import { minutesUntil, parseAppDate } from "../../lib/dates";
import { buildForecastDaily, buildPaymentTimeline, maxNotificationLeadMinutes, periodStart } from "../../lib/statsTimeline";
import { exportPaymentsCsv, exportPaymentsPdf } from "../../lib/pdfExport";
import { providerFallbackColor } from "../../lib/assets";

const PAGE_SIZES = [10, 25, 50, 100];

// Ported from the former standalone Stats page (web/app/(dashboard)/stats/page.jsx),
// now the "Payments" tab of the merged Finance section — per-VPS payment
// analytics for a selectable period, with the full exportable payments table.
export default function FinancePaymentsTab() {
  const { t, tc, locale } = useLocale();
  const { meta } = useAuth();
  const { assets, providers } = useData();
  const { providerOf } = useGrouping();
  const { formatMoney, convertAmount } = useMoney();
  const { formatDateTime } = useFormat();

  const [statsPeriod, setStatsPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const currency = meta.currency || "USDT";
  const vpsAssets = useMemo(() => assets.filter((asset) => asset.type === "vps"), [assets]);
  const overdueVpsCount = useMemo(() => vpsAssets.filter((asset) => minutesUntil(asset.expiresAt) < 0).length, [vpsAssets]);

  const periodPayments = useMemo(() => {
    const since = periodStart(statsPeriod);
    return vpsAssets
      .flatMap((asset) => (asset.payments || []).map((payment) => ({ ...payment, amount: convertAmount(payment.amount, payment.currency || "USDT", currency), currency, asset })))
      .filter((payment) => {
        if (!since) return true;
        const paidAt = parseAppDate(payment.paidAt);
        return !Number.isNaN(paidAt.getTime()) && paidAt >= since;
      });
  }, [vpsAssets, statsPeriod, currency, convertAmount]);

  const statCards = useMemo(() => {
    const periodTotal = periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const maxLeadMinutes = maxNotificationLeadMinutes(meta.notificationLeads);
    const soon = vpsAssets.filter((asset) => {
      const minutes = minutesUntil(asset.expiresAt);
      return minutes >= 0 && minutes <= maxLeadMinutes;
    }).length;
    const avg = periodPayments.length ? periodTotal / periodPayments.length : 0;
    const paidVps = new Set(periodPayments.map((payment) => payment.asset?.id)).size;
    const maxPayment = periodPayments.reduce((max, payment) => Math.max(max, Number(payment.amount || 0)), 0);
    return [
      { label: t("stats.cardServers"), value: vpsAssets.length },
      { label: t("stats.cardPaidServers"), value: paidVps },
      { label: t("stats.cardPaidPeriod"), value: formatMoney(periodTotal, currency) },
      { label: t("stats.cardPayments"), value: periodPayments.length },
      { label: t("stats.cardAvgPayment"), value: formatMoney(avg, currency) },
      { label: t("stats.cardMaxPayment"), value: formatMoney(maxPayment, currency) },
      { label: t("stats.cardSoon"), value: soon },
      { label: t("stats.cardOverdue"), value: overdueVpsCount },
    ];
  }, [periodPayments, meta.notificationLeads, vpsAssets, overdueVpsCount, currency, formatMoney, t]);

  const paymentTimeline = useMemo(() => buildPaymentTimeline(periodPayments, statsPeriod, locale, meta.timezone), [periodPayments, statsPeriod, locale, meta.timezone]);

  // A two-week-ahead projection of upcoming vps renewals, rendered as a
  // dashed continuation of the same line on the spend-by-day chart only.
  const forecastDaily = useMemo(() => buildForecastDaily(vpsAssets, currency, convertAmount, 14, locale, meta.timezone), [vpsAssets, currency, convertAmount, locale, meta.timezone]);

  const timelineAxisLabels = useMemo(() => {
    if (!paymentTimeline.length) return [];
    const indexes = [0, Math.floor((paymentTimeline.length - 1) / 2), paymentTimeline.length - 1];
    return [...new Set(indexes)].map((index) => paymentTimeline[index]?.label).filter(Boolean);
  }, [paymentTimeline]);

  // Marks chart start, the historical/forecast boundary ("today"), and the
  // end of the forecast week instead of [start, mid, end] of history alone
  // — the mid-history label stopped being the visual midpoint once the
  // forecast segment extended the line past it.
  const spendAxisLabels = useMemo(() => {
    if (!paymentTimeline.length) return [];
    const first = paymentTimeline[0]?.label;
    const boundary = paymentTimeline[paymentTimeline.length - 1]?.label;
    const last = forecastDaily[forecastDaily.length - 1]?.label;
    return [...new Set([first, boundary, last])].filter(Boolean);
  }, [paymentTimeline, forecastDaily]);

  const timelineUnitLabel = statsPeriod === "7d" ? t("stats.unitHours") : t("stats.unitDays");
  const timelineTotal = useMemo(() => paymentTimeline.reduce((sum, row) => sum + row.amount, 0), [paymentTimeline]);

  const providerSpend = useMemo(() => {
    const rows = providers
      .map((provider) => {
        const value = periodPayments.filter((payment) => payment.asset?.providerId === provider.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        return { id: provider.id, name: provider.name, color: providerFallbackColor(provider.id), value };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const max = Math.max(1, ...rows.map((row) => row.value));
    return rows.map((row) => ({ ...row, width: (row.value / max) * 100 }));
  }, [providers, periodPayments]);

  const paymentTableProviders = useMemo(() => {
    const ids = new Set(periodPayments.map((payment) => payment.asset?.providerId).filter(Boolean));
    return providers.filter((provider) => ids.has(provider.id));
  }, [periodPayments, providers]);

  const filteredPeriodPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodPayments.filter((payment) => {
      const provider = providerOf(payment.asset);
      const providerId = payment.asset?.providerId || "";
      const matchesProvider = providerFilter === "all" || (providerFilter === "none" && !providerId) || providerId === providerFilter;
      const haystack = [payment.asset?.name, provider?.name, payment.amount, formatDateTime(payment.paidAt)].join(" ").toLowerCase();
      return matchesProvider && haystack.includes(query);
    });
  }, [periodPayments, search, providerFilter, providerOf, formatDateTime]);

  const filteredPeriodPaymentsTotal = useMemo(() => filteredPeriodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [filteredPeriodPayments]);

  const periodPaymentsSorted = useMemo(() => {
    const rows = [...filteredPeriodPayments];
    const sorters = {
      "date-desc": (a, b) => String(b.paidAt).localeCompare(String(a.paidAt)),
      "date-asc": (a, b) => String(a.paidAt).localeCompare(String(b.paidAt)),
      "amount-desc": (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
      "amount-asc": (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
      "server-asc": (a, b) => String(a.asset?.name || "").localeCompare(String(b.asset?.name || ""), "ru"),
      "provider-asc": (a, b) => String(providerOf(a.asset)?.name || "").localeCompare(String(providerOf(b.asset)?.name || ""), "ru"),
    };
    return rows.sort(sorters[sort] || sorters["date-desc"]);
  }, [filteredPeriodPayments, sort, providerOf]);

  const paymentTablePages = Math.max(1, Math.ceil(periodPaymentsSorted.length / pageSize));
  const currentPage = Math.min(page, paymentTablePages);
  const paginatedPeriodPayments = periodPaymentsSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }
  function updateProviderFilter(value) {
    setProviderFilter(value);
    setPage(1);
  }
  function updateSort(value) {
    setSort(value);
    setPage(1);
  }
  function updatePageSize(value) {
    setPageSize(value);
    setPage(1);
  }
  function updatePeriod(value) {
    setStatsPeriod(value);
    setPage(1);
  }

  function paymentExportRows() {
    return periodPaymentsSorted.map((payment) => ({
      date: formatDateTime(payment.paidAt),
      server: payment.asset?.name || "",
      provider: providerOf(payment.asset)?.name || t("common.providerEmpty"),
      amount: Number(payment.amount || 0),
    }));
  }

  function handleExportCsv() {
    const rows = paymentExportRows();
    if (!rows.length) return;
    const amountHeader = `${t("export.amount")} (${currency})`;
    exportPaymentsCsv(
      [t("export.date"), t("export.server"), t("export.provider"), amountHeader],
      rows.map((row) => [row.date, row.server, row.provider, row.amount.toFixed(2)]),
      `payments-${statsPeriod}-${currency}.csv`
    );
  }

  async function handleExportPdf() {
    const rows = paymentExportRows();
    if (!rows.length) return;
    const headers = [t("export.date"), t("export.server"), t("export.provider"), `${t("export.amount")} (${currency})`];
    await exportPaymentsPdf(
      t("export.title"),
      headers,
      rows.map((row) => [row.date, row.server, row.provider, row.amount.toFixed(2)]),
      `payments-${statsPeriod}-${currency}.pdf`
    );
  }

  return (
    <>
      <div className="section-head tab-head">
        <span className="finance-tab-subtitle">{t("finance.tabPaymentsSubtitle")}</span>
        <AppSelect value={statsPeriod} onChange={updatePeriod} className="period-select" aria-label={t("stats.period")}>
          <AppSelectItem value="7d">{t("stats.period7d")}</AppSelectItem>
          <AppSelectItem value="30d">{t("stats.period30d")}</AppSelectItem>
          <AppSelectItem value="90d">{t("stats.period90d")}</AppSelectItem>
          <AppSelectItem value="180d">{t("stats.period180d")}</AppSelectItem>
          <AppSelectItem value="1y">{t("stats.period1y")}</AppSelectItem>
          <AppSelectItem value="all">{t("stats.periodAll")}</AppSelectItem>
        </AppSelect>
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <article key={card.label} className="stat-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="charts-grid">
        <article className="chart-panel wide-chart">
          <div className="chart-title-row">
            <h2>{t("stats.spendByUnit", { unit: timelineUnitLabel })}</h2>
            <span>{formatMoney(timelineTotal, currency)}</span>
          </div>
          <LineChart
            rows={paymentTimeline}
            forecastRows={forecastDaily}
            valueKey="amount"
            axisLabels={spendAxisLabels}
            emptyText={t("stats.paymentsNone")}
            formatValue={(row) => formatMoney(row.amount, currency)}
            formatCount={(row) => tc("payment", row.count)}
          />
        </article>
        <article className="chart-panel">
          <h2>{t("stats.providerSpend")}</h2>
          {providerSpend.length ? (
            <div className="bar-list">
              {providerSpend.map((row) => (
                <div key={row.id} className="bar-row">
                  <span>
                    <i style={{ background: row.color }} />
                    {row.name}
                  </span>
                  <div>
                    <i style={{ width: `${row.width}%`, background: row.color }} />
                  </div>
                  <strong>{formatMoney(row.value, currency)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-empty">{t("stats.spendNone")}</div>
          )}
        </article>
        <article className="chart-panel">
          <div className="chart-title-row">
            <h2>{t("stats.paymentCount")}</h2>
            <span>{tc("piece", periodPayments.length)}</span>
          </div>
          <LineChart
            rows={paymentTimeline}
            valueKey="count"
            compact
            axisLabels={timelineAxisLabels}
            emptyText={t("stats.paymentsNone")}
            formatValue={(row) => tc("piece", row.count)}
            formatCount={(row) => formatMoney(row.amount, currency)}
          />
        </article>
      </div>

      <article className="chart-panel table-panel">
        <div className="table-title-row">
          <div>
            <h2>{t("stats.allPayments")}</h2>
            <span>{t("stats.shownOf", { shown: filteredPeriodPayments.length, total: tc("payment", periodPayments.length) })}</span>
          </div>
          <div className="export-actions">
            <button className="secondary-button" type="button" onClick={handleExportCsv} disabled={!filteredPeriodPayments.length}>
              <Download size={16} />
              CSV
            </button>
            <button className="secondary-button" type="button" onClick={handleExportPdf} disabled={!filteredPeriodPayments.length}>
              <FileText size={16} />
              PDF
            </button>
          </div>
        </div>
        {periodPayments.length ? (
          <div className="table-toolbar">
            <input type="search" placeholder={t("stats.filter")} value={search} onChange={(e) => updateSearch(e.target.value)} />
            <AppSelect value={providerFilter} onChange={updateProviderFilter} aria-label={t("stats.providerFilter")}>
              <AppSelectItem value="all">{t("stats.allProviders")}</AppSelectItem>
              <AppSelectItem value="none">{t("common.providersEmpty")}</AppSelectItem>
              {paymentTableProviders.map((provider) => (
                <AppSelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </AppSelectItem>
              ))}
            </AppSelect>
            <AppSelect value={sort} onChange={updateSort} aria-label={t("stats.sort")}>
              <AppSelectItem value="date-desc">{t("stats.sortDateDesc")}</AppSelectItem>
              <AppSelectItem value="date-asc">{t("stats.sortDateAsc")}</AppSelectItem>
              <AppSelectItem value="amount-desc">{t("stats.sortAmountDesc")}</AppSelectItem>
              <AppSelectItem value="amount-asc">{t("stats.sortAmountAsc")}</AppSelectItem>
              <AppSelectItem value="server-asc">{t("stats.sortServerAsc")}</AppSelectItem>
              <AppSelectItem value="provider-asc">{t("stats.sortProviderAsc")}</AppSelectItem>
            </AppSelect>
            <AppSelect value={pageSize} onChange={(v) => updatePageSize(Number(v))} aria-label={t("stats.pageSize")}>
              {PAGE_SIZES.map((size) => (
                <AppSelectItem key={size} value={size}>
                  {size}
                </AppSelectItem>
              ))}
            </AppSelect>
          </div>
        ) : null}
        {paginatedPeriodPayments.length ? (
          <div className="payments-table">
            <div className="payments-table-head">
              <span>{t("common.date")}</span>
              <span>{t("type.vps")}</span>
              <span>{t("common.provider")}</span>
              <span className="cell-num">{t("common.sum")}</span>
            </div>
            {paginatedPeriodPayments.map((payment) => (
              <div key={payment.id} className="payments-table-row">
                <span>{formatDateTime(payment.paidAt)}</span>
                <span>{payment.asset.name}</span>
                <span>{providerOf(payment.asset)?.name || t("common.providerEmpty")}</span>
                <strong>{formatMoney(payment.amount, currency)}</strong>
              </div>
            ))}
          </div>
        ) : periodPayments.length ? (
          <div className="inline-empty">{t("stats.noFilteredPayments")}</div>
        ) : (
          <div className="inline-empty">{t("stats.noPeriodPayments")}</div>
        )}
        {filteredPeriodPayments.length ? (
          <div className="table-footer">
            <span>
              {t("common.total")}: {formatMoney(filteredPeriodPaymentsTotal, currency)}
            </span>
            <div className="pagination">
              <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p - 1)} disabled={currentPage <= 1} aria-label={t("stats.prevPage")}>
                <ChevronLeft size={16} />
              </button>
              <strong>
                {currentPage} / {paymentTablePages}
              </strong>
              <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p + 1)} disabled={currentPage >= paymentTablePages} aria-label={t("stats.nextPage")}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </article>
    </>
  );
}
