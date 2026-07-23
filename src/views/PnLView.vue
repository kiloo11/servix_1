<template>
  <section class="view active">
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.pnl") }}</h1>
        <span>{{ app.t("pnl.subtitle") }}</span>
      </div>
      <AppSelect v-model.number="app.pnlHorizonDays" class="period-select" :aria-label="app.t('pnl.horizon')">
        <AppSelectItem :value="30">{{ app.tc("day", 30) }}</AppSelectItem>
        <AppSelectItem :value="90">{{ app.tc("day", 90) }}</AppSelectItem>
        <AppSelectItem :value="180">{{ app.tc("day", 180) }}</AppSelectItem>
        <AppSelectItem :value="365">{{ app.tc("day", 365) }}</AppSelectItem>
      </AppSelect>
    </div>

    <div class="stats-grid">
      <article class="stat-card"><span>{{ app.t("pnl.cardRecords") }}</span><strong>{{ app.pnlRows.length }}</strong></article>
      <article class="stat-card">
        <span>{{ app.t("pnl.cardHistorical") }}</span>
        <strong>{{ app.pnlHistoricalTotalDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlHistoricalTotalRubDisplay }}</small>
      </article>
      <article class="stat-card">
        <span>{{ app.t("pnl.cardForecast", { days: app.pnlHorizonDays }) }}</span>
        <strong>{{ app.pnlForecastTotalDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlForecastTotalRubDisplay }}</small>
      </article>
      <article class="stat-card" v-if="app.botRevenue.configured">
        <span>{{ app.t("pnl.cardRevenue") }}</span>
        <strong>{{ app.pnlRevenueTotalDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlRevenueTotalRubDisplay }}</small>
      </article>
      <article class="stat-card" v-if="app.botRevenue.configured">
        <span>{{ app.t("pnl.cardRevenueMonth") }}</span>
        <strong>{{ app.pnlRevenueMonthDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlRevenueMonthRubDisplay }}</small>
      </article>
      <article class="stat-card" v-if="app.botRevenue.configured">
        <span>{{ app.t("pnl.cardNetMonth") }}</span>
        <strong>{{ app.pnlNetMonthDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlNetMonthRubDisplay }}</small>
      </article>
      <article class="stat-card" v-if="app.botRevenue.configured">
        <span>{{ app.t("pnl.cardNet") }}</span>
        <strong>{{ app.pnlNetTotalDisplay }}</strong>
        <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.pnlNetTotalRubDisplay }}</small>
      </article>
    </div>

    <article class="chart-panel month-profit-panel" v-if="app.botRevenue.configured">
      <div class="chart-title-row">
        <h2>{{ app.t("pnl.monthlyProfitTitle") }}</h2>
      </div>
      <div class="month-profit-chart-wrap" v-if="app.pnlMonthlySeries.some((row) => row.revenue || row.cost)">
        <canvas ref="monthChartCanvas"></canvas>
      </div>
      <div v-else class="inline-empty">{{ app.t("pnl.monthlyProfitEmpty") }}</div>
    </article>

    <CollapsibleRoot v-if="app.botRevenue.configured" class="category-group pnl-bot-payments">
      <CollapsibleTrigger class="category-group-summary">
        <span>{{ app.t("pnl.botPaymentsTitle") }}</span>
        <span class="category-group-count">{{ app.tc("payment", app.botRevenue.count) }}</span>
        <ChevronDownIcon class="category-group-chevron" :size="16" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="category-group-body">
          <div class="payments-table" v-if="app.pnlBotPaginatedItems.length">
            <div class="payments-table-head">
              <span>{{ app.t("common.date") }}</span>
              <span>{{ app.t("pnl.botPaymentMethod") }}</span>
              <span>{{ app.t("common.sum") }}</span>
            </div>
            <div v-for="item in app.pnlBotPaginatedItems" :key="item.id" class="payments-table-row">
              <span>{{ app.formatDateTime(item.createdAt) }}</span>
              <span>{{ item.paymentMethod || app.t("common.providerEmpty") }}</span>
              <strong>{{ app.formatMoney(item.amountRub, "RUB") }}</strong>
            </div>
          </div>
          <div v-else class="inline-empty">{{ app.t("pnl.botPaymentsEmpty") }}</div>
          <div class="table-footer" v-if="app.pnlBotItems.length">
            <span>{{ app.t("pnl.cardRevenue") }}: {{ app.pnlRevenueTotalDisplay }}</span>
            <div class="pagination">
              <button class="secondary-button icon-only" type="button" @click="app.setPnlBotPage(app.pnlBotPage - 1)" :disabled="app.pnlBotPage <= 1" :aria-label="app.t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
              <strong>{{ app.pnlBotCurrentPage }} / {{ app.pnlBotPages }}</strong>
              <button class="secondary-button icon-only" type="button" @click="app.setPnlBotPage(app.pnlBotPage + 1)" :disabled="app.pnlBotPage >= app.pnlBotPages" :aria-label="app.t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>

    <CollapsibleRoot default-open class="chart-panel table-panel">
      <CollapsibleTrigger class="table-collapsible-trigger">
        <div>
          <h2>{{ app.t("pnl.tableTitle") }}</h2>
          <span>{{ app.t("stats.shownOf", { shown: app.pnlFilteredRows.length, total: app.tc("record", app.pnlRows.length) }) }}</span>
        </div>
        <ChevronDownIcon class="table-collapsible-chevron" :size="18" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="table-toolbar pnl-toolbar" v-if="app.pnlRows.length">
          <input v-model="app.pnlSearch" type="search" :placeholder="app.t('pnl.filter')">
          <AppSelect v-model="app.pnlSort" :aria-label="app.t('pnl.sort')">
            <AppSelectItem value="forecast-desc">{{ app.t("pnl.sortForecastDesc") }}</AppSelectItem>
            <AppSelectItem value="forecast-asc">{{ app.t("pnl.sortForecastAsc") }}</AppSelectItem>
            <AppSelectItem value="renewal-asc">{{ app.t("pnl.sortRenewalAsc") }}</AppSelectItem>
            <AppSelectItem value="renewal-desc">{{ app.t("pnl.sortRenewalDesc") }}</AppSelectItem>
            <AppSelectItem value="name-asc">{{ app.t("pnl.sortNameAsc") }}</AppSelectItem>
          </AppSelect>
          <AppSelect v-model.number="app.pnlPageSize" :aria-label="app.t('stats.pageSize')">
            <AppSelectItem :value="10">10</AppSelectItem>
            <AppSelectItem :value="25">25</AppSelectItem>
            <AppSelectItem :value="50">50</AppSelectItem>
          </AppSelect>
        </div>
        <div class="payments-table pnl-table" v-if="app.pnlPaginatedRows.length">
          <div class="payments-table-head pnl-table-row">
            <span>{{ app.t("common.name") }}</span>
            <span>{{ app.t("common.provider") }}</span>
            <span>{{ app.t("pnl.colTotal") }}</span>
            <span>{{ app.t("pnl.colMonthly") }}</span>
            <span>{{ app.t("pnl.colRenewal") }}</span>
            <span>{{ app.t("pnl.colForecast") }}</span>
          </div>
          <div v-for="row in app.pnlPaginatedRows" :key="row.id" class="payments-table-row pnl-table-row">
            <span>{{ row.name }}</span>
            <span>{{ row.provider }}</span>
            <strong>{{ row.totalDisplay }}</strong>
            <span>{{ row.monthlyCost ? row.monthlyCostDisplay : app.t("pnl.noForecast") }}</span>
            <span>{{ app.formatDateTime(row.expiresAt) }}</span>
            <strong>{{ row.forecastAmount ? app.formatMoney(row.forecastAmount, row.forecastCurrency) : app.t("pnl.noForecast") }}</strong>
          </div>
        </div>
        <div v-else-if="app.pnlRows.length" class="inline-empty">{{ app.t("stats.noFilteredPayments") }}</div>
        <div v-else class="inline-empty">{{ app.t("pnl.empty") }}</div>
        <div class="table-footer" v-if="app.pnlSortedRows.length">
          <span>{{ app.t("pnl.cardForecast", { days: app.pnlHorizonDays }) }}: {{ app.pnlForecastTotalDisplay }}</span>
          <div class="pagination">
            <button class="secondary-button icon-only" type="button" @click="app.setPnlPage(app.pnlPage - 1)" :disabled="app.pnlPage <= 1" :aria-label="app.t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
            <strong>{{ app.pnlCurrentPage }} / {{ app.pnlPages }}</strong>
            <button class="secondary-button icon-only" type="button" @click="app.setPnlPage(app.pnlPage + 1)" :disabled="app.pnlPage >= app.pnlPages" :aria-label="app.t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
          </div>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>
  </section>
