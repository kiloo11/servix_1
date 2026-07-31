"use client";

import { useState } from "react";
import Tabs from "../../components/ui/Tabs";
import FinanceDashboardTab from "../../components/finance/FinanceDashboardTab";
import FinanceOverviewTab from "../../components/finance/FinanceOverviewTab";
import FinancePaymentsTab from "../../components/finance/FinancePaymentsTab";
import FinanceRatesTab from "../../components/finance/FinanceRatesTab";
import { useLocale } from "../../context/LocaleContext";

const TAB_VALUES = ["dashboard", "overview", "payments", "rates"];

function initialTab() {
  if (typeof window === "undefined") return "dashboard";
  const fromHash = window.location.hash.replace("#", "");
  return TAB_VALUES.includes(fromHash) ? fromHash : "dashboard";
}

// Primary landing page — Дашборд (SaaS/MRR metrics) and the former standalone
// Finance section (Overview/Payments/Rates) merged into one tabbed "Финансы"
// section, since both are just different views onto the same business/money
// picture. Дашборд stays the default tab so "/" keeps behaving like the
// primary landing page it was before the merge.
export default function FinancePage() {
  const { t } = useLocale();
  const [tab, setTab] = useState(initialTab);

  function changeTab(value) {
    setTab(value);
    window.location.hash = value;
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
          { value: "rates", label: t("finance.tabRates") },
        ]}
      >
        {tab === "dashboard" ? <FinanceDashboardTab /> : null}
        {tab === "overview" ? <FinanceOverviewTab /> : null}
        {tab === "payments" ? <FinancePaymentsTab /> : null}
        {tab === "rates" ? <FinanceRatesTab /> : null}
      </Tabs>
    </section>
  );
}
