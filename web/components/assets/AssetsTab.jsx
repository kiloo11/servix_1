"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/Accordion";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import AssetCard from "./AssetCard";
import AssetFormModal from "./AssetFormModal";
import PaymentsModal from "./PaymentsModal";
import ExpireModal from "./ExpireModal";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useAssetActions } from "../../lib/assetActions";
import { useGrouping } from "../../lib/grouping";
import { ASSET_TYPES, emptyAsset } from "../../lib/assets";
import { clone, compareAssetsOrder, parseAppDate } from "../../lib/dates";

// The former standalone Assets page (web/app/(dashboard)/assets/page.jsx),
// now the "Записи" tab of the merged "Ресурсы" section alongside Providers.
export default function AssetsTab() {
  const { t, tc, locale } = useLocale();
  const { meta } = useAuth();
  const { assets } = useData();
  const { assetGroupBuckets, providerOf, countryDisplayName } = useGrouping();
  const { dropAsset } = useAssetActions();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("manual");
  const [draggedId, setDraggedId] = useState("");

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [paymentsAssetId, setPaymentsAssetId] = useState("");
  const [expireModalOpen, setExpireModalOpen] = useState(false);
  const [expireAssetId, setExpireAssetId] = useState("");

  // Derived live from `assets` (not a snapshot) so the modal reflects fresh
  // data after a mutation reloads.
  const paymentsAsset = assets.find((asset) => asset.id === paymentsAssetId) || null;
  const expireAsset = assets.find((asset) => asset.id === expireAssetId) || null;

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const provider = providerOf(asset);
      const isInactive = Boolean(asset.inactive);
      const matchesType = typeFilter === "inactive" ? isInactive : !isInactive && (typeFilter === "all" || asset.type === typeFilter);
      const haystack = [asset.name, asset.ip, asset.domain, provider?.name].join(" ").toLowerCase();
      return matchesType && haystack.includes(query);
    });
  }, [assets, search, typeFilter, providerOf]);

  // "manual" is the drag-reordered sortOrder — the other three are purely
  // client-side display order and never touch sortOrder, so switching back
  // to "manual" always lands exactly where drag-and-drop left it.
  const sorters = useMemo(
    () => ({
      manual: compareAssetsOrder,
      payment: (a, b) => parseAppDate(a.expiresAt) - parseAppDate(b.expiresAt),
      provider: (a, b) => (providerOf(a)?.name || "").localeCompare(providerOf(b)?.name || "", locale),
      country: (a, b) => countryDisplayName(a.countryCode).localeCompare(countryDisplayName(b.countryCode), locale),
    }),
    [providerOf, countryDisplayName, locale]
  );

  const assetGroups = useMemo(
    () =>
      ASSET_TYPES.map((type) => ({
        type,
        label: t(`type.${type}`) || t("type.record"),
        items: filteredAssets.filter((asset) => asset.type === type).sort(sorters[sort] || compareAssetsOrder),
      })).filter((group) => group.items.length),
    [filteredAssets, t, sort, sorters]
  );

  const defaultAccordionValue = useMemo(() => {
    for (const group of assetGroups) {
      if (group.type !== "vps" && group.type !== "domain") continue;
      const bucket = assetGroupBuckets(group)[0];
      if (bucket) return [`${group.type}:${bucket.category || "none"}`];
    }
    return [];
  }, [assetGroups, assetGroupBuckets]);

  function openAsset(asset = null) {
    setEditingAsset(asset ? clone(asset) : { ...emptyAsset(), priceCurrency: meta.currency || "USDT" });
    setAssetModalOpen(true);
  }

  function openPayments(asset) {
    setPaymentsAssetId(asset.id);
    setPaymentsModalOpen(true);
  }

  function openExpire(asset) {
    setExpireAssetId(asset.id);
    setExpireModalOpen(true);
  }

  function renderCard(asset) {
    return (
      <AssetCard
        key={asset.id}
        asset={asset}
        dragging={draggedId === asset.id}
        dragDisabled={sort !== "manual"}
        onDragStart={(a, e) => {
          setDraggedId(a.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", a.id);
        }}
        onDragEnd={() => setDraggedId("")}
        onDropOn={(target) => {
          dropAsset(draggedId, target);
          setDraggedId("");
        }}
        onEdit={openAsset}
        onOpenPayments={openPayments}
        onOpenExpire={openExpire}
      />
    );
  }

  return (
    <>
      <section className="toolbar">
        <div className="search-row">
          <input type="search" placeholder={t("assets.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <AppSelect value={typeFilter} onChange={setTypeFilter} aria-label={t("common.type")}>
            <AppSelectItem value="all">{t("assets.allTypes")}</AppSelectItem>
            <AppSelectItem value="inactive">{t("assets.inactive")}</AppSelectItem>
            <AppSelectItem value="vps">{t("typePlural.vps")}</AppSelectItem>
            <AppSelectItem value="domain">{t("typePlural.domain")}</AppSelectItem>
            <AppSelectItem value="certificate">{t("typePlural.certificate")}</AppSelectItem>
          </AppSelect>
          <AppSelect value={sort} onChange={setSort} aria-label={t("assets.sort")}>
            <AppSelectItem value="manual">{t("assets.sortManual")}</AppSelectItem>
            <AppSelectItem value="payment">{t("assets.sortPayment")}</AppSelectItem>
            <AppSelectItem value="provider">{t("assets.sortProvider")}</AppSelectItem>
            <AppSelectItem value="country">{t("assets.sortCountry")}</AppSelectItem>
          </AppSelect>
        </div>
        <button className="primary-button" type="button" onClick={() => openAsset()}>
          <Plus size={18} />
          {t("assets.add")}
        </button>
      </section>

      {filteredAssets.length ? (
        <AccordionRoot type="multiple" defaultValue={defaultAccordionValue} className="asset-sections">
          {assetGroups.map((group) => (
            <section key={group.type} className="asset-type-section">
              {typeFilter === "all" ? (
                <div className="asset-type-head">
                  <h2>{group.label}</h2>
                  <span>{tc("piece", group.items.length)}</span>
                </div>
              ) : null}

              {group.type === "vps" || group.type === "domain" ? (
                assetGroupBuckets(group).map((bucket) => (
                  <AccordionItem key={bucket.category || "none"} value={`${group.type}:${bucket.category || "none"}`} className="category-group">
                    <AccordionTrigger className="category-group-summary">
                      <span className="category-badge" style={bucket.color ? { "--category-color": bucket.color } : undefined}>
                        {bucket.label}
                      </span>
                      <span className="category-group-count">{tc("piece", bucket.items.length)}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="asset-grid">{bucket.items.map(renderCard)}</div>
                    </AccordionContent>
                  </AccordionItem>
                ))
              ) : (
                <div className="asset-grid">{group.items.map(renderCard)}</div>
              )}
            </section>
          ))}
        </AccordionRoot>
      ) : (
        <div className="empty-state visible">
          <h1>{t("assets.emptyTitle")}</h1>
          <p>{t("assets.emptyText")}</p>
          <button className="primary-button" type="button" onClick={() => openAsset()}>
            <Plus size={18} />
            {t("assets.add")}
          </button>
        </div>
      )}

      <AssetFormModal open={assetModalOpen} onOpenChange={setAssetModalOpen} asset={editingAsset} />
      <PaymentsModal open={paymentsModalOpen} onOpenChange={setPaymentsModalOpen} asset={paymentsAsset} />
      <ExpireModal open={expireModalOpen} onOpenChange={setExpireModalOpen} asset={expireAsset} />
    </>
  );
}
