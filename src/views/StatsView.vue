<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.stats") }}</h1>
      <div class="section-head-actions">
        <AppSelect v-model="app.statsPeriod" class="period-select" :aria-label="app.t('stats.period')">
          <AppSelectItem value="7d">{{ app.t("stats.period7d") }}</AppSelectItem>
          <AppSelectItem value="30d">{{ app.t("stats.period30d") }}</AppSelectItem>
          <AppSelectItem value="90d">{{ app.t("stats.period90d") }}</AppSelectItem>
          <AppSelectItem value="180d">{{ app.t("stats.period180d") }}</AppSelectItem>
          <AppSelectItem value="1y">{{ app.t("stats.period1y") }}</AppSelectItem>
          <AppSelectItem value="all">{{ app.t("stats.periodAll") }}</AppSelectItem>
        </AppSelect>
      </div>
    </div>
    <div class="stats-grid">
      <article v-for="card in app.statCards" :key="card.label" class="stat-card"><span>{{ card.label }}</span><strong>{{ card.value }}</strong></article>
    </div>
    <div class="charts-grid">
      <article class="chart-panel wide-chart">
        <div class="chart-title-row">
          <h2>{{ app.t("stats.spendByUnit", { unit: app.timelineUnitLabel }) }}</h2>
          <span>{{ app.formatMoney(app.timelineTotal, app.settings.currency) }}</span>
        </div>
        <div class="line-chart" v-if="app.paymentAmountTimeline.length" @mouseleave="app.hideChartTooltip">
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="line-fill" :points="app.paymentAmountAreaPoints"></polyline>
            <polyline class="line-main" :points="app.paymentAmountPoints"></polyline>
            <rect v-for="hit in app.paymentAmountHits" :key="hit.key" class="line-hit" :x="hit.x" y="0" :width="hit.width" height="42" @mouseenter="app.showChartTooltip(hit.point, 'amount', $event)" @mousemove="app.showChartTooltip(hit.point, 'amount', $event)"></rect>
          </svg>
          <div v-if="app.chartTooltip?.chart === 'amount'" class="chart-tooltip" :style="{ left: app.chartTooltip.left + 'px', top: app.chartTooltip.top + 'px' }">
            <strong>{{ app.chartTooltip.label }}</strong>
            <span>{{ app.chartTooltip.value }}</span>
            <small>{{ app.chartTooltip.count }}</small>
          </div>
          <div class="line-axis">
            <span v-for="label in app.timelineAxisLabels" :key="label">{{ label }}</span>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.paymentsNone") }}</div>
      </article>
      <article class="chart-panel">
        <h2>{{ app.t("stats.providerSpend") }}</h2>
        <div class="bar-list" v-if="app.providerSpend.length">
          <div v-for="row in app.providerSpend" :key="row.id" class="bar-row">
            <span><i :style="{ background: row.color }"></i>{{ row.name }}</span><div><i :style="{ width: row.width + '%', background: row.color }"></i></div><strong>{{ app.formatMoney(row.value, app.settings.currency) }}</strong>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.spendNone") }}</div>
      </article>
      <article class="chart-panel">
        <div class="chart-title-row">
          <h2>{{ app.t("stats.paymentCount") }}</h2>
          <span>{{ app.tc("piece", app.periodPayments.length) }}</span>
        </div>
        <div class="line-chart compact-line" v-if="app.paymentCountTimeline.length" @mouseleave="app.hideChartTooltip">
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="line-fill count-line" :points="app.paymentCountAreaPoints"></polyline>
            <polyline class="line-main count-line" :points="app.paymentCountPoints"></polyline>
            <rect v-for="hit in app.paymentCountHits" :key="hit.key" class="line-hit" :x="hit.x" y="0" :width="hit.width" height="42" @mouseenter="app.showChartTooltip(hit.point, 'count', $event)" @mousemove="app.showChartTooltip(hit.point, 'count', $event)"></rect>
          </svg>
          <div v-if="app.chartTooltip?.chart === 'count'" class="chart-tooltip" :style="{ left: app.chartTooltip.left + 'px', top: app.chartTooltip.top + 'px' }">
            <strong>{{ app.chartTooltip.label }}</strong>
            <span>{{ app.chartTooltip.value }}</span>
            <small>{{ app.chartTooltip.count }}</small>
          </div>
          <div class="line-axis">
            <span v-for="label in app.timelineAxisLabels" :key="label">{{ label }}</span>
          </div>
        </div>
        <div v-else class="inline-empty">{{ app.t("stats.paymentsNone") }}</div>
      </article>
    </div>
    <article class="chart-panel table-panel">
      <div class="table-title-row">
        <div>
          <h2>{{ app.t("stats.allPayments") }}</h2>
          <span>{{ app.t("stats.shownOf", { shown: app.filteredPeriodPayments.length, total: app.tc("payment", app.periodPayments.length) }) }}</span>
        </div>
        <div class="export-actions">
          <button class="secondary-button" type="button" @click="app.exportPaymentsCsv" :disabled="!app.filteredPeriodPayments.length"><DownloadIcon :size="16" />CSV</button>
          <button class="secondary-button" type="button" @click="app.exportPaymentsPdf" :disabled="!app.filteredPeriodPayments.length"><FileTextIcon :size="16" />PDF</button>
        </div>
      </div>
      <div class="table-toolbar" v-if="app.periodPayments.length">
        <input v-model="app.paymentTableSearch" type="search" :placeholder="app.t('stats.filter')">
        <AppSelect v-model="app.paymentTableProvider" :aria-label="app.t('stats.providerFilter')">
          <AppSelectItem value="all">{{ app.t("stats.allProviders") }}</AppSelectItem>
          <AppSelectItem value="none">{{ app.t("common.providersEmpty") }}</AppSelectItem>
          <AppSelectItem v-for="provider in app.paymentTableProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</AppSelectItem>
        </AppSelect>
        <AppSelect v-model="app.paymentTableSort" :aria-label="app.t('stats.sort')">
          <AppSelectItem value="date-desc">{{ app.t("stats.sortDateDesc") }}</AppSelectItem>
          <AppSelectItem value="date-asc">{{ app.t("stats.sortDateAsc") }}</AppSelectItem>
          <AppSelectItem value="amount-desc">{{ app.t("stats.sortAmountDesc") }}</AppSelectItem>
          <AppSelectItem value="amount-asc">{{ app.t("stats.sortAmountAsc") }}</AppSelectItem>
          <AppSelectItem value="server-asc">{{ app.t("stats.sortServerAsc") }}</AppSelectItem>
          <AppSelectItem value="provider-asc">{{ app.t("stats.sortProviderAsc") }}</AppSelectItem>
        </AppSelect>
        <AppSelect v-model.number="app.paymentTablePageSize" :aria-label="app.t('stats.pageSize')">
          <AppSelectItem :value="10">10</AppSelectItem>
          <AppSelectItem :value="25">25</AppSelectItem>
          <AppSelectItem :value="50">50</AppSelectItem>
          <AppSelectItem :value="100">100</AppSelectItem>
        </AppSelect>
      </div>
      <div class="payments-table" v-if="app.paginatedPeriodPayments.length">
        <div class="payments-table-head"><span>{{ app.t("common.date") }}</span><span>{{ app.t("type.vps") }}</span><span>{{ app.t("common.provider") }}</span><span>{{ app.t("common.sum") }}</span></div>
        <div v-for="payment in app.paginatedPeriodPayments" :key="payment.id" class="payments-table-row">
          <span>{{ app.formatDateTime(payment.paidAt) }}</span>
          <span>{{ payment.asset.name }}</span>
          <span>{{ app.providerOf(payment.asset)?.name || app.t("common.providerEmpty") }}</span>
          <strong>{{ app.formatMoney(payment.amount, app.settings.currency) }}</strong>
        </div>
      </div>
      <div v-else-if="app.periodPayments.length" class="inline-empty">{{ app.t("stats.noFilteredPayments") }}</div>
      <div v-else class="inline-empty">{{ app.t("stats.noPeriodPayments") }}</div>
      <div class="table-footer" v-if="app.filteredPeriodPayments.length">
        <span>{{ app.t("common.total") }}: {{ app.formatMoney(app.filteredPeriodPaymentsTotal, app.settings.currency) }}</span>
        <div class="pagination">
          <button class="secondary-button icon-only" type="button" @click="app.setPaymentPage(app.paymentTablePage - 1)" :disabled="app.paymentTablePage <= 1" :aria-label="app.t('stats.prevPage')"><ChevronLeftIcon :size="16" /></button>
          <strong>{{ app.paymentTablePage }} / {{ app.paymentTablePages }}</strong>
          <button class="secondary-button icon-only" type="button" @click="app.setPaymentPage(app.paymentTablePage + 1)" :disabled="app.paymentTablePage >= app.paymentTablePages" :aria-label="app.t('stats.nextPage')"><ChevronRightIcon :size="16" /></button>
        </div>
      </div>
    </article>
  </section>
</template>

<script>
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Download as DownloadIcon, FileText as FileTextIcon } from "@lucide/vue";
import AppSelect from "../components/AppSelect.vue";
import AppSelectItem from "../components/AppSelectItem.vue";

export default {
  components: { AppSelect, AppSelectItem, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
