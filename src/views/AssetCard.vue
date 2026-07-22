<template>
  <article
    class="asset-card"
    :class="[app.dueStateClass(asset.expiresAt), { dragging: app.draggedAssetId === asset.id }]"
    draggable="true"
    @dragstart="app.startAssetDrag(asset, $event)"
    @dragover.prevent
    @drop="app.dropAsset(asset)"
    @dragend="app.endAssetDrag"
  >
    <header>
      <div class="card-title-row">
        <img v-if="app.providerOf(asset)?.faviconUrl" class="favicon" :src="app.providerOf(asset).faviconUrl" alt="" referrerpolicy="no-referrer">
        <span v-else class="favicon-placeholder">{{ app.providerInitial(asset) }}</span>
        <div>
          <h2>{{ asset.name }}</h2>
          <span v-if="asset.type === 'vps'" class="country-option">
            <img v-if="asset.countryCode" class="flag-icon" :src="app.countryFlagUrl(asset.countryCode)" alt="">
            {{ app.assetSubtitle(asset) }}
          </span>
          <a v-else-if="asset.domain" class="card-subtitle-link" :href="app.domainHref(asset.domain)" target="_blank" rel="noreferrer">{{ asset.domain }}</a>
          <span v-else>{{ app.assetSubtitle(asset) }}</span>
        </div>
      </div>
      <div class="header-badges">
        <span v-if="asset.category" class="category-badge" :class="`category-${asset.category}`">{{ app.t(`category.${asset.category}`) }}</span>
        <span class="pill">{{ app.formatDateTime(asset.expiresAt) }}</span>
      </div>
    </header>
    <div class="meta-list">
      <span>{{ app.t("assets.metaProvider", { value: app.providerOf(asset)?.name || app.t("common.providerEmpty") }) }}</span>
      <span v-if="asset.type === 'vps' && asset.ip" class="ip-meta">
        <span>IP:</span>
        <button class="meta-copy-button" type="button" :title="app.t('assets.copyIp')" @click="app.copyIp(asset.ip)">{{ asset.ip }}</button>
      </span>
      <span>{{ app.daysText(asset.expiresAt) }}</span>
    </div>
    <div v-if="asset.price" class="price-strip">
      <strong>{{ app.formatMoney(asset.price, asset.priceCurrency) }}</strong>
      <span v-if="asset.priceCurrency !== 'EUR'">≈ {{ app.formatMoney(app.convertToEur(asset.price, asset.priceCurrency), 'EUR') }}</span>
    </div>
    <div class="payment-strip">
      <strong>{{ app.formatPaymentTotal(asset.payments) }}</strong>
      <span>{{ app.tc("payment", asset.payments?.length || 0) }}</span>
    </div>
    <footer>
      <AppTooltip v-if="app.providerOf(asset)?.loginUrl" :label="app.t('common.cabinet')">
        <a class="secondary-link icon-only" :href="app.providerOf(asset).loginUrl" target="_blank" rel="noreferrer" :aria-label="app.t('common.cabinet')"><ExternalLinkIcon :size="16" /></a>
      </AppTooltip>
      <span v-else></span>
      <div class="card-actions">
        <AppTooltip :label="app.t('assets.quickRenew')">
          <button class="secondary-button icon-only" type="button" @click="app.quickRenew(asset)" :aria-label="app.t('assets.quickRenew')"><ZapIcon :size="16" /></button>
        </AppTooltip>
        <AppTooltip :label="app.t('common.payments')">
          <button class="secondary-button icon-only" type="button" @click="app.openPayments(asset)" :aria-label="app.t('common.payments')"><CreditCardIcon :size="16" /></button>
        </AppTooltip>
        <AppTooltip :label="app.t('common.term')">
          <button class="secondary-button icon-only" type="button" @click="app.openExpire(asset)" :aria-label="app.t('common.term')"><CalendarClockIcon :size="16" /></button>
        </AppTooltip>
        <AppTooltip :label="asset.inactive ? app.t('assets.activate') : app.t('assets.deactivate')">
          <button class="secondary-button icon-only" type="button" @click="app.toggleAssetInactive(asset, !asset.inactive)" :aria-label="asset.inactive ? app.t('assets.activate') : app.t('assets.deactivate')">
            <RotateCcwIcon v-if="asset.inactive" :size="16" />
            <ArchiveXIcon v-else :size="16" />
          </button>
        </AppTooltip>
        <AppTooltip :label="app.t('common.open')">
          <button class="secondary-button icon-only" type="button" @click="app.openAsset(asset)" :aria-label="app.t('common.open')"><PencilIcon :size="16" /></button>
        </AppTooltip>
      </div>
    </footer>
  </article>
</template>

<script>
import { ArchiveX as ArchiveXIcon, CalendarClock as CalendarClockIcon, CreditCard as CreditCardIcon, ExternalLink as ExternalLinkIcon, Pencil as PencilIcon, RotateCcw as RotateCcwIcon, Zap as ZapIcon } from "@lucide/vue";
import AppTooltip from "../components/AppTooltip.vue";

export default {
  components: { AppTooltip, ArchiveXIcon, CalendarClockIcon, CreditCardIcon, ExternalLinkIcon, PencilIcon, RotateCcwIcon, ZapIcon },
  props: {
    app: { type: Object, required: true },
    asset: { type: Object, required: true }
  }
};
</script>
