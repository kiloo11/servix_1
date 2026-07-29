"use client";

import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useMoney } from "./money";
import { useFormat } from "./format";
import { ASSET_TYPES } from "./assets";
import { assetCycleDays, compareAssetsOrder, DAY_MS, parseAppDate } from "./dates";
import { countryNameForLocale } from "./i18n";

// Ported from App.vue's providerOf/providerAssets/providerCategoriesFor/
// providerTypeCost/providerRecommendedDateFor/providerInitial/
// assetSubtitle/categorySubgroups/domainBucket/assetGroupBuckets/
// providerTypeGroups/countryDisplayName — the grouping/lookup helpers shared
// by AssetsView, ProvidersView and AssetCard.
export function useGrouping() {
  const { providers, categories, assets } = useData();
  const { locale, t } = useLocale();
  const { convertAmount } = useMoney();
  const { formatDate } = useFormat();

  function categoryById(id) {
    return categories.find((category) => category.id === id);
  }
  function providerOf(asset) {
    return providers.find((provider) => provider.id === asset.providerId);
  }
  function providerAssets(providerId) {
    return assets.filter((asset) => asset.providerId === providerId && !asset.inactive);
  }
  // Returns the actual category entities (not just ids) present among
  // `items`, in the categories list's own sort order — the caller no longer
  // needs a separate id → {name, color} lookup.
  function providerCategoriesFor(items) {
    const present = new Set(items.map((asset) => asset.category).filter(Boolean));
    return categories.filter((category) => present.has(category.id));
  }
  function providerTypeCost(items, currency) {
    return items.reduce((sum, asset) => {
      const cyclePrice = convertAmount(Number(asset.price || 0), asset.priceCurrency || "USDT", currency);
      return sum + (asset.type === "vps" ? cyclePrice : (cyclePrice / Math.max(1, assetCycleDays(asset))) * 30);
    }, 0);
  }
  function providerRecommendedDateFor(items) {
    const dates = items.map((asset) => asset.expiresAt).filter(Boolean);
    if (!dates.length) return "";
    const nearest = parseAppDate(dates.sort((a, b) => parseAppDate(a) - parseAppDate(b))[0]);
    if (Number.isNaN(nearest.getTime())) return "";
    return formatDate(new Date(nearest.getTime() - DAY_MS));
  }
  function providerInitial(asset) {
    return (providerOf(asset)?.name || "?").slice(0, 1).toUpperCase();
  }
  function countryDisplayName(code) {
    return code ? countryNameForLocale(code, locale) : t("common.countryEmpty");
  }
  function assetSubtitle(asset) {
    if (asset.type === "vps") return asset.countryCode ? countryDisplayName(asset.countryCode) : t("common.countryEmpty");
    return asset.domain || t("common.domain");
  }
  function categorySubgroups(items) {
    return [...categories.map((category) => category.id), ""]
      .map((categoryId) => ({
        category: categoryId,
        label: categoryId ? categoryById(categoryId)?.name || categoryId : t("assets.categoryEmpty"),
        color: categoryId ? categoryById(categoryId)?.color : undefined,
        items: items.filter((asset) => (asset.category || "") === categoryId),
      }))
      .filter((bucket) => bucket.items.length);
  }
  function domainBucket(items) {
    // "domain" isn't a real managed category (no row in the categories
    // table) — it's a synthetic bucket for domain-type assets, so it gets a
    // fixed color instead of a categoryById() lookup.
    return items.length ? [{ category: "domain", label: t("category.domain"), color: "#38bdf8", items }] : [];
  }
  function assetGroupBuckets(group) {
    if (group.type === "vps") return categorySubgroups(group.items);
    if (group.type === "domain") return domainBucket(group.items);
    return [];
  }
  function providerTypeGroups() {
    return ASSET_TYPES.map((type) => ({
      type,
      label: t(`typePlural.${type}`),
      providers: providers
        .map((provider) => {
          const items = providerAssets(provider.id).filter((asset) => asset.type === type);
          return { provider, items, categories: providerCategoriesFor(items) };
        })
        .filter((entry) => entry.items.length),
    })).filter((group) => group.providers.length);
  }
  // Providers grouped-by-type above are invisible if they have zero active
  // assets attached (the grouping is asset-driven, ported from App.vue as-is)
  // — surfaced separately here so a freshly created provider isn't just gone
  // from the page until you attach a record to it.
  function providersWithoutRecords() {
    return providers.filter((provider) => providerAssets(provider.id).length === 0);
  }

  return {
    categoryById,
    providerOf,
    providerAssets,
    providerCategoriesFor,
    providerTypeCost,
    providerRecommendedDateFor,
    providerInitial,
    countryDisplayName,
    assetSubtitle,
    categorySubgroups,
    domainBucket,
    assetGroupBuckets,
    providerTypeGroups,
    providersWithoutRecords,
  };
}
