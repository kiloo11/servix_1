"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftOpen } from "lucide-react";
import Sidebar from "../../components/layout/Sidebar";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";
import { withTrailingSlash } from "../../lib/navigate";

export default function DashboardLayout({ children }) {
  const { bootstrapped, authed, meta } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Read the persisted collapse state client-side only (after mount), rather
  // than in a lazy useState initializer, to avoid a hydration mismatch
  // against the server-prerendered "expanded" markup.
  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem("sidebarCollapsed") === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    if (bootstrapped && !authed) router.replace(withTrailingSlash("/login"));
  }, [bootstrapped, authed, router]);

  if (!bootstrapped) return <div className="boot-screen" />;
  if (!authed) return null;

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <button
        className="mobile-menu-button"
        type="button"
        aria-label={mobileNavOpen ? t("nav.collapseMenu") : t("nav.expandMenu")}
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        <PanelLeftOpen size={16} />
        <img className="mobile-menu-logo" src="/app-icon.svg" alt="" width={32} height={32} />
        <span>{meta.siteTitle}</span>
      </button>
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <main className="content">
        <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
