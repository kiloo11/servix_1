"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "../../../components/ui/Accordion";
import AppSelect from "../../../components/ui/AppSelect";
import AppSelectItem from "../../../components/ui/AppSelectItem";
import NetChart from "../../../components/pnl/NetChart";
import { useLocale } from "../../../context/LocaleContext";
import { useAuth } from "../../../context/AuthContext";
import { useData } from "../../../context/DataContext";
import { useGrouping } from "../../../lib/grouping";
import { useMoney } from "../../../lib/money";
import { useFormat } from "../../../lib/format";
import { assetCycleDays, assetLastPayment, parseAppDate } from "../../../lib/dates";
import { periodStart } from "../../../lib/statsTimeline";

const DEFAULT_BOT_REVENUE = { configured: false, totalRub: 0, monthRub: 0, count: 0, monthCount: 0, items: [], updatedAt: "" };

// Ported from src/views/PnLView.vue + the pnl* computeds/pnlCostByMonth in
// App.vue, and loadBotRevenue/loadBotRevenueMonthly (fetched on mount here —
// equivalent to the original's fetch-on-`go('pnl')` since a Next.js route
// mounts fresh on navigation).
export default function PnLPage() {
  const { t, tc, locale } = useLocale();
  const { meta, call } = useAuth();
  const { assets } = useData();
  const { providerOf } = useGrouping();
  const { formatMoney, convertAmount, paymentsTotalIn, formatPaymentTotal } = useMoney();
  const { formatDateTime, formatShort } = useFormat();

  const currency = meta.currency || "USDT";

  const [horizonDays, setHorizonDays] = useState(90);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("forecast-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [botPage, setBotPage] = useState(1);
  const [botPageSize] = useState(10);

  const [botRevenue, setBotRevenue] = useState(DEFAULT_BOT_REVENUE);
  const [botRevenueMonthly, setBotRevenueMonthly] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await call("/api/bot/revenue");
        if (!cancelled) setBotRevenue(data);
      } catch {
        if (!cancelled) setBotRevenue(DEFAULT_BOT_REVENUE);
      }
      try {
        const monthly = await call("/api/bot/revenue/monthly");
        if (!cancelled) setBotRevenueMonthly(monthly.months || []);
      } catch {
        if (!cancelled) setBotRevenueMonthly([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call]);

  const pnlRows = useMemo(
    () =>
      assets
        .filter((asset) => !asset.inactive)
        .map((asset) => {
          const last = assetLastPayment(asset);
          const cycleDays = assetCycleDays(asset);
          const cyclePrice = convertAmount(Number(asset.price || 0), asset.priceCurrency || "USDT", currency);
          const monthlyCost = asset.type === "vps" ? cyclePrice : (cyclePrice / Math.max(1, cycleDays)) * 30;
          const forecastAmount = monthlyCost * (horizonDays / 30);
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
            forecastAmount,
            forecastCurrency: currency,
            monthlyCost,
            monthlyCostDisplay: formatMoney(monthlyCost, currency),
          };
        }),
    [assets, currency, horizonDays, providerOf, convertAmount, formatMoney, formatPaymentTotal, t]
  );

  const pnlFilteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pnlRows;
    return pnlRows.filter((row) => [row.name, row.provider, t(`type.${row.type}`) || t("type.record")].join(" ").toLowerCase().includes(query));
  }, [pnlRows, search, t]);

  const pnlSortedRows = useMemo(() => {
    const rows = [...pnlFilteredRows];
    const sorters = {
      "forecast-desc": (a, b) => b.forecastAmount - a.forecastAmount,
      "forecast-asc": (a, b) => a.forecastAmount - b.forecastAmount,
      "renewal-asc": (a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)),
      "renewal-desc": (a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)),
      "name-asc": (a, b) => String(a.name).localeCompare(String(b.name), "ru"),
    };
    return rows.sort(sorters[sort] || sorters["forecast-desc"]);
  }, [pnlFilteredRows, sort]);

  const pnlPages = Math.max(1, Math.ceil(pnlSortedRows.length / pageSize));
  const pnlCurrentPage = Math.min(page, pnlPages);
  const pnlPaginatedRows = pnlSortedRows.slice((pnlCurrentPage - 1) * pageSize, pnlCurrentPage * pageSize);

  const pnlAllPayments = useMemo(() => pnlRows.flatMap((row) => row.asset.payments || []), [pnlRows]);

  const pnlHistoricalTotalDisplay = formatPaymentTotal(pnlAllPayments);
  const pnlHistoricalTotalRubDisplay = formatMoney(paymentsTotalIn(pnlAllPayments, "RUB"), "RUB");

  const pnlForecastTotal = useMemo(() => pnlRows.reduce((sum, row) => sum + convertAmount(row.forecastAmount || 0, row.forecastCurrency, currency), 0), [pnlRows, currency, convertAmount]);
  const pnlForecastTotalDisplay = formatMoney(pnlForecastTotal, currency);
  const pnlForecastTotalRubDisplay = formatMoney(
    pnlRows.reduce((sum, row) => sum + convertAmount(row.forecastAmount || 0, row.forecastCurrency, "RUB"), 0),
    "RUB"
  );

  const pnlRevenueTotal = convertAmount(botRevenue.totalRub || 0, "RUB", currency);
  const pnlRevenueTotalDisplay = formatMoney(pnlRevenueTotal, currency);
  const pnlRevenueTotalRubDisplay = formatMoney(botRevenue.totalRub || 0, "RUB");
  const pnlRevenueMonthDisplay = formatMoney(convertAmount(botRevenue.monthRub || 0, "RUB", currency), currency);
  const pnlRevenueMonthRubDisplay = formatMoney(botRevenue.monthRub || 0, "RUB");

  const pnlCostTotal = paymentsTotalIn(pnlAllPayments, currency);
  const pnlNetTotalDisplay = formatMoney(pnlRevenueTotal - pnlCostTotal, currency);
  const pnlNetTotalRubDisplay = formatMoney((botRevenue.totalRub || 0) - paymentsTotalIn(pnlAllPayments, "RUB"), "RUB");

  const pnlMonthPayments = useMemo(() => {
    const since = periodStart("30d");
    return pnlAllPayments.filter((payment) => {
      const paidAt = parseAppDate(payment.paidAt);
      return !Number.isNaN(paidAt.getTime()) && paidAt >= since;
    });
  }, [pnlAllPayments]);

  const pnlNetMonthDisplay = formatMoney(convertAmount(botRevenue.monthRub || 0, "RUB", currency) - paymentsTotalIn(pnlMonthPayments, currency), currency);
  const pnlNetMonthRubDisplay = formatMoney((botRevenue.monthRub || 0) - paymentsTotalIn(pnlMonthPayments, "RUB"), "RUB");
  const pnlCostMonthDisplay = formatMoney(paymentsTotalIn(pnlMonthPayments, currency), currency);
  const pnlCostMonthRubDisplay = formatMoney(paymentsTotalIn(pnlMonthPayments, "RUB"), "RUB");

  const pnlMonthlySeries = useMemo(() => {
    const monthsBack = 6;
    const now = new Date();
    const revenueByMonth = new Map((botRevenueMonthly || []).map((row) => [row.month, row.totalRub]));
    const costByMonth = new Map();
    for (const payment of pnlAllPayments) {
      const key = String(payment.paidAt || "").slice(0, 7);
      if (!key) continue;
      const amount = convertAmount(payment.amount, payment.currency || "USDT", currency);
      costByMonth.set(key, (costByMonth.get(key) || 0) + amount);
    }
    const intlLocale = locale === "en" ? "en-US" : "ru-RU";
    const rows = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  }, [botRevenueMonthly, pnlAllPayments, currency, convertAmount, locale]);

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
  function updateHorizon(value) {
    setHorizonDays(value);
    setPage(1);
  }

  return (
    <section className="view active">
      <div className="section-head">
        <div className="heading-stack">
          <h1>{t("nav.pnl")}</h1>
          <span>{t("pnl.subtitle")}</span>
        </div>
        <AppSelect value={horizonDays} onChange={(v) => updateHorizon(Number(v))} className="period-select" aria-label={t("pnl.horizon")}>
          <AppSelectItem value={30}>{tc("day", 30)}</AppSelectItem>
          <AppSelectItem value={90}>{tc("day", 90)}</AppSelectItem>
          <AppSelectItem value={180}>{tc("day", 180)}</AppSelectItem>
          <AppSelectItem value={365}>{tc("day", 365)}</AppSelectItem>
        </AppSelect>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <span>{t("pnl.cardRecords")}</span>
          <strong>{pnlRows.length}</strong>
        </article>
        <article className="stat-card">
          <span>{t("pnl.cardHistorical")}</span>
          <strong>{pnlHistoricalTotalDisplay}</strong>
          {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlHistoricalTotalRubDisplay}</small> : null}
        </article>
        <article className="stat-card">
          <span>{t("pnl.cardForecast", { days: horizonDays })}</span>
          <strong>{pnlForecastTotalDisplay}</strong>
          {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlForecastTotalRubDisplay}</small> : null}
        </article>
        <article className="stat-card">
          <span>{t("pnl.cardCostMonth")}</span>
          <strong>{pnlCostMonthDisplay}</strong>
          {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlCostMonthRubDisplay}</small> : null}
        </article>
        {botRevenue.configured ? (
          <>
            <article className="stat-card">
              <span>{t("pnl.cardRevenue")}</span>
              <strong>{pnlRevenueTotalDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlRevenueTotalRubDisplay}</small> : null}
            </article>
            <article className="stat-card">
              <span>{t("pnl.cardRevenueMonth")}</span>
              <strong>{pnlRevenueMonthDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlRevenueMonthRubDisplay}</small> : null}
            </article>
            <article className="stat-card">
              <span>{t("pnl.cardNetMonth")}</span>
              <strong>{pnlNetMonthDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlNetMonthRubDisplay}</small> : null}
            </article>
            <article className="stat-card">
              <span>{t("pnl.cardNet")}</span>
              <strong>{pnlNetTotalDisplay}</strong>
              {currency !== "RUB" ? <small className="stat-card-sub">≈ {pnlNetTotalRubDisplay}</small> : null}
            </article>
          </>
        ) : null}
      </div>

      {botRevenue.configured ? (
        <article className="chart-panel month-profit-panel">
          <div className="chart-title-row">
            <h2>{t("pnl.monthlyProfitTitle")}</h2>
          </div>
          {pnlMonthlySeries.some((row) => row.revenue || row.cost) ? (
            <div className="month-profit-chart-wrap">
              <NetChart rows={pnlMonthlySeries} currency={currency} t={t} formatMoney={formatMoney} formatShort={formatShort} />
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
                  <AppSelectItem value="forecast-desc">{t("pnl.sortForecastDesc")}</AppSelectItem>
                  <AppSelectItem value="forecast-asc">{t("pnl.sortForecastAsc")}</AppSelectItem>
                  <AppSelectItem value="renewal-asc">{t("pnl.sortRenewalAsc")}</AppSelectItem>
                  <AppSelectItem value="renewal-desc">{t("pnl.sortRenewalDesc")}</AppSelectItem>
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
                  <span className="cell-num">{t("pnl.colForecast")}</span>
                </div>
                {pnlPaginatedRows.map((row) => (
                  <div key={row.id} className="payments-table-row pnl-table-row">
                    <span>{row.name}</span>
                    <span>{row.provider}</span>
                    <strong>{row.totalDisplay}</strong>
                    <span className="cell-num">{row.monthlyCost ? row.monthlyCostDisplay : t("pnl.noForecast")}</span>
                    <span>{formatDateTime(row.expiresAt)}</span>
                    <strong>{row.forecastAmount ? formatMoney(row.forecastAmount, row.forecastCurrency) : t("pnl.noForecast")}</strong>
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
                  {t("pnl.cardForecast", { days: horizonDays })}: {pnlForecastTotalDisplay}
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
    </section>
  );
}
