"use client";

import { useState } from "react";
import Tabs from "../../../components/ui/Tabs";
import AssetsTab from "../../../components/assets/AssetsTab";
import ProvidersTab from "../../../components/providers/ProvidersTab";
import { useLocale } from "../../../context/LocaleContext";

const TAB_VALUES = ["records", "providers"];

function initialTab() {
  if (typeof window === "undefined") return "records";
  const fromHash = window.location.hash.replace("#", "");
  return TAB_VALUES.includes(fromHash) ? fromHash : "records";
}

// Providers merged into the "Ресурсы" section as a second tab alongside the
// individual records (servers/domains/certificates) — both are views onto
// the same infrastructure, and Providers used to be a separate top-level
// nav item for no strong reason.
export default function AssetsPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState(initialTab);

  function changeTab(value) {
    setTab(value);
    window.location.hash = value;
  }

  return (
    <section className="view active">
      <div className="section-head">
        <h1>{t("nav.assets")}</h1>
      </div>

      <Tabs
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "records", label: t("assets.tabRecords") },
          { value: "providers", label: t("nav.providers") },
        ]}
      >
        {tab === "records" ? <AssetsTab /> : null}
        {tab === "providers" ? <ProvidersTab /> : null}
      </Tabs>
    </section>
  );
}
