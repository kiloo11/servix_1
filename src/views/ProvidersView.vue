<template>
  <section class="view active">
    <div class="section-head">
      <h1>{{ app.t("nav.providers") }}</h1>
      <button class="primary-button" type="button" @click="app.openProvider()"><PlusIcon :size="18" />{{ app.t("providers.add") }}</button>
    </div>
    <AccordionRoot v-if="app.providerTypeGroups.length" type="single" collapsible :default-value="app.providerTypeGroups[0].type" class="asset-sections provider-sections">
      <section v-for="group in app.providerTypeGroups" :key="group.type" class="asset-type-section">
        <AccordionItem :value="group.type" class="provider-type-group">
          <AccordionHeader>
            <AccordionTrigger class="asset-type-head provider-type-head">
              <h2>{{ group.label }}</h2>
              <span class="provider-type-head-right">
                {{ app.tc("piece", group.providers.reduce((sum, entry) => sum + entry.items.length, 0)) }}
                <ChevronDownIcon class="category-group-chevron" :size="16" />
              </span>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionContent>
            <div class="provider-grid">
              <article v-for="entry in group.providers" :key="entry.provider.id" class="provider-card" :style="app.providerStyle(entry.provider)">
                <header>
                  <div class="card-title-row">
                    <img v-if="entry.provider.faviconUrl" class="favicon" :src="entry.provider.faviconUrl" alt="" referrerpolicy="no-referrer">
                    <span v-else class="favicon-placeholder provider-color-mark">{{ entry.provider.name.slice(0, 1).toUpperCase() }}</span>
                    <div>
                      <h2>{{ entry.provider.name }}</h2>
                      <span v-if="entry.categories.length" class="provider-category-list">
                        <template v-for="(cat, index) in entry.categories" :key="cat">
                          <span class="provider-category-tag" :class="`provider-category-${cat}`">{{ app.t(`category.${cat}`) }}</span><span v-if="index < entry.categories.length - 1" class="provider-category-sep">, </span>
                        </template>
                      </span>
                    </div>
                  </div>
                  <span class="pill">{{ entry.items.length }}</span>
                </header>
                <p v-if="entry.provider.note" class="provider-note">{{ entry.provider.note }}</p>
                <div v-if="app.providerTypeCost(entry.items) > 0" class="provider-total">
                  <strong>{{ app.formatMoney(app.providerTypeCost(entry.items), app.settings.currency) }}</strong>
                  <small v-if="app.settings.currency !== 'RUB'" class="stat-card-sub">≈ {{ app.formatMoney(app.providerTypeCost(entry.items, 'RUB'), 'RUB') }}</small>
                </div>
                <span v-if="app.providerRecommendedDateFor(entry.items)" class="stat-card-sub">{{ app.t("providers.recommendedPayment", { date: app.providerRecommendedDateFor(entry.items) }) }}</span>
                <div class="provider-asset-list">
                  <span v-for="asset in entry.items" :key="asset.id" class="stat-card-sub provider-asset-name">{{ asset.name }}</span>
                </div>
                <footer>
                  <AppTooltip v-if="entry.provider.loginUrl" :label="app.t('common.login')">
                    <a class="secondary-link icon-only" :href="entry.provider.loginUrl" target="_blank" rel="noreferrer" :aria-label="app.t('common.login')"><ExternalLinkIcon :size="16" /></a>
                  </AppTooltip>
                  <span v-else></span>
                  <AppTooltip :label="app.t('common.open')">
                    <button class="secondary-button icon-only" type="button" @click="app.openProvider(entry.provider)" :aria-label="app.t('common.open')"><PencilIcon :size="16" /></button>
                  </AppTooltip>
                </footer>
              </article>
            </div>
          </AccordionContent>
        </AccordionItem>
      </section>
    </AccordionRoot>
    <div v-else class="empty-state visible">
      <h1>{{ app.t("providers.emptyTitle") }}</h1>
      <p>{{ app.t("providers.emptyText") }}</p>
    </div>
  </section>
</template>

<script>
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from "reka-ui";
import { ChevronDown as ChevronDownIcon, ExternalLink as ExternalLinkIcon, Pencil as PencilIcon, Plus as PlusIcon } from "@lucide/vue";
import AppTooltip from "../components/AppTooltip.vue";

export default {
  components: { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger, AppTooltip, ChevronDownIcon, ExternalLinkIcon, PencilIcon, PlusIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
