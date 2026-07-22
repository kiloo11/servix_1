<template>
  <section>
    <section class="toolbar">
      <div class="search-row">
        <input v-model="app.search" type="search" :placeholder="app.t('assets.search')">
        <AppSelect v-model="app.typeFilter" :aria-label="app.t('common.type')">
          <AppSelectItem value="all">{{ app.t("assets.allTypes") }}</AppSelectItem>
          <AppSelectItem value="inactive">{{ app.t("assets.inactive") }}</AppSelectItem>
          <AppSelectItem value="vps">{{ app.t("typePlural.vps") }}</AppSelectItem>
          <AppSelectItem value="domain">{{ app.t("typePlural.domain") }}</AppSelectItem>
          <AppSelectItem value="certificate">{{ app.t("typePlural.certificate") }}</AppSelectItem>
        </AppSelect>
      </div>
      <button class="primary-button" type="button" @click="app.openAsset()"><PlusIcon :size="18" />{{ app.t("assets.add") }}</button>
    </section>

    <section class="view active">
      <div class="asset-sections" v-if="app.filteredAssets.length">
        <section v-for="group in app.assetGroups" :key="group.type" class="asset-type-section">
          <div v-if="app.typeFilter === 'all'" class="asset-type-head">
            <h2>{{ group.label }}</h2>
            <span>{{ app.tc("piece", group.items.length) }}</span>
          </div>

          <template v-if="group.type === 'vps'">
            <CollapsibleRoot v-for="bucket in app.categorySubgroups(group.items)" :key="bucket.category || 'none'" default-open class="category-group">
              <CollapsibleTrigger class="category-group-summary">
                <span class="category-badge" :class="bucket.category ? `category-${bucket.category}` : ''">{{ bucket.label }}</span>
                <span class="category-group-count">{{ app.tc("piece", bucket.items.length) }}</span>
                <ChevronDownIcon class="category-group-chevron" :size="16" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="asset-grid">
                  <AssetCard v-for="asset in bucket.items" :key="asset.id" :app="app" :asset="asset" />
                </div>
              </CollapsibleContent>
            </CollapsibleRoot>
          </template>
          <div v-else class="asset-grid">
            <AssetCard v-for="asset in group.items" :key="asset.id" :app="app" :asset="asset" />
          </div>
        </section>
      </div>
      <div v-else class="empty-state visible">
        <h1>{{ app.t("assets.emptyTitle") }}</h1>
        <p>{{ app.t("assets.emptyText") }}</p>
        <button class="primary-button" type="button" @click="app.openAsset()"><PlusIcon :size="18" />{{ app.t("assets.add") }}</button>
      </div>
    </section>
  </section>
</template>

<script>
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui";
import { ChevronDown as ChevronDownIcon, Plus as PlusIcon } from "@lucide/vue";
import AppSelect from "../components/AppSelect.vue";
import AppSelectItem from "../components/AppSelectItem.vue";
import AssetCard from "./AssetCard.vue";

export default {
  components: { AppSelect, AppSelectItem, AssetCard, ChevronDownIcon, CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, PlusIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
