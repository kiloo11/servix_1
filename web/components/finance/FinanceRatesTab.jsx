"use client";

import { Coins, RefreshCw } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFormat } from "../../lib/format";
import { useMoney } from "../../lib/money";

// The canonical place for exchange-rate figures — previously duplicated
// between the Settings page's rates panel and this same refresh call. Settings
// now links here instead of re-rendering its own copy of the numbers.
export default function FinanceRatesTab() {
  const { t } = useLocale();
  const { meta, setMeta, call } = useAuth();
  const { formatDateTime, formatShort } = useFormat();
  const { usdRubRate } = useMoney();
  const toast = useToast();

  async function refreshRates() {
    setMeta({ ...meta, ...(await call("/api/rates/refresh", { method: "POST" })) });
    toast(t("settings.ratesRefreshed"));
  }

  return (
    <div className="settings-panel finance-rates-panel">
      <div className="settings-card-head">
        <div className="settings-card-icon">
          <Coins size={18} />
        </div>
        <div>
          <h2>{t("settings.ratesTitle")}</h2>
          <span>{t("settings.ratesText")}</span>
        </div>
      </div>
      <div className="rate-display-grid">
        <div>
          <span>{t("settings.rateRubPerEur")}</span>
          <strong>{formatShort(meta.rateRubPerEur)} RUB</strong>
        </div>
        <div>
          <span>{t("settings.rateUsdtPerEur")}</span>
          <strong>{formatShort(meta.rateUsdtPerEur)} ₮</strong>
        </div>
        <div>
          <span>{t("settings.rateUsdRub")}</span>
          <strong>{formatShort(usdRubRate())} RUB</strong>
        </div>
      </div>
      <div className="settings-inline-footer">
        <span className="hint">{meta.rateUpdatedAt ? t("settings.ratesUpdated", { value: formatDateTime(meta.rateUpdatedAt) }) : t("settings.ratesNever")}</span>
        <button className="secondary-button" type="button" onClick={refreshRates}>
          <RefreshCw size={16} />
          {t("settings.refreshRates")}
        </button>
      </div>
    </div>
  );
}
