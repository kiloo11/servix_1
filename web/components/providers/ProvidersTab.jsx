"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Pencil, Plus } from "lucide-react";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/Accordion";
import AppTooltip from "../ui/AppTooltip";
import FaviconImage from "../ui/FaviconImage";
import ProviderFormModal from "./ProviderFormModal";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useGrouping } from "../../lib/grouping";
import { useMoney } from "../../lib/money";
import { emptyProvider } from "../../lib/assets";
import { clone } from "../../lib/dates";

// The former standalone Providers page (web/app/(dashboard)/providers/page.jsx),
// now the "Провайдеры" tab of the merged "Ресурсы" section alongside Records.
// Extended with a "no records" bucket — providerTypeGroups only ever shows
// a provider under the asset types it actually has records in (ported as-is
// from the original), which silently hid freshly created providers with
// nothing attached to them yet.
export default function ProvidersTab() {
  const { t, tc } = useLocale();
  const { meta } = useAuth();
  const { providerTypeGroups, providersWithoutRecords, providerRecommendedDateFor, providerTypeCost } = useGrouping();
  const { formatMoney } = useMoney();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  const groups = providerTypeGroups();
  const emptyProviders = providersWithoutRecords();
  const hasAnyProvider = groups.length > 0 || emptyProviders.length > 0;
  const defaultAccordionValue = groups.length ? groups[0].type : emptyProviders.length ? "no-records" : undefined;

  function openProvider(provider = null) {
    setEditingProvider(provider ? clone(provider) : emptyProvider());
    setModalOpen(true);
  }

  function renderProviderCard(provider, items, categories) {
    const cost = providerTypeCost(items, meta.currency);
    const recommendedDate = providerRecommendedDateFor(items);
    return (
      <article key={provider.id} className="provider-card">
        <header>
          <div className="card-title-row">
            <FaviconImage key={provider.faviconUrl || "none"} src={provider.faviconUrl} letter={provider.name.slice(0, 1).toUpperCase()} />
            <div>
              <h2>{provider.name}</h2>
              {categories.length ? (
                <span className="provider-category-list">
                  {categories.map((cat) => (
                    <span key={cat.id} className="category-badge" style={{ "--category-color": cat.color }}>
                      {cat.name}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
          <span className="pill">{items.length}</span>
        </header>
        {provider.note ? <p className="provider-note">{provider.note}</p> : null}
        {cost > 0 ? (
          <div className="provider-total">
            <strong>{formatMoney(cost, meta.currency)}</strong>
            {meta.currency !== "RUB" ? <small className="stat-card-sub">≈ {formatMoney(providerTypeCost(items, "RUB"), "RUB")}</small> : null}
          </div>
        ) : null}
        {recommendedDate ? <span className="stat-card-sub">{t("providers.recommendedPayment", { date: recommendedDate })}</span> : null}
        <div className="provider-asset-list">
          {items.map((asset) => (
            <span key={asset.id} className="pill provider-asset-name">
              {asset.name}
            </span>
          ))}
        </div>
        <footer>
          {provider.loginUrl ? (
            <AppTooltip label={t("common.login")}>
              <a className="secondary-link icon-only" href={provider.loginUrl} target="_blank" rel="noreferrer" aria-label={t("common.login")}>
                <ExternalLink size={16} />
              </a>
            </AppTooltip>
          ) : (
            <span />
          )}
          <AppTooltip label={t("common.open")}>
            <button className="secondary-button icon-only" type="button" onClick={() => openProvider(provider)} aria-label={t("common.open")}>
              <Pencil size={16} />
            </button>
          </AppTooltip>
        </footer>
      </article>
    );
  }

  return (
    <>
      <div className="toolbar">
        <span />
        <button className="primary-button" type="button" onClick={() => openProvider()}>
          <Plus size={18} />
          {t("providers.add")}
        </button>
      </div>

      {hasAnyProvider ? (
        <AccordionRoot type="single" collapsible defaultValue={defaultAccordionValue} className="asset-sections provider-sections">
          {groups.map((group) => (
            <section key={group.type} className="asset-type-section">
              <AccordionItem value={group.type} className="provider-type-group">
                <AccordionTrigger className="asset-type-head provider-type-head">
                  <h2>{group.label}</h2>
                  <span className="provider-type-head-right">
                    {tc("piece", group.providers.reduce((sum, entry) => sum + entry.items.length, 0))}
                    <ChevronDown className="category-group-chevron" size={16} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="provider-grid">{group.providers.map((entry) => renderProviderCard(entry.provider, entry.items, entry.categories))}</div>
                </AccordionContent>
              </AccordionItem>
            </section>
          ))}
          {emptyProviders.length ? (
            <section className="asset-type-section">
              <AccordionItem value="no-records" className="provider-type-group">
                <AccordionTrigger className="asset-type-head provider-type-head">
                  <h2>{t("providers.noRecords")}</h2>
                  <span className="provider-type-head-right">
                    {tc("piece", emptyProviders.length)}
                    <ChevronDown className="category-group-chevron" size={16} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="provider-grid">{emptyProviders.map((provider) => renderProviderCard(provider, [], []))}</div>
                </AccordionContent>
              </AccordionItem>
            </section>
          ) : null}
        </AccordionRoot>
      ) : (
        <div className="empty-state visible">
          <h1>{t("providers.emptyTitle")}</h1>
          <p>{t("providers.emptyText")}</p>
        </div>
      )}

      <ProviderFormModal open={modalOpen} onOpenChange={setModalOpen} provider={editingProvider} />
    </>
  );
}
