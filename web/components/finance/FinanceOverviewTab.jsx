"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/Accordion";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import NetChart from "../pnl/NetChart";
import TrendTag from "../ui/TrendTag";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useGrouping } from "../../lib/grouping";
import { useMoney } from "../../lib/money";
import { useFormat } from "../../lib/format";
import { assetCycleDays, assetLastPayment } from "../../lib/dates";
import { projectFutureCostByMonth } from "../../lib/costForecast";

const DEFAULT_FORECAST = { dataPointsUsed: 0, confidence: "insufficient", history: [], forecast: [] };

const CONFIDENCE_LABEL_KEYS = {
  low: "dashboard.confidenceLow",
  medium: "dashboard.confidenceMedium",
  high: "dashboard.confidenceHigh",
  insufficient: "dashboard.confidenceInsufficient",
};

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Ported from the former standalone P&L page (web/app/(dashboard)/pnl/page.jsx),
// now the "Overview" tab of the merged Finance section.
//
// Revenue used to come from botRevenue/botRevenueMonthly (api/app/core/bot_revenue.py)
// — a separate rolling-30-day, live-fetched pipeline, independent from the more
// precise calendar-month cashRevenue metric the Дашборд tab uses (platega deposits
// only, via api/app/core/dashboard_metrics.py). The two could silently disagree.
// This tab now fetches the SAME /api/dashboard/trend and /api/dashboard/forecast
// endpoints Дашборд already uses (not core CRUD data, so fetched directly here
// rather than centralized in DataContext, same reasoning as FinanceDashboardTab.jsx)
// — botRevenue itself is kept only for the raw bot-deposits drill-down table below,
// which is deliberately a broader feed than the revenue KPI above it.
//
// Cost has no such statistical trend to speak of — an asset's future renewals are
// already fully known bookkeeping (price, cycle, expiresAt), so the forecast side
// for cost is a deterministic schedule (lib/costForecast.js), not a regression.
export default function FinanceOverviewTab() {
  const { t, tc, locale } = useLocale();
  const { meta, call } = useAuth();
  const { assets, botRevenue } = useData();
  const { providerOf } = useGrouping();
  const { formatMoney, convertAmount, paymentsTotalIn, formatPaymentTotal } = useMoney();
  const { formatDateTime, formatShort } = useFormat();

  const currency = meta.currency || "USDT";
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";

  const [horizonMonths, setHorizonMonths] = useState(3);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("renewal-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [botPage, setBotPage] = useState(1);
  const [botPageSize] = useState(10);

  const [trend, setTrend] = useState([]);
  const [forecast, setForecast] = useState(DEFAULT_FORECAST);

  useEffect(() => {
    let cancelled = false;
    call("/api/dashboard/trend?months=12")
      .then((data) => {
        if (!cancelled) setTrend(data.months || []);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      });
    return () => {
      cancelled = true;
    };
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    call(`/api/dashboard/forecast?metric=cashRevenue&months=${horizonMonths}`)
      .then((data) => {
        if (!cancelled) setForecast(data);
      })
      .catch(() => {
        if (!cancelled) setForecast(DEFAULT_FORECAST);
      });
    return () => {
      cancelled = true;
    };
  }, [call, horizonMonths]);

  const pnlRows = useMemo(
    () =>
      assets
        .filter((asset) => !asset.inactive)
        .map((asset) => {
          const last = assetLastPayment(asset);
          const cycleDays = assetCycleDays(asset);
          const cyclePrice = convertAmount(Number(asset.price || 0), asset.priceCurrency || "USDT", currency);
          const monthlyCost = asset.type === "vps" ? cyclePrice : (cyclePrice / Math.max(1, cycleDays)) * 30;
          return {
            id: asset.id,
            asset,
            name: asset.name,
            type: asset.type,
            provider: providerOf(asset)?.name || t("common.providerEmpty"),
            totalDisplay: formatPaymentTotal(asset.payments),
            lastAmount: last ? Number(last.amount || 0) : 0,
            lastCurrency: last ? last.currency || "USDT" : currency,
            lastDate: last ? last.paidAt : "",
            cycleDays,
            expiresAt: asset.expiresAt,
            nextRenewalAmount: cyclePrice,
            nextRenewalDisplay: formatMoney(cyclePrice, currency),
            monthlyCost,
            monthlyCostDisplay: formatMoney(monthlyCost, currency),
          };
        }),
    [assets, currency, providerOf, convertAmount, formatMoney, formatPaymentTotal, t]
  );

  const pnlFilteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pnlRows;
    return pnlRows.filter((row) => [row.name, row.provider, t(`type.${row.type}`) || t("type.record")].join(" ").toLowerCase().includes(query));
  }, [pnlRows, search, t]);

  const pnlSortedRows = useMemo(() => {
    const rows = [...pnlFilteredRows];
    const sorters = {
      "nextAmount-desc": (a, b) => b.nextRenewalAmount - a.nextRenewalAmount,
      "nextAmount-asc": (a, b) => a.nextRenewalAmount - b.nextRenewalAmount,
      "renewal-asc": (a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)),
      "renewal-desc": (a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)),
      "name-asc": (a, b) => String(a.name).localeCompare(String(b.name), "ru"),
    };
    return rows.sort(sorters[sort] || sorters["renewal-asc"]);
  }, [pnlFilteredRows, sort]);

  const pnlPages = Math.max(1, Math.ceil(pnlSortedRows.length / pageSize));
  const pnlCurrentPage = Math.min(page, pnlPages);
  const pnlPaginatedRows = pnlSortedRows.slice((pnlCurrentPage - 1) * pageSize, pnlCurrentPage * pageSize);
  const pnlMonthlyCostTotalDisplay = formatMoney(
    pnlSortedRows.reduce((sum, row) => sum + row.monthlyCost, 0),
    currency
  );

  const pnlAllPayments = useMemo(() => pnlRows.flatMap((row) => row.asset.payments || []), [pnlRows]);

  const pnlHistoricalTotalDisplay = formatPaymentTotal(pnlAllPayments);
  const pnlRevenueTotalDisplay = formatMoney(convertAmount(botRevenue.totalRub || 0, "RUB", currency), currency);

  // cashRevenue per calendar month, straight from the same endpoint (and the
  // same underlying platega-deposits metric) the Дашборд tab already uses —
  // see the file-level comment for why this replaces botRevenueMonthly.
  const revenueByMonth = useMemo(() => new Map(trend.map((row) => [row.month, row.cashRevenue])), [trend]);
  const costByMonth = useMemo(() => {
    const map = new Map();
    for (const payment of pnlAllPayments) {
      const key = String(payment.paidAt || "").slice(0, 7);
      if (!key) continue;
      const amount = convertAmount(payment.amount, payment.currency || "USDT", currency);
      map.set(key, (map.get(key) || 0) + amount);
    }
    return map;
  }, [pnlAllPayments, currency, convertAmount]);

  const trendCurrentMonthKey = monthKeyOf(new Date());
  const trendPreviousMonthKey = monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const trendCurrentCost = costByMonth.get(trendCurrentMonthKey) || 0;
  const trendPreviousCost = costByMonth.get(trendPreviousMonthKey) || 0;
  const trendCurrentRevenue = convertAmount(revenueByMonth.get(trendCurrentMonthKey) || 0, "RUB", currency);
  const trendPreviousRevenue = convertAmount(revenueByMonth.get(trendPreviousMonthKey) || 0, "RUB", currency);
  const trendCurrentNet = trendCurrentRevenue - trendCurrentCost;
  const trendPreviousNet = trendPreviousRevenue - trendPreviousCost;

  const pnlCostMonthDisplay = formatMoney(trendCurrentCost, currency);
  const pnlCostMonthRubDisplay = formatMoney(convertAmount(trendCurrentCost, currency, "RUB"), "RUB");
  const pnlRevenueMonthDisplay = formatMoney(trendCurrentRevenue, currency);
  const pnlRevenueMonthRubDisplay = formatMoney(revenueByMonth.get(trendCurrentMonthKey) || 0, "RUB");
  const pnlNetMonthDisplay = formatMoney(trendCurrentNet, currency);
  const pnlNetMonthRubDisplay = formatMoney((revenueByMonth.get(trendCurrentMonthKey) || 0) - convertAmount(trendCurrentCost, currency, "RUB"), "RUB");
  const pnlNetTotalDisplay = formatMoney(convertAmount(botRevenue.totalRub || 0, "RUB", currency) - paymentsTotalIn(pnlAllPayments, currency), currency);

  // Deterministic renewal schedule (see lib/costForecast.js), one bucket
  // extra so it always covers whatever months the revenue forecast returns.
  const costProjectionByMonth = useMemo(() => {
    const rows = projectFutureCostByMonth(assets, currency, convertAmount, horizonMonths + 1);
    return new Map(rows.map((row) => [row.month, row.projectedCost]));
  }, [assets, currency, convertAmount, horizonMonths]);

  // Combines the backend's revenue forecast (regression, converted from RUB
  // to the display currency) with the deterministic cost schedule into a
  // net-profit forecast per month. The current month (if forecast[0] shares
  // trend's current month, i.e. it's the model's own estimate for a
  // still-in-progress month — see forecasting.py) adds the actual cost
  // already paid this month to the not-yet-due schedule, so it doesn't
  // double count and doesn't undercount either.
  const netForecastRows = useMemo(() => {
    return (forecast.forecast || []).map((row) => {
      const revenueValue = convertAmount(row.value, "RUB", currency);
      const revenueLower = convertAmount(row.lower, "RUB", currency);
      const revenueUpper = convertAmount(row.upper, "RUB", currency);
      const scheduled = costProjectionByMonth.get(row.month) || 0;
      const cost = row.month === trendCurrentMonthKey ? trendCurrentCost + scheduled : scheduled;
      const date = new Date(`${row.month}-01T00:00:00`);
      return {
        month: row.month,
        label: new Intl.DateTimeFormat(intlLocale, { month: "short" }).format(date),
        monthLabel: new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(date),
        value: revenueValue - cost,
        lower: revenueLower - cost,
        upper: revenueUpper - cost,
      };
    });
  }, [forecast, costProjectionByMonth, trendCurrentCost, trendCurrentMonthKey, currency, convertAmount, intlLocale]);

  const pnlNetForecastTotal = useMemo(() => netForecastRows.reduce((sum, row) => sum + row.value, 0), [netForecastRows]);
  const pnlNetForecastMonthly = netForecastRows.length ? pnlNetForecastTotal / netForecastRows.length : 0;
  const pnlNetForecastMonthlyDisplay = formatMoney(pnlNetForecastMonthly, currency);
  const pnlNetForecastTotalDisplay = formatMoney(pnlNetForecastTotal, currency);

  const pnlMonthlySeries = useMemo(() => {
    const monthsBack = 12;
    const now = new Date();
    const rows = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKeyOf(date);
      const revenue = convertAmount(revenueByMonth.get(key) || 0, "RUB", currency);
      const cost = costByMonth.get(key) || 0;
      rows.push({
        month: key,
        label: new Intl.DateTimeFormat(intlLocale, { month: "short" }).format(date),
        monthLabel: new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(date),
        revenue,
        cost,
        net: revenue - cost,
      });
    }
    return rows;
  }, [revenueByMonth, costByMonth, currency, convertAmount, intlLocale]);

  const pnlBotItems = botRevenue.items || [];
  const pnlBotPages = Math.max(1, Math.ceil(pnlBotItems.length / botPageSize));
  const pnlBotCurrentPage = Math.min(botPage, pnlBotPages);
  const pnlBotPaginatedItems = pnlBotItems.slice((pnlBotCurrentPage - 1) * botPageSize, pnlBotCurrentPage * botPageSize);

  function updateSearch(value) {
    setSearch(value);
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

  return (
    <>
      <div className="section-head tab-head">
        <span className="finance-tab-subtitle">{t("pnl.subtitle")}</span>
        <AppSelect value={horizonMonths} onChange={(v) => setHorizonMonths(Number(v))} className="period-select" aria-label={t("pnl.horizon")}>
          <AppSelectItem value={3}>{tc("month", 3)}</AppSelectItem>
          <AppSelectItem value={6}>{tc("month", 6)}</AppSelectItem>
          <AppSelectItem value={12}>{tc("month", 12)}</AppSelectItem>
        </AppSelect>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-card-head">
            <span>{t("pnl.cardCostMonth")}</span>
            <TrendTag current={trendCurrentCost} previous={trendPreviousCost} invert />
          </div>
          <strong>{pnlCostMonthDisplay}</strong>
          {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlCostMonthRubDisplay}</small> : null}
          <small className="stat-card-sub">
            {t("pnl.cardHistorical")}: {pnlHistoricalTotalDisplay}
          </small>
        </article>
        {botRevenue.configured ? (
          <>
            <article className="stat-card">
              <div className="stat-card-head">
                <span>{t("pnl.cardRevenueMonth")}</span>
                <TrendTag current={trendCurrentRevenue} previous={trendPreviousRevenue} />
              </div>
              <strong>{pnlRevenueMonthDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlRevenueMonthRubDisplay}</small> : null}
              <small className="stat-card-sub">
                {t("pnl.cardRevenue")}: {pnlRevenueTotalDisplay}
              </small>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span>{t("pnl.cardNetMonth")}</span>
                <TrendTag current={trendCurrentNet} previous={trendPreviousNet} />
              </div>
              <strong>{pnlNetMonthDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlNetMonthRubDisplay}</small> : null}
              <small className="stat-card-sub">
                {t("pnl.cardNet")}: {pnlNetTotalDisplay}
              </small>
            </article>
            <article className="stat-card">
              <span>{t("pnl.cardNetForecastMonthly")}</span>
              <strong>{pnlNetForecastMonthlyDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {formatMoney(convertAmount(pnlNetForecastMonthly, currency, "RUB"), "RUB")}</small> : null}
              <small className="stat-card-sub">
                {t("pnl.cardNetForecastTotal", { months: horizonMonths })}: {pnlNetForecastTotalDisplay}
              </small>
            </article>
          </>
        ) : null}
      </div>

      {botRevenue.configured ? (
        <article className="chart-panel month-profit-panel">
          <div className="chart-title-row">
            <h2>{t("pnl.monthlyProfitTitle")}</h2>
            {forecast.confidence !== "insufficient" ? <span>{t(CONFIDENCE_LABEL_KEYS[forecast.confidence] || CONFIDENCE_LABEL_KEYS.insufficient)}</span> : null}
          </div>
          {pnlMonthlySeries.some((row) => row.revenue || row.cost) ? (
            <div className="month-profit-chart-wrap">
              <NetChart rows={pnlMonthlySeries} forecastRows={netForecastRows} currency={currency} t={t} formatMoney={formatMoney} formatShort={formatShort} />
            </div>
          ) : (
            <div className="inline-empty">{t("pnl.monthlyProfitEmpty")}</div>
          )}
        </article>
      ) : null}

      <AccordionRoot type="single" collapsible defaultValue="expenses" className="pnl-tables-stack">
        {botRevenue.configured ? (
          <AccordionItem value="bot-payments" className="chart-panel table-panel">
            <AccordionTrigger className="table-collapsible-trigger">
              <div className="heading-stack">
                <h2>{t("pnl.botPaymentsTitle")}</h2>
                <span className="stat-card-sub">{tc("payment", botRevenue.count)}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {pnlBotPaginatedItems.length ? (
                <div className="payments-table">
                  <div className="payments-table-head bot-table-row">
                    <span>{t("common.date")}</span>
                    <span>{t("pnl.botPaymentMethod")}</span>
                    <span className="cell-num">{t("common.sum")}</span>
                  </div>
                  {pnlBotPaginatedItems.map((item) => (
                    <div key={item.id} className="payments-table-row bot-table-row">
                      <span>{formatDateTime(item.createdAt)}</span>
                      <span>{item.paymentMethod || t("common.providerEmpty")}</span>
                      <strong>{formatMoney(item.amountRub, "RUB")}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="inline-empty">{t("pnl.botPaymentsEmpty")}</div>
              )}
              {pnlBotItems.length ? (
                <div className="table-footer">
                  <span>
                    {t("pnl.cardRevenue")}: {pnlRevenueTotalDisplay}
                  </span>
                  <div className="pagination">
                    <button className="secondary-button icon-only" type="button" onClick={() => setBotPage((p) => p - 1)} disabled={pnlBotCurrentPage <= 1} aria-label={t("stats.prevPage")}>
                      <ChevronLeft size={16} />
                    </button>
                    <strong>
                      {pnlBotCurrentPage} / {pnlBotPages}
                    </strong>
                    <button
                      className="secondary-button icon-only"
                      type="button"
                      onClick={() => setBotPage((p) => p + 1)}
                      disabled={pnlBotCurrentPage >= pnlBotPages}
                      aria-label={t("stats.nextPage")}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ) : null}

        <AccordionItem value="expenses" className="chart-panel table-panel">
          <AccordionTrigger className="table-collapsible-trigger">
            <div className="heading-stack">
              <h2>{t("pnl.tableTitle")}</h2>
              <span className="stat-card-sub">{t("stats.shownOf", { shown: pnlFilteredRows.length, total: tc("record", pnlRows.length) })}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {pnlRows.length ? (
              <div className="table-toolbar pnl-toolbar">
                <input type="search" placeholder={t("pnl.filter")} value={search} onChange={(e) => updateSearch(e.target.value)} />
                <AppSelect value={sort} onChange={updateSort} aria-label={t("pnl.sort")}>
                  <AppSelectItem value="renewal-asc">{t("pnl.sortRenewalAsc")}</AppSelectItem>
                  <AppSelectItem value="renewal-desc">{t("pnl.sortRenewalDesc")}</AppSelectItem>
                  <AppSelectItem value="nextAmount-desc">{t("pnl.sortNextAmountDesc")}</AppSelectItem>
                  <AppSelectItem value="nextAmount-asc">{t("pnl.sortNextAmountAsc")}</AppSelectItem>
                  <AppSelectItem value="name-asc">{t("pnl.sortNameAsc")}</AppSelectItem>
                </AppSelect>
                <AppSelect value={pageSize} onChange={(v) => updatePageSize(Number(v))} aria-label={t("stats.pageSize")}>
                  <AppSelectItem value={10}>10</AppSelectItem>
                  <AppSelectItem value={25}>25</AppSelectItem>
                  <AppSelectItem value={50}>50</AppSelectItem>
                </AppSelect>
              </div>
            ) : null}
            {pnlPaginatedRows.length ? (
              <div className="payments-table pnl-table">
                <div className="payments-table-head pnl-table-row">
                  <span>{t("common.name")}</span>
                  <span>{t("common.provider")}</span>
                  <span className="cell-num">{t("pnl.colTotal")}</span>
                  <span className="cell-num">{t("pnl.colMonthly")}</span>
                  <span>{t("pnl.colRenewal")}</span>
                  <span className="cell-num">{t("pnl.colNextAmount")}</span>
                </div>
                {pnlPaginatedRows.map((row) => (
                  <div key={row.id} className="payments-table-row pnl-table-row">
                    <span>{row.name}</span>
                    <span>{row.provider}</span>
                    <strong>{row.totalDisplay}</strong>
                    <span className="cell-num">{row.monthlyCost ? row.monthlyCostDisplay : t("pnl.noForecast")}</span>
                    <span>{formatDateTime(row.expiresAt)}</span>
                    <strong>{row.nextRenewalAmount ? row.nextRenewalDisplay : t("pnl.noForecast")}</strong>
                  </div>
                ))}
              </div>
            ) : pnlRows.length ? (
              <div className="inline-empty">{t("stats.noFilteredPayments")}</div>
            ) : (
              <div className="inline-empty">{t("pnl.empty")}</div>
            )}
            {pnlSortedRows.length ? (
              <div className="table-footer">
                <span>
                  {t("pnl.colMonthly")}: {pnlMonthlyCostTotalDisplay}
                </span>
                <div className="pagination">
                  <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p - 1)} disabled={pnlCurrentPage <= 1} aria-label={t("stats.prevPage")}>
                    <ChevronLeft size={16} />
                  </button>
                  <strong>
                    {pnlCurrentPage} / {pnlPages}
                  </strong>
                  <button className="secondary-button icon-only" type="button" onClick={() => setPage((p) => p + 1)} disabled={pnlCurrentPage >= pnlPages} aria-label={t("stats.nextPage")}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </AccordionRoot>
    </>
  );
}
