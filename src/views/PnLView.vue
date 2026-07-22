<template>
  <section class="view active">
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.pnl") }}</h1>
        <span>{{ app.t("pnl.subtitle") }}</span>
      </div>
      <select v-model.number="app.pnlHorizonDays" class="period-select" :aria-label="app.t('pnl.horizon')">
        <option :value="30">{{ app.tc("day", 30) }}</option>
        <option :value="90">{{ app.tc("day", 90) }}</option>
        <option :value="180">{{ app.tc("day", 180) }}</option>
        <option :value="365">{{ app.tc("day", 365) }}</option>
      </select>
    </div>

    <div class="stats-grid">
      <article class="stat-card"><span>{{ app.t("pnl.cardRecords") }}</span><strong>{{ app.pnlRows.length }}</strong></article>
      <article class="stat-card"><span>{{ app.t("pnl.cardHistorical") }}</span><strong>{{ app.pnlHistoricalTotalDisplay }}</strong></article>
      <article class="stat-card"><span>{{ app.t("pnl.cardForecast", { days: app.pnlHorizonDays }) }}</span><strong>{{ app.pnlForecastTotalDisplay }}</strong></article>
    </div>

    <article class="chart-panel table-panel">
      <div class="table-title-row">
        <div>
          <h2>{{ app.t("pnl.tableTitle") }}</h2>
          <span>{{ app.t("stats.shownOf", { shown: app.pnlFilteredRows.length, total: app.tc("record", app.pnlRows.length) }) }}</span>
        </div>
      </div>
      <div class="table-toolbar pnl-toolbar" v-if="app.pnlRows.length">
        <input v-model="app.pnlSearch" type="search" :placeholder="app.t('pnl.filter')">
        <select v-model="app.pnlSort" :aria-label="app.t('pnl.sort')">
          <option value="forecast-desc">{{ app.t("pnl.sortForecastDesc") }}</option>
          <option value="forecast-asc">{{ app.t("pnl.sortForecastAsc") }}</option>
          <option value="renewal-asc">{{ app.t("pnl.sortRenewalAsc") }}</option>
          <option value="renewal-desc">{{ app.t("pnl.sortRenewalDesc") }}</option>
          <option value="name-asc">{{ app.t("pnl.sortNameAsc") }}</option>
        </select>
        <select v-model.number="app.pnlPageSize" :aria-label="app.t('stats.pageSize')">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
      </div>
      <div class="payments-table pnl-table" v-if="app.pnlPaginatedRows.length">
        <div class="payments-table-head pnl-table-row">
          <span>{{ app.t("common.name") }}</span>
          <span>{{ app.t("common.provider") }}</span>
          <span>{{ app.t("pnl.colTotal") }}</span>
          <span>{{ app.t("pnl.colRenewal") }}</span>
          <span>{{ app.t("pnl.colForecast") }}</span>
        </div>
        <div v-for="row in app.pnlPaginatedRows" :key="row.id" class="payments-table-row pnl-table-row">
          <span>{{ row.name }}</span>
          <span>{{ row.provider }}</span>
          <strong>{{ row.totalDisplay }}</strong>
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
    </article>
  </section>
</template>

<script>
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "@lucide/vue";

export default {
  components: { ChevronLeftIcon, ChevronRightIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
