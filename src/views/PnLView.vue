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
      <div class="month-profit-chart" v-if="app.pnlMonthlySeries.some((row) => row.revenue || row.cost)" @mouseleave="hideMonthTooltip">
        <div class="month-profit-baseline"></div>
        <div v-for="row in app.pnlMonthlySeries" :key="row.month" class="month-profit-track">
          <div class="month-profit-bar-wrap">
            <div
              class="month-profit-bar"
              :class="row.net >= 0 ? 'is-positive' : 'is-negative'"
              :style="{ height: Math.max(row.heightPercent, row.net !== 0 ? 3 : 0) + '%' }"
              tabindex="0"
              @mouseenter="showMonthTooltip(row, $event)"
              @mousemove="showMonthTooltip(row, $event)"
              @focus="showMonthTooltip(row, $event)"
              @blur="hideMonthTooltip"
            ></div>
          </div>
          <span class="month-profit-label">{{ row.label }}</span>
        </div>
        <div v-if="monthTooltip" class="chart-tooltip" :style="{ left: monthTooltip.left + 'px', top: monthTooltip.top + 'px' }">
          <strong>{{ monthTooltip.label }}</strong>
          <span>{{ monthTooltip.value }}</span>
        </div>
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
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { ChevronDown as ChevronDownIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "@lucide/vue";
import AppSelect from "../components/AppSelect.vue";
import AppSelectItem from "../components/AppSelectItem.vue";

export default {
  components: { AppSelect, AppSelectItem, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger },
  props: {
    app: { type: Object, required: true }
  },
  data() {
    return { monthTooltip: null };
  },
  methods: {
    showMonthTooltip(row, event) {
      const rect = event.currentTarget.closest(".month-profit-chart").getBoundingClientRect();
      const left = Math.min(rect.width - 130, Math.max(10, event.currentTarget.getBoundingClientRect().left - rect.left - 40));
      const top = Math.max(10, event.currentTarget.getBoundingClientRect().top - rect.top - 46);
      this.monthTooltip = {
        left,
        top,
        label: row.monthLabel,
        value: this.app.formatMoney(row.net, this.app.settings.currency || "USDT")
      };
    },
    hideMonthTooltip() {
      this.monthTooltip = null;
    }
  }
};
</script>
