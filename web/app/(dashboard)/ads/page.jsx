"use client";

import { Megaphone } from "lucide-react";
import { useLocale } from "../../../context/LocaleContext";

export default function AdsPage() {
  const { t } = useLocale();

  return (
    <section className="view active">
      <div className="section-head">
        <div>
          <h1>{t("nav.ads")}</h1>
        </div>
      </div>

      <div className="empty-state visible">
        <Megaphone size={42} />
        <h1>{t("ads.inDevelopmentTitle")}</h1>
        <p>{t("ads.inDevelopmentText")}</p>
      </div>
    </section>
  );
}
