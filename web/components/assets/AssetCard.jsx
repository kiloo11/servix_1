"use client";

import { ArchiveX, Building2, CalendarClock, CreditCard, ExternalLink, Pencil, RotateCcw, Terminal, TriangleAlert, Zap } from "lucide-react";
import AppTooltip from "../ui/AppTooltip";
import FaviconImage from "../ui/FaviconImage";
import { useLocale } from "../../context/LocaleContext";
import { useAssetActions } from "../../lib/assetActions";
import { useFormat } from "../../lib/format";
import { useGrouping } from "../../lib/grouping";
import { useMoney } from "../../lib/money";
import { domainHref } from "../../lib/assets";
import { countryFlagUrl } from "../../lib/countries";

// Ported from src/views/AssetCard.vue.
export default function AssetCard({ asset, dragging, dragDisabled, onDragStart, onDragEnd, onDropOn, onEdit, onOpenPayments, onOpenExpire }) {
  const { t, tc } = useLocale();
  const { providerOf, assetSubtitle } = useGrouping();
  const { formatDate, daysText, dueStateClass, quickRenewLabel } = useFormat();
  const { formatMoney, convertToEur, formatPaymentTotal } = useMoney();
  const { copyIp, quickRenew, toggleAssetInactive } = useAssetActions();

  const provider = providerOf(asset);
  // Computed once and reused for the card border, the expiry pill, and the
  // relative status line below — the single fact a user scans a whole list
  // of cards for is "is anything overdue or due soon", so all three should
  // agree on the same color instead of only the border carrying it.
  const due = dueStateClass(asset.expiresAt);

  return (
    <article
      className={`asset-card${due ? ` ${due}` : ""}${dragging ? " dragging" : ""}`}
      draggable={!dragDisabled}
      onDragStart={dragDisabled ? undefined : (e) => onDragStart(asset, e)}
      onDragOver={dragDisabled ? undefined : (e) => e.preventDefault()}
      onDrop={dragDisabled ? undefined : () => onDropOn(asset)}
      onDragEnd={dragDisabled ? undefined : onDragEnd}
    >
      <header>
        <div className="card-title-row">
          <FaviconImage key={provider?.faviconUrl || "none"} src={provider?.faviconUrl} letter={asset.name.slice(0, 1).toUpperCase()} />
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
      </header>
      <div className="meta-list">
        <span className="meta-row">
          <Building2 size={14} title={t("common.provider")} />
          {provider?.name || t("common.providerEmpty")}
        </span>
        {asset.type === "vps" && asset.ip ? (
          <span className="meta-row">
            <Terminal size={14} title="IP" />
            <button className="meta-copy-button" type="button" title={t("assets.copyIp")} onClick={() => copyIp(asset.ip)}>
              {asset.ip}
            </button>
          </span>
        ) : null}
      </div>
      <div className={`expiry-block${due ? ` ${due}` : ""}`}>
        <span className="expiry-block-main">
          {due === "is-overdue" ? <TriangleAlert size={12} /> : null}
          {daysText(asset.expiresAt)} ({formatDate(asset.expiresAt)})
        </span>
      </div>
      <div className="asset-figures">
        {asset.price ? (
          <div className="asset-figure">
            <span className="asset-figure-label">{t("pnl.colMonthly")}</span>
            <strong>{formatMoney(asset.price, asset.priceCurrency)}</strong>
            {asset.priceCurrency !== "EUR" ? <small className="stat-card-sub">≈ {formatMoney(convertToEur(asset.price, asset.priceCurrency), "EUR")}</small> : null}
          </div>
        ) : null}
        <div className="asset-figure">
          <span className="asset-figure-label">{t("pnl.colTotal")}</span>
          <strong>{formatPaymentTotal(asset.payments)}</strong>
          <small className="stat-card-sub">{tc("payment", asset.payments?.length || 0)}</small>
        </div>
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
