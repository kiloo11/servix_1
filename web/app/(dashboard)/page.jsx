"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Tabs from "../../components/ui/Tabs";
import AppTooltip from "../../components/ui/AppTooltip";
import FinanceDashboardTab from "../../components/finance/FinanceDashboardTab";
import FinanceOverviewTab from "../../components/finance/FinanceOverviewTab";
import FinancePaymentsTab from "../../components/finance/FinancePaymentsTab";
import FinanceReportsTab from "../../components/finance/FinanceReportsTab";
import { useLocale } from "../../context/LocaleContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFormat } from "../../lib/format";

const TAB_VALUES = ["dashboard", "overview", "payments", "reports"];

function initialTab() {
  if (typeof window === "undefined") return "dashboard";
  const fromHash = window.location.hash.replace("#", "");
  return TAB_VALUES.includes(fromHash) ? fromHash : "dashboard";
}

// Primary landing page — Дашборд (SaaS/MRR metrics) and the former standalone
// Finance section (Overview/Payments) merged into one tabbed "Финансы"
// section, since both are just different views onto the same business/money
// picture. Дашборд stays the default tab so "/" keeps behaving like the
// primary landing page it was before the merge. The former "Курсы валют" tab
// was replaced by "Отчёты" — rate refresh/display lives on in the Sidebar
// and Settings, so nothing was lost by dropping its own tab.
export default function FinancePage() {
  const { t } = useLocale();
  const { call } = useAuth();
  const { formatDateTime } = useFormat();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab);
  const [bedolagaStatus, setBedolagaStatus] = useState(null);
  const [bedolagaSyncing, setBedolagaSyncing] = useState(false);

  useEffect(() => {
    call("/api/bedolaga/sync/status").then(setBedolagaStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeTab(value) {
    setTab(value);
    window.location.hash = value;
  }

  async function syncBedolaga() {
    setBedolagaSyncing(true);
    try {
      const result = await call("/api/bedolaga/sync", { method: "POST" });
      setBedolagaStatus(result);
      toast(
        t("settings.bedolagaSyncDone", {
          transactions: result.transactionsSynced,
          subscriptions: result.subscriptionsSynced,
          users: result.usersSynced,
        })
      );
    } finally {
      setBedolagaSyncing(false);
    }
  }

  return (
    <section className="view active">
      <div className="section-head">
        <h1>{t("nav.finance")}</h1>
      </div>

      <Tabs
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "dashboard", label: t("finance.tabDashboard") },
          { value: "overview", label: t("finance.tabOverview") },
          { value: "payments", label: t("finance.tabPayments") },
          { value: "reports", label: t("finance.tabReports") },
        ]}
        actions={
          <>
            <span className="finance-bedolaga-hint">
              {bedolagaStatus && !bedolagaStatus.configured
                ? t("settings.bedolagaNotConfigured")
                : bedolagaStatus?.lastSyncAt
                  ? t("settings.bedolagaLastSync", { value: formatDateTime(bedolagaStatus.lastSyncAt) })
                  : t("settings.bedolagaNeverSynced")}
            </span>
            <AppTooltip label={t("settings.bedolagaSyncNow")}>
              <button
                type="button"
                className="summary-refresh-button finance-sync-button"
                onClick={syncBedolaga}
                disabled={bedolagaSyncing || bedolagaStatus?.configured === false}
                aria-label={t("settings.bedolagaSyncNow")}
              >
                <RefreshCw size={20} />
              </button>
            </AppTooltip>
          </>
        }
      >
        {tab === "dashboard" ? <FinanceDashboardTab /> : null}
        {tab === "overview" ? <FinanceOverviewTab /> : null}
        {tab === "payments" ? <FinancePaymentsTab /> : null}
        {tab === "reports" ? <FinanceReportsTab /> : null}
      </Tabs>
    </section>
  );
}
