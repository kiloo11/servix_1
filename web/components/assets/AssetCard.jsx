"use client";

import { ArchiveX, CalendarClock, CreditCard, ExternalLink, Pencil, RotateCcw, Zap } from "lucide-react";
import AppTooltip from "../ui/AppTooltip";
import { useLocale } from "../../context/LocaleContext";
import { useAssetActions } from "../../lib/assetActions";
import { useFormat } from "../../lib/format";
import { useGrouping } from "../../lib/grouping";
import { useMoney } from "../../lib/money";
import { domainHref } from "../../lib/assets";
import { countryFlagUrl } from "../../lib/countries";

// Ported from src/views/AssetCard.vue.
export default function AssetCard({ asset, dragging, onDragStart, onDragEnd, onDropOn, onEdit, onOpenPayments, onOpenExpire }) {
  const { t, tc } = useLocale();
  const { providerOf, providerInitial, assetSubtitle, categoryById } = useGrouping();
  const { formatDateTime, daysText, dueStateClass, assetNextPaymentDate, quickRenewLabel } = useFormat();
  const { formatMoney, convertToEur, formatPaymentTotal } = useMoney();
  const { copyIp, quickRenew, toggleAssetInactive } = useAssetActions();

  const provider = providerOf(asset);

  return (
    <article
      className={`asset-card${dueStateClass(asset.expiresAt) ? ` ${dueStateClass(asset.expiresAt)}` : ""}${dragging ? " dragging" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(asset, e)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropOn(asset)}
      onDragEnd={onDragEnd}
    >
      <header>
        <div className="card-title-row">
          {provider?.faviconUrl ? (
            <img className="favicon" src={provider.faviconUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="favicon-placeholder">{providerInitial(asset)}</span>
          )}
          <div>
            <h2>{asset.name}</h2>
            {asset.type === "vps" ? (
              <span className="country-option">
                {asset.countryCode ? <img className="flag-icon" src={countryFlagUrl(asset.countryCode)} alt="" /> : null}
                {assetSubtitle(asset)}
              </span>
            ) : asset.domain ? (
              <a className="card-subtitle-link" href={domainHref(asset.domain)} target="_blank" rel="noreferrer">
                {asset.domain}
              </a>
            ) : (
              <span>{assetSubtitle(asset)}</span>
            )}
          </div>
        </div>
        <div className="header-badges">
          {asset.category && categoryById(asset.category) ? (
            <span className="category-badge" style={{ "--category-color": categoryById(asset.category).color }}>
              {categoryById(asset.category).name}
            </span>
          ) : null}
          <span className="pill">{formatDateTime(asset.expiresAt)}</span>
        </div>
      </header>
      <div className="meta-list">
        <span>{t("assets.metaProvider", { value: provider?.name || t("common.providerEmpty") })}</span>
        {asset.type === "vps" && asset.ip ? (
          <span className="ip-meta">
            <span>IP:</span>
            <button className="meta-copy-button" type="button" title={t("assets.copyIp")} onClick={() => copyIp(asset.ip)}>
              {asset.ip}
            </button>
          </span>
        ) : null}
        <span>{daysText(asset.expiresAt)}</span>
        {assetNextPaymentDate(asset) ? <span className="stat-card-sub">{t("assets.nextPayment", { date: assetNextPaymentDate(asset) })}</span> : null}
      </div>
      {asset.price ? (
        <div className="price-strip">
          <strong>{formatMoney(asset.price, asset.priceCurrency)}</strong>
          {asset.priceCurrency !== "EUR" ? <span>≈ {formatMoney(convertToEur(asset.price, asset.priceCurrency), "EUR")}</span> : null}
        </div>
      ) : null}
      <div className="payment-strip">
        <strong>{formatPaymentTotal(asset.payments)}</strong>
        <span>{tc("payment", asset.payments?.length || 0)}</span>
      </div>
      <footer>
        {provider?.loginUrl ? (
          <AppTooltip label={t("common.cabinet")}>
            <a className="secondary-link icon-only" href={provider.loginUrl} target="_blank" rel="noreferrer" aria-label={t("common.cabinet")}>
              <ExternalLink size={16} />
            </a>
          </AppTooltip>
        ) : (
          <span />
        )}
        <div className="card-actions">
          <AppTooltip label={quickRenewLabel(asset)}>
            <button className="secondary-button icon-only" type="button" onClick={() => quickRenew(asset)} aria-label={quickRenewLabel(asset)}>
              <Zap size={16} />
            </button>
          </AppTooltip>
          <AppTooltip label={t("common.payments")}>
            <button className="secondary-button icon-only" type="button" onClick={() => onOpenPayments(asset)} aria-label={t("common.payments")}>
              <CreditCard size={16} />
            </button>
          </AppTooltip>
          <AppTooltip label={t("common.term")}>
            <button className="secondary-button icon-only" type="button" onClick={() => onOpenExpire(asset)} aria-label={t("common.term")}>
              <CalendarClock size={16} />
            </button>
          </AppTooltip>
          <AppTooltip label={asset.inactive ? t("assets.activate") : t("assets.deactivate")}>
            <button
              className="secondary-button icon-only"
              type="button"
              onClick={() => toggleAssetInactive(asset, !asset.inactive)}
              aria-label={asset.inactive ? t("assets.activate") : t("assets.deactivate")}
            >
              {asset.inactive ? <RotateCcw size={16} /> : <ArchiveX size={16} />}
            </button>
          </AppTooltip>
          <AppTooltip label={t("common.open")}>
            <button className="secondary-button icon-only" type="button" onClick={() => onEdit(asset)} aria-label={t("common.open")}>
              <Pencil size={16} />
            </button>
          </AppTooltip>
        </div>
      </footer>
    </article>
  );
}