</template>

<script>
import { Chart } from "chart.js/auto";
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { ChevronDown as ChevronDownIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "@lucide/vue";
import AppSelect from "../components/AppSelect.vue";
import AppSelectItem from "../components/AppSelectItem.vue";

const COLOR_LINE = "#ef4bc8";
const COLOR_LINE_FILL = "rgba(239, 75, 200, 0.12)";
const COLOR_GOOD = "#35d488";
const COLOR_DANGER = "#ff6f9e";
const COLOR_MUTED = "#9a8fb3";
const COLOR_GRID = "rgba(154, 143, 179, 0.14)";

export default {
  components: { AppSelect, AppSelectItem, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger },
  props: {
    app: { type: Object, required: true }
  },
  watch: {
    "app.pnlMonthlySeries": {
      deep: true,
      handler() {
        this.renderMonthChart();
      }
    }
  },
  mounted() {
    this.renderMonthChart();
  },
  beforeUnmount() {
    this.monthChart?.destroy();
  },
  methods: {
    renderMonthChart() {
      const canvas = this.$refs.monthChartCanvas;
      this.monthChart?.destroy();
      this.monthChart = null;
      if (!canvas) return;
      const rows = this.app.pnlMonthlySeries;
      if (!rows.some((row) => row.revenue || row.cost)) return;
      const currency = this.app.settings.currency || "USDT";
      this.monthChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: rows.map((row) => row.label),
          datasets: [{
            label: this.app.t("pnl.monthlyProfitTitle"),
            data: rows.map((row) => row.net),
            borderColor: COLOR_LINE,
            backgroundColor: COLOR_LINE_FILL,
            pointBackgroundColor: rows.map((row) => (row.net >= 0 ? COLOR_GOOD : COLOR_DANGER)),
            pointBorderColor: rows.map((row) => (row.net >= 0 ? COLOR_GOOD : COLOR_DANGER)),
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2,
            tension: 0.3,
            fill: "origin"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => rows[items[0].dataIndex]?.monthLabel || "",
                label: (item) => this.app.formatMoney(item.parsed.y, currency)
              }
            }
          },
          scales: {
            x: {
              grid: { color: COLOR_GRID },
              ticks: { color: COLOR_MUTED }
            },
            y: {
              grid: { color: COLOR_GRID },
              ticks: {
                color: COLOR_MUTED,
                callback: (value) => this.app.formatShort(value)
              }
            }
          }
        }
      });
    }
  }
};
</script>
