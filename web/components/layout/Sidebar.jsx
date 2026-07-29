"use client";

import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, Separator } from "radix-ui";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronsUpDown,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings,
  Wallet,
} from "lucide-react";
import AppTooltip from "../ui/AppTooltip";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useLocale } from "../../context/LocaleContext";
import { useMoney } from "../../lib/money";
import { useMediaQuery } from "../../lib/useMediaQuery";

// Ported from App.vue's <aside class="sidebar">, redesigned: nav no longer
// force-stretches to fill the viewport (it used flex:1 to pin the summary/
// logout footer to the bottom, which left a huge dead gap on tall screens
// with only 8 nav items) — instead the summary sits right under nav, and a
// single spacer + Radix DropdownMenu-based account menu (replacing the old
// two separate logout/version buttons) is what's pinned to the bottom.
// Logs and Guide moved out of primary nav into a panel on the Settings page
// — they're administrative/reference pages, not everyday navigation.
const NAV_ITEMS = [
  { path: "/", labelKey: "nav.assets", icon: Server },
  { path: "/providers", labelKey: "nav.providers", icon: Building2 },
  { path: "/stats", labelKey: "nav.stats", icon: BarChart3 },
  { path: "/pnl", labelKey: "nav.pnl", icon: Wallet },
  { path: "/alerts", labelKey: "nav.alerts", icon: Bell },
  { path: "/ads", labelKey: "nav.ads", icon: Megaphone },
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { t } = useLocale();
  const { meta, logout } = useAuth();
  const { providers, assets, alerts, update, security } = useData();
  const { formatPaymentTotal } = useMoney();
  const router = useRouter();
  const pathname = usePathname();
  // The icon-only collapsed sidebar (and its tooltips) is a desktop-only
  // concept — `collapsed` itself is a persisted preference that outlives
  // whatever viewport it was set on, so it can't be used alone to decide
  // whether tooltips should be active right now.
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const showCollapsedUi = collapsed && isDesktop;

  function countByType(type) {
    return assets.filter((asset) => asset.type === type).length;
  }

  const allPayments = assets.flatMap((asset) => asset.payments || []);
  const accountInitial = (security.login || "?").slice(0, 1).toUpperCase();
  const versionLabel = `v${update.version || meta.version || "—"}`;

  function go(path) {
    router.push(path);
    onCloseMobile();
  }

  return (
    <>
      {mobileOpen ? <div className="sidebar-backdrop" onClick={onCloseMobile} /> : null}
      <aside className={`sidebar${mobileOpen ? " open" : ""}`}>
        <div className="brand">
          <img className="brand-mark" src="/app-icon.svg" alt="" width={42} height={42} />
          <div className="brand-text">
            <strong>{meta.siteTitle}</strong>
            <span>{t("logo.subtitle")}</span>
          </div>
          {!collapsed ? (
            <AppTooltip label={t("nav.collapseMenu")} side="right">
              <button className="icon-button sidebar-collapse" type="button" aria-label={t("nav.collapseMenu")} onClick={onToggleCollapse}>
                <PanelLeftClose size={18} />
              </button>
            </AppTooltip>
          ) : null}
        </div>
        {collapsed ? (
          <AppTooltip label={t("nav.expandMenu")} side="right">
            <button className="sidebar-expand-trigger" type="button" aria-label={t("nav.expandMenu")} onClick={onToggleCollapse}>
              <PanelLeftOpen size={16} />
            </button>
          </AppTooltip>
        ) : null}

        <Separator.Root className="sidebar-separator" decorative />

        <nav className="nav-tabs" aria-label={t("nav.assets")}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path;
            const Icon = item.icon;
            return (
              <AppTooltip key={item.path} label={showCollapsedUi ? t(item.labelKey) : ""} side="right">
                <button
                  className={`nav-button${active ? " active" : ""}`}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => go(item.path)}
                >
                  <span className="nav-icon">
                    <Icon size={18} />
                  </span>
                  <span className="nav-label">{t(item.labelKey)}</span>
                  {item.path === "/alerts" && alerts.length ? <span className="nav-badge">{alerts.length}</span> : null}
                </button>
              </AppTooltip>
            );
          })}
        </nav>

        <Separator.Root className="sidebar-separator" decorative />

        <div className="summary-card">
          <div className="summary">
            <div>
              <span>{t("summary.servers")}</span>
              <strong>{countByType("vps")}</strong>
            </div>
            <div>
              <span>{t("summary.domains")}</span>
              <strong>{countByType("domain")}</strong>
            </div>
            <div>
              <span>{t("summary.providers")}</span>
              <strong>{providers.length}</strong>
            </div>
            <div className="summary-wide">
              <span>{t("summary.paid")}</span>
              <strong>{formatPaymentTotal(allPayments)}</strong>
            </div>
            <div className="summary-wide">
              <span>{t("summary.terms")}</span>
              <strong>{alerts.length}</strong>
            </div>
          </div>
        </div>

        <div className="sidebar-spacer" />

        <Separator.Root className="sidebar-separator" decorative />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="sidebar-account-trigger" type="button">
              <span className="sidebar-account-avatar">{accountInitial}</span>
              <span className="sidebar-account-text">
                <strong>{security.login || t("common.login")}</strong>
                <span>
                  {versionLabel}
                  {update.updateAvailable ? <span className="sidebar-version-dot" /> : null}
                </span>
              </span>
              <ChevronsUpDown size={15} className="sidebar-account-chevron" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="sidebar-account-menu" side="top" align="start" sideOffset={8}>
              <DropdownMenu.Item className="sidebar-account-menu-item" onSelect={() => go("/settings")}>
                <Settings size={16} />
                {t("nav.settings")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="sidebar-account-menu-sep" />
              <DropdownMenu.Item className="sidebar-account-menu-item is-danger" onSelect={logout}>
                <LogOut size={16} />
                {t("common.logout")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </aside>
    </>
  );
}
