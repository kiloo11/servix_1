"use client";

import { useMemo, useState } from "react";
import { Bell, BookOpen, ClipboardList, CreditCard, FileText, LineChart, Rocket, Server, ShieldCheck } from "lucide-react";
import { useLocale } from "../../../context/LocaleContext";

const GUIDE_SECTION_IDS = ["start", "records", "providers", "payments", "notifications", "statistics", "security", "logs", "bestPractices"];

const GUIDE_ICONS = {
  start: Rocket,
  records: Server,
  providers: ClipboardList,
  payments: CreditCard,
  notifications: Bell,
  statistics: LineChart,
  security: ShieldCheck,
  logs: FileText,
  bestPractices: BookOpen,
};

// Pure content pulled from locale JSON, filtered client-side by a search box.
export default function GuidePage() {
  const { t, tList } = useLocale();
  const [search, setSearch] = useState("");

  const guideSections = useMemo(
    () =>
      GUIDE_SECTION_IDS.map((id) => ({
        id,
        title: t(`guide.sections.${id}.title`),
        text: t(`guide.sections.${id}.text`),
        items: tList(`guide.sections.${id}.items`),
        do: tList(`guide.sections.${id}.do`),
        dont: tList(`guide.sections.${id}.dont`),
      })),
    [t, tList]
  );

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guideSections;
    return guideSections.filter((section) => [section.title, section.text, ...section.items, ...section.do, ...section.dont].join(" ").toLowerCase().includes(query));
  }, [guideSections, search]);

  return (
    <section className="view active">
      <div className="section-head">
        <div className="heading-stack">
          <h1>{t("nav.guide")}</h1>
          <span>{t("guide.subtitle")}</span>
        </div>
      </div>

      <section className="guide-search-panel">
        <input type="search" placeholder={t("guide.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <span>{t("guide.found", { count: filteredSections.length })}</span>
      </section>

      {filteredSections.length ? (
        <div className="guide-manual">
          {filteredSections.map((section) => {
            const Icon = GUIDE_ICONS[section.id] || BookOpen;
            return (
              <article key={section.id} className="guide-manual-card">
                <div className="guide-manual-head">
                  <span className="guide-section-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <div>
                    <h2>{section.title}</h2>
                    <p>{section.text}</p>
                  </div>
                </div>

                {section.items.length ? (
                  <ul className="guide-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {section.do.length || section.dont.length ? (
                  <div className="guide-advice-grid">
                    {section.do.length ? (
                      <div className="guide-advice is-good">
                        <strong>{t("guide.goodTitle")}</strong>
                        <ul>
                          {section.do.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {section.dont.length ? (
                      <div className="guide-advice is-bad">
                        <strong>{t("guide.badTitle")}</strong>
                        <ul>
                          {section.dont.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state visible guide-empty">
          <h1>{t("guide.emptyTitle")}</h1>
          <p>{t("guide.emptyText")}</p>
        </div>
      )}
    </section>
  );
}
