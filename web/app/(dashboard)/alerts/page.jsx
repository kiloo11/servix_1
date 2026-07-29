"use client";

import { useState } from "react";
import { Bell, CalendarClock, Pencil } from "lucide-react";
import AppTooltip from "../../../components/ui/AppTooltip";
import AssetFormModal from "../../../components/assets/AssetFormModal";
import { useLocale } from "../../../context/LocaleContext";
import { useAuth } from "../../../context/AuthContext";
import { useData } from "../../../context/DataContext";
import { useFormat } from "../../../lib/format";
import { clone } from "../../../lib/dates";

// Ported from src/views/AlertsView.vue. The "edit" button opens the same
// AssetFormModal as the Assets page — each page that can trigger it owns a
// small local instance (open flag + draft), matching Phase 2's pattern of
// keeping modal state page-local rather than global.
export default function AlertsPage() {
  const { t } = useLocale();
  const { meta } = useAuth();
  const { alerts, assets } = useData();
  const { formatDateTime, alertWhen, dueStateClass } = useFormat();

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  function openAsset(asset) {
    if (!asset) return;
    setEditingAsset(clone(asset));
    setAssetModalOpen(true);
  }

  return (
    <section className="view active alerts-view">
      <div className="section-head alerts-head">
        <div>
          <h1>{t("nav.alerts")}</h1>
        </div>
        <div className="alerts-counter">
          <Bell size={18} />
          <strong>{alerts.length}</strong>
        </div>
      </div>

      <div className={`alerts-status-panel${meta.telegramConfigured ? " configured" : ""}`}>
        <span className="alerts-status-icon">
          <Bell size={18} />
        </span>
        <span>{meta.telegramConfigured ? t("alerts.configured") : t("alerts.notConfigured")}</span>
      </div>

      {alerts.length ? (
        <div className="alert-list">
          {alerts.map((item) => (
            <article key={item.id} className={`alert-item${dueStateClass(item.date) ? ` ${dueStateClass(item.date)}` : ""}`}>
              <div className="alert-icon">
                <CalendarClock size={18} />
              </div>
              <div className="alert-main">
                <strong>{item.title}</strong>
                <div className="alert-meta">
                  <span>{formatDateTime(item.date)}</span>
                  <span>{alertWhen(item)}</span>
                </div>
              </div>
              <AppTooltip label={t("common.open")}>
                <button className="secondary-button icon-only" type="button" onClick={() => openAsset(assets.find((asset) => asset.id === item.assetId))} aria-label={t("common.open")}>
                  <Pencil size={16} />
                </button>
              </AppTooltip>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state visible alert-empty">
          <Bell size={42} />
          <h1>{t("alerts.emptyTitle")}</h1>
          <p>{t("alerts.emptyText")}</p>
        </div>
      )}

      <AssetFormModal open={assetModalOpen} onOpenChange={setAssetModalOpen} asset={editingAsset} />
    </section>
  );
}
