"use client";

import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import AppSelect from "../ui/AppSelect";
import AppSelectItem from "../ui/AppSelectItem";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useAssetActions } from "../../lib/assetActions";
import { useFormat } from "../../lib/format";
import { CURRENCIES } from "../../lib/assets";
import { currencySymbol } from "../../lib/money";

const PRESET_DAYS = [1, 3, 5, 10, 20, 30, 60, 90];

// Ported from the "expire" <Modal> block in App.vue's template +
// openExpire/adjustExpireDays.
export default function ExpireModal({ open, onOpenChange, asset }) {
  const { t, tc } = useLocale();
  const { meta } = useAuth();
  const { formatDateTime } = useFormat();
  const { adjustExpireDays } = useAssetActions();

  const [renewalPayment, setRenewalPayment] = useState({ amount: "", currency: "USDT" });

  useEffect(() => {
    if (!open) return;
    setRenewalPayment({ amount: "", currency: meta.currency || "USDT" });
  }, [open, meta.currency]);

  if (!asset) return null;

  async function handleAdjust(days) {
    await adjustExpireDays(asset, days, renewalPayment);
    setRenewalPayment({ amount: "", currency: meta.currency || "USDT" });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} closeLabel={t("common.cancel")} title={`${t("common.term")}: ${asset?.name || ""}`}>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="expire-current">
          <span>{t("common.currentTerm")}</span>
          <strong>{formatDateTime(asset?.expiresAt)}</strong>
        </div>
        <div className="renewal-price-row">
          <label>
            {t("common.renewalPrice")}
            <input
              type="number"
              min="0"
              step="0.000001"
              placeholder="0.00"
              value={renewalPayment.amount}
              onChange={(e) => setRenewalPayment((c) => ({ ...c, amount: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
          </label>
          <label>
            {t("common.currency")}
            <AppSelect value={renewalPayment.currency} onChange={(v) => setRenewalPayment((c) => ({ ...c, currency: v }))} aria-label={t("common.currency")}>
              {CURRENCIES.map((currency) => (
                <AppSelectItem key={currency} value={currency}>
                  {currencySymbol(currency)}
                </AppSelectItem>
              ))}
            </AppSelect>
          </label>
        </div>
        <p className="hint">{t("common.renewalPriceHint")}</p>
        <div className="date-adjust-panel">
          <div className="date-adjust-group is-minus">
            <div className="date-adjust-title">
              <strong>{t("duration.reduceTerm")}</strong>
              <span>{t("duration.reduceHint")}</span>
            </div>
            <div className="date-adjust-row">
              {PRESET_DAYS.map((days) => (
                <button key={`minus-${days}`} className="secondary-button preset-button" type="button" onClick={() => handleAdjust(-days)}>
                  <span>-</span>
                  {tc("day", days)}
                </button>
              ))}
            </div>
          </div>
          <div className="date-adjust-group is-plus">
            <div className="date-adjust-title">
              <strong>{t("duration.extendTerm")}</strong>
              <span>{t("duration.extendHint")}</span>
            </div>
            <div className="date-adjust-row">
              {PRESET_DAYS.map((days) => (
                <button key={`plus-${days}`} className="secondary-button preset-button" type="button" onClick={() => handleAdjust(days)}>
                  <span>+</span>
                  {tc("day", days)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
