<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.providers") }}</h1>
      <button class="primary-button" type="button" @click="app.openProvider()"><PlusIcon :size="18" />{{ app.t("providers.add") }}</button>
    </div>
    <div class="provider-grid" v-if="app.providers.length">
      <article v-for="provider in app.providers" :key="provider.id" class="provider-card" :style="app.providerStyle(provider)">
        <header>
          <div class="card-title-row">
            <img v-if="provider.faviconUrl" class="favicon" :src="provider.faviconUrl" alt="" referrerpolicy="no-referrer">
            <span v-else class="favicon-placeholder provider-color-mark">{{ provider.name.slice(0, 1).toUpperCase() }}</span>
            <div>
              <h2>{{ provider.name }}</h2>
              <span v-if="app.providerCategories(provider.id).length" class="provider-category-list">
                <template v-for="(cat, index) in app.providerCategories(provider.id)" :key="cat">
                  <span class="provider-category-tag" :class="`provider-category-${cat}`">{{ app.t(`category.${cat}`) }}</span><span v-if="index < app.providerCategories(provider.id).length - 1" class="provider-category-sep">, </span>
                </template>
              </span>
            </div>
          </div>
          <span class="pill">{{ app.providerAssets(provider.id).length }}</span>
        </header>
        <p v-if="provider.note" class="provider-note">{{ provider.note }}</p>
        <div v-if="app.providerMonthlyCost(provider.id) > 0" class="provider-total">
          <strong>{{ app.formatMoney(app.providerMonthlyCost(provider.id), app.settings.currency) }}</strong>
          <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.formatMoney(app.providerMonthlyCost(provider.id, 'RUB'), 'RUB') }}</small>
        </div>
        <div v-if="app.providerAssets(provider.id).length" class="provider-asset-list">
          <span v-for="asset in app.providerAssets(provider.id)" :key="asset.id" class="stat-card-sub provider-asset-name">{{ asset.name }}</span>
        </div>
        <p v-else class="stat-card-sub provider-note-empty">{{ app.t("providers.noRecords") }}</p>
        <footer>
          <AppTooltip v-if="provider.loginUrl" :label="app.t('common.login')">
            <a class="secondary-link icon-only" :href="provider.loginUrl" target="_blank" rel="noreferrer" :aria-label="app.t('common.login')"><ExternalLinkIcon :size="16" /></a>
          </AppTooltip>
          <span v-else></span>
          <AppTooltip :label="app.t('common.open')">
            <button class="secondary-button icon-only" type="button" @click="app.openProvider(provider)" :aria-label="app.t('common.open')"><PencilIcon :size="16" /></button>
          </AppTooltip>
        </footer>
      </article>
    </div>
    <div v-else class="empty-state visible">
      <h1>{{ app.t("providers.emptyTitle") }}</h1>
      <p>{{ app.t("providers.emptyText") }}</p>
    </div>
  </section>
</template>

<script>
import { ExternalLink as ExternalLinkIcon, Pencil as PencilIcon, Plus as PlusIcon } from "@lucide/vue";
import AppTooltip from "../components/AppTooltip.vue";

export default {
  components: { AppTooltip, ExternalLinkIcon, PencilIcon, PlusIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
