"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, Separator } from "radix-ui";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Bell,
  Building2,
  ChevronsUpDown,
  Coins,
  Globe,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Server,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import AppTooltip from "../ui/AppTooltip";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useLocale } from "../../context/LocaleContext";
import { useFormat } from "../../lib/format";
import { useMoney } from "../../lib/money";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { withTrailingSlash } from "../../lib/navigate";

// Redesigned: nav no longer force-stretches to fill the viewport (the old
// layout used flex:1 to pin the summary/logout footer to the bottom, which
// left a huge dead gap on tall screens with only 8 nav items) — instead the
// summary sits right under nav, and a
// single spacer + Radix DropdownMenu-based account menu (replacing the old
// two separate logout/version buttons) is what's pinned to the bottom.
// Logs and Guide moved out of primary nav into a panel on the Settings page
// — they're administrative/reference pages, not everyday navigation.
const NAV_ITEMS = [
  { path: "/", labelKey: "nav.finance", icon: Wallet },
  { path: "/assets", labelKey: "nav.assets", icon: Server },
  { path: "/ads", labelKey: "nav.ads", icon: Megaphone },
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { t } = useLocale();
  const { meta, setMeta, logout, call } = useAuth();
  const [ratesRefreshing, setRatesRefreshing] = useState(false);
  const { providers, assets, alerts, security, botRevenue, botRevenueMonthly } = useData();
  const { formatMoney, convertAmount, paymentsTotalIn, usdRubRate } = useMoney();
  const { formatShort } = useFormat();
  const router = useRouter();
  // Production is a static export with trailingSlash:true, so the real
  // pathname there is e.g. "/assets/" — only "/" happens to match either
  // way, which is why plain `pathname === item.path` only ever highlighted
  // Финансы. Strip any trailing slash before comparing against NAV_ITEMS'
  // slash-less paths.
  const pathname = usePathname().replace(/\/$/, "") || "/";
  // The icon-only collapsed sidebar (and its tooltips) is a desktop-only
  // concept — `collapsed` itself is a persisted preference that outlives
  // whatever viewport it was set on, so it can't be used alone to decide
  // whether tooltips should be active right now.
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const showCollapsedUi = collapsed && isDesktop;

  function countByType(type) {
    return assets.filter((asset) => asset.type === type).length;
  }

  const currency = meta.currency || "USDT";
  const allPayments = assets.flatMap((asset) => asset.payments || []);

  // Calendar-month buckets (not a rolling 30-day window) — matches how
  // bot_revenue_monthly is already keyed server-side, so "this month" for
  // paid and for revenue line up on the same boundary.
  function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  const now = new Date();
  const currentMonthKey = monthKeyOf(now);
  const previousMonthKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  function paidInMonth(monthKey) {
    return paymentsTotalIn(
      allPayments.filter((payment) => String(payment.paidAt || "").slice(0, 7) === monthKey),
      currency
    );
  }
  function revenueInMonth(monthKey) {
    const row = botRevenueMonthly.find((item) => item.month === monthKey);
    return convertAmount(row?.totalRub || 0, "RUB", currency);
  }

  const monthPaid = paidInMonth(currentMonthKey);
  const previousMonthPaid = paidInMonth(previousMonthKey);
  const monthRevenue = revenueInMonth(currentMonthKey);
  const previousMonthRevenue = revenueInMonth(previousMonthKey);
  const monthProfit = monthRevenue - monthPaid;
  const previousMonthProfit = previousMonthRevenue - previousMonthPaid;

  // Arrow direction always follows the raw delta (up = value increased).
  // Color follows whether that direction is actually good for the metric —
  // `invert` flips it for cost-like metrics (e.g. "Уплачено"), where rising
  // is bad, so it renders red despite the up arrow.
  function TrendTag({ current, previous, invert = false }) {
    // A zero previous-month base makes "% change" undefined (division by
    // zero) rather than just a big number — skip the tag entirely instead
    // of showing a misleading e.g. "+100%".
    if (!previous) return null;
    const delta = current - previous;
    if (Math.abs(delta) < 0.005) return <span className="trend-tag trend-flat">{t("summary.trendFlat")}</span>;
    const percent = (delta / Math.abs(previous)) * 100;
    const up = delta > 0;
    const good = invert ? !up : up;
    const Icon = up ? ArrowUp : ArrowDown;
    return (
      <span className={`trend-tag ${good ? "trend-good" : "trend-bad"}`}>
        <Icon size={11} />
        {Math.abs(percent).toFixed(1)}%
      </span>
    );
  }

  const accountInitial = (security.login || "?").slice(0, 1).toUpperCase();
  const versionLabel = `v${meta.version || "—"}`;

  function go(path) {
    router.push(withTrailingSlash(path));
    onCloseMobile();
  }

  // Same request Settings' own "Обновить курсы" button makes — a compact
  // duplicate here since re-checking rates is exactly what this card is for.
  async function refreshRates() {
    setRatesRefreshing(true);
    try {
      setMeta({ ...meta, ...(await call("/api/rates/refresh", { method: "POST" })) });
    } finally {
      setRatesRefreshing(false);
    }
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

        <nav className="nav-tabs alerts-section" aria-label={t("nav.alerts")}>
          <AppTooltip label={showCollapsedUi ? t("nav.alerts") : ""} side="right">
            <button
              className={`nav-button${pathname === "/alerts" ? " active" : ""}`}
              type="button"
              aria-current={pathname === "/alerts" ? "page" : undefined}
              onClick={() => go("/alerts")}
            >
              <span className="nav-icon">
                <Bell size={18} />
              </span>
              <span className="nav-label">{t("nav.alerts")}</span>
              {alerts.length ? <span className="nav-badge">{alerts.length}</span> : null}
            </button>
          </AppTooltip>
        </nav>

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
                </button>
              </AppTooltip>
            );
          })}
        </nav>

        <Separator.Root className="sidebar-separator" decorative />

        <div className="summary-stack">
          <div className="summary-card">
            <span className="summary-heading">{t("summary.resourcesHeading")}</span>
            <div className="summary-inline">
              <span className="summary-inline-item" title={t("summary.servers")}>
                <Server size={14} />
                <strong>{countByType("vps")}</strong>
              </span>
              <span className="summary-inline-item" title={t("summary.domains")}>
                <Globe size={14} />
                <strong>{countByType("domain")}</strong>
              </span>
              <span className="summary-inline-item" title={t("summary.providers")}>
                <Building2 size={14} />
                <strong>{providers.length}</strong>
              </span>
            </div>
          </div>

          <button type="button" className="summary-card summary-card-link" onClick={() => go("/#overview")}>
            <span className="summary-heading">{t("summary.financeHeading")}</span>
            <div className="summary">
              <div className="summary-row">
                <span className="summary-label">
                  <Wallet size={13} />
                  <span className="summary-label-text">{t("summary.paid")}</span>
                </span>
                <span className="summary-value">
                  <strong>{formatMoney(monthPaid, currency)}</strong>
                  <TrendTag current={monthPaid} previous={previousMonthPaid} invert />
                </span>
              </div>
              {botRevenue.configured ? (
                <>
                  <div className="summary-row">
                    <span className="summary-label">
                      <TrendingUp size={13} />
                      <span className="summary-label-text">{t("summary.revenue")}</span>
                    </span>
                    <span className="summary-value">
                      <strong>{formatMoney(monthRevenue, currency)}</strong>
                      <TrendTag current={monthRevenue} previous={previousMonthRevenue} />
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">
                      <Coins size={13} />
                      <span className="summary-label-text">{t("summary.profit")}</span>
                    </span>
                    <span className="summary-value">
                      <strong>{formatMoney(monthProfit, currency)}</strong>
                      <TrendTag current={monthProfit} previous={previousMonthProfit} />
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </button>

          <div className="summary-card">
            <div className="summary-heading-row">
              <span className="summary-heading">{t("summary.ratesHeading")}</span>
              <AppTooltip label={t("settings.refreshRates")}>
                <button
                  className="summary-refresh-button"
                  type="button"
                  onClick={refreshRates}
                  disabled={ratesRefreshing}
                  aria-label={t("settings.refreshRates")}
                >
                  <RefreshCw size={13} />
                </button>
              </AppTooltip>
            </div>
            <div className="summary">
              <div className="summary-row">
                <span className="summary-label">
                  <ArrowLeftRight size={13} />
                  <span className="summary-label-text">{t("settings.rateRubPerEur")}</span>
                </span>
                <strong>{formatShort(meta.rateRubPerEur)} ₽</strong>
              </div>
              <div className="summary-row">
                <span className="summary-label">
                  <ArrowLeftRight size={13} />
                  <span className="summary-label-text">{t("settings.rateUsdRub")}</span>
                </span>
                <strong>{formatShort(usdRubRate())} ₽</strong>
              </div>
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
                <span>{versionLabel}</span>
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
