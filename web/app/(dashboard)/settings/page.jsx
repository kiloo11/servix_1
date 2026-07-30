"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { BookOpen, Coins, Download, KeyRound, Plus, QrCode, RefreshCw, Save, ScrollText, Send, Settings as SettingsIcon, ShieldCheck, Tag } from "lucide-react";
import AppSelect from "../../../components/ui/AppSelect";
import AppSelectItem from "../../../components/ui/AppSelectItem";
import AppTooltip from "../../../components/ui/AppTooltip";
import CategoryFormModal from "../../../components/settings/CategoryFormModal";
import { useLocale } from "../../../context/LocaleContext";
import { useAuth } from "../../../context/AuthContext";
import { useData } from "../../../context/DataContext";
import { useToast } from "../../../context/ToastContext";
import { useFormat } from "../../../lib/format";
import { useMoney } from "../../../lib/money";
import { useUpdateActions } from "../../../lib/updateActions";
import { CURRENCIES, emptyCategory } from "../../../lib/assets";
import { clone } from "../../../lib/dates";

const LOCALE_OPTIONS = ["ru", "en"];

function buildSettingsDraft(meta) {
  return {
    siteTitle: meta.siteTitle,
    notificationLeads: meta.notificationLeads || "5m,2h,1d,3d,5d",
    locale: meta.locale,
    timezone: meta.timezone || "Europe/Moscow",
    telegramNotifyUrl: meta.telegramNotifyUrl || "",
    notifyOnStart: Boolean(meta.notifyOnStart),
    currency: CURRENCIES.includes(meta.currency) ? meta.currency : "USDT",
  };
}

const EMPTY_TWO_FACTOR = { currentPassword: "", token: "", secret: "", otpauthUrl: "", qrCode: "" };
const EMPTY_PASSWORD_FORM = { currentPassword: "", newPassword: "", passwordRepeat: "" };

// Ported from src/views/SettingsView.vue + App.vue's saveSettings/
// changePassword/startTotpSetup/submitTotp/enableTotp/disableTotp/
// testTelegram/testMonthlyReport/refreshRates.
export default function SettingsPage() {
  const { t, tc } = useLocale();
  const { meta, setMeta, call } = useAuth();
  const { security, update, categories, dataLoaded, loadSecurity } = useData();
  const { formatDateTime, formatShort } = useFormat();
  const { usdRubRate } = useMoney();
  const { updateBusy, checkUpdate, applyUpdate } = useUpdateActions();
  const toast = useToast();

  const [settings, setSettings] = useState(() => buildSettingsDraft(meta));
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [twoFactor, setTwoFactor] = useState(EMPTY_TWO_FACTOR);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  function openCategory(category = null) {
    setEditingCategory(category ? clone(category) : emptyCategory());
    setCategoryModalOpen(true);
  }

  // Ported from App.vue's `load()`, which rebuilds `settings` from `meta`
  // every time — but here that would clobber in-progress edits if it reran
  // on every meta change (e.g. refreshRates() only touching the rate
  // fields), so this initializes the draft exactly once, when DataContext's
  // first load() actually completes.
  useEffect(() => {
    if (dataLoaded) setSettings(buildSettingsDraft(meta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]);

  function setField(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    const next = await call("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
    setMeta(next);
    toast(t("settings.saved"));
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    await call("/api/auth/password", { method: "POST", body: JSON.stringify(passwordForm) });
    setPasswordForm(EMPTY_PASSWORD_FORM);
    toast(t("security.passwordChanged"));
  }

  async function testTelegram(telegramNotifyUrl = settings.telegramNotifyUrl) {
    const result = await call("/api/telegram/test", { method: "POST", body: JSON.stringify({ telegramNotifyUrl }) });
    toast(result.skipped ? t("alerts.testSkipped") : t("alerts.testSent"));
  }

  async function testMonthlyReport() {
    const result = await call("/api/telegram/monthly-report/test", { method: "POST" });
    toast(result.skipped ? t("alerts.testSkipped") : t("alerts.testSent"));
  }

  async function refreshRates() {
    setMeta({ ...meta, ...(await call("/api/rates/refresh", { method: "POST" })) });
    toast(t("settings.ratesRefreshed"));
  }

  async function startTotpSetup() {
    const result = await call("/api/auth/2fa/setup", { method: "POST", body: JSON.stringify({ currentPassword: twoFactor.currentPassword }) });
    const qrCode = await QRCode.toDataURL(result.otpauthUrl, { margin: 1, width: 220, color: { dark: "#071110", light: "#ffffff" } });
    setTwoFactor((current) => ({ ...current, secret: result.secret, otpauthUrl: result.otpauthUrl, qrCode, token: "" }));
    toast(t("security.totpStarted"));
  }

  async function enableTotp() {
    await call("/api/auth/2fa/enable", { method: "POST", body: JSON.stringify({ currentPassword: twoFactor.currentPassword, token: twoFactor.token }) });
    setTwoFactor(EMPTY_TWO_FACTOR);
    await loadSecurity();
    toast(t("security.totpEnabledToast"));
  }

  async function disableTotp() {
    await call("/api/auth/2fa/disable", { method: "POST", body: JSON.stringify({ currentPassword: twoFactor.currentPassword, token: twoFactor.token }) });
    setTwoFactor(EMPTY_TWO_FACTOR);
    await loadSecurity();
    toast(t("security.totpDisabledToast"));
  }

  async function submitTotp(e) {
    e.preventDefault();
    if (security.totpEnabled) return disableTotp();
    if (twoFactor.secret) return enableTotp();
    return startTotpSetup();
  }

  return (
    <section className="view active">
      <div className="section-head">
        <div className="heading-stack">
          <h1>{t("nav.settings")}</h1>
          <span>{t("settings.subtitle")}</span>
        </div>
      </div>

      <div className="settings-stack">
        <form className="settings-panel settings-panel-wide" onSubmit={handleSaveSettings}>
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h2>{t("settings.generalTitle")}</h2>
              <span>{t("settings.generalText")}</span>
            </div>
          </div>
          <label>
            {t("settings.siteTitle")}
            <input type="text" required value={settings.siteTitle} onChange={(e) => setField("siteTitle", e.target.value)} />
          </label>
          <div className="settings-form-grid">
            <label>
              {t("settings.language")}
              <AppSelect value={settings.locale} onChange={(v) => setField("locale", v)} aria-label={t("settings.language")}>
                {LOCALE_OPTIONS.map((code) => (
                  <AppSelectItem key={code} value={code}>
                    {t(`language.${code}`)}
                  </AppSelectItem>
                ))}
              </AppSelect>
            </label>
            <label>
              {t("settings.timezone")}
              <input type="text" placeholder="Europe/Moscow" required value={settings.timezone} onChange={(e) => setField("timezone", e.target.value)} />
            </label>
            <label>
              {t("settings.currency")}
              <AppSelect value={settings.currency} onChange={(v) => setField("currency", v)} aria-label={t("settings.currency")}>
                {CURRENCIES.map((currency) => (
                  <AppSelectItem key={currency} value={currency}>
                    {currency === "USDT" ? "₮" : t(`currency.${currency}`)}
                  </AppSelectItem>
                ))}
              </AppSelect>
            </label>
          </div>
          <label>
            {t("settings.telegramNotifyUrl")}
            <span className="input-with-action">
              <input type="text" placeholder="tgram://token/chat_id:topic" value={settings.telegramNotifyUrl} onChange={(e) => setField("telegramNotifyUrl", e.target.value)} />
              <AppTooltip label={t("settings.testTelegram")} side="left">
                <button className="input-action-button" type="button" aria-label={t("settings.testTelegram")} onClick={() => testTelegram(settings.telegramNotifyUrl)}>
                  <Send size={16} />
                </button>
              </AppTooltip>
            </span>
          </label>
          <label>
            {t("settings.leads")}
            <input type="text" placeholder="5m, 2h, 1d, 3d, 5d" required value={settings.notificationLeads} onChange={(e) => setField("notificationLeads", e.target.value)} />
          </label>
          <div className="settings-inline-footer">
            <label className="check-row">
              <input type="checkbox" checked={settings.notifyOnStart} onChange={(e) => setField("notifyOnStart", e.target.checked)} />
              {t("settings.notifyOnStart")}
            </label>
            <button className="primary-button" type="submit">
              <Save size={18} />
              {t("common.save")}
            </button>
          </div>
          <p className="hint">{t("settings.leadsHint")}</p>
          <div className="settings-inline-footer">
            <p className="hint">{t("settings.monthlyReportHint")}</p>
            <button className="secondary-button" type="button" onClick={testMonthlyReport}>
              <Send size={16} />
              {t("settings.testMonthlyReport")}
            </button>
          </div>
        </form>

        <div className="settings-panel">
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <Download size={18} />
            </div>
            <div>
              <h2>{t("update.title")}</h2>
              <span>{t("update.text")}</span>
            </div>
          </div>
          <div className="rate-display-grid">
            <div>
              <span>{t("update.current")}</span>
              <strong>v{update.version || meta.version || "—"}</strong>
            </div>
            <div>
              <span>{t("update.latest")}</span>
              <strong>{update.latest ? `v${update.latest}` : "—"}</strong>
            </div>
            <div>
              <span>{t("update.checked")}</span>
              <strong>{update.checkedAt ? formatDateTime(update.checkedAt) : t("update.never")}</strong>
            </div>
          </div>
          {update.error ? (
            <p className="hint">{t("update.checkFailed", { error: update.error })}</p>
          ) : update.updateAvailable ? (
            <p className="hint">
              {t("update.availableToast", { version: update.latest })}{" "}
              <a href={update.releaseUrl} target="_blank" rel="noreferrer">
                {t("update.releaseLink")}
              </a>
            </p>
          ) : (
            <p className="hint">{t("update.upToDate")}</p>
          )}
          {!update.canApply ? <p className="hint">{t("update.dockerMissing")}</p> : null}
          {update.apply?.log?.length ? (
            <ul className="update-log">
              {update.apply.log.map((entry) => (
                <li key={entry.at + entry.message}>
                  {formatDateTime(entry.at)} — {entry.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="settings-inline-footer">
            <span className="hint">{t("update.repo", { repo: update.repo || "—" })}</span>
            <div className="export-actions">
              <button className="secondary-button" type="button" disabled={updateBusy} onClick={checkUpdate}>
                <RefreshCw size={16} />
                {t("update.check")}
              </button>
              <button className="primary-button" type="button" disabled={updateBusy || !update.canApply || !update.updateAvailable || update.apply?.status === "running"} onClick={applyUpdate}>
                <Download size={18} />
                {t("update.apply")}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-panel">
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

        <div className="settings-panel">
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <Tag size={18} />
            </div>
            <div>
              <h2>{t("categories.manageTitle")}</h2>
              <span>{t("categories.manageText")}</span>
            </div>
          </div>
          {categories.length ? (
            <div className="category-manage-list">
              {categories.map((category) => (
                <button key={category.id} className="category-manage-chip" type="button" onClick={() => openCategory(category)} style={{ "--category-color": category.color }}>
                  <span className="category-manage-dot" />
                  {category.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">{t("categories.empty")}</p>
          )}
          <div className="settings-inline-footer">
            <span className="hint">{tc("piece", categories.length)}</span>
            <button className="secondary-button" type="button" onClick={() => openCategory()}>
              <Plus size={16} />
              {t("categories.add")}
            </button>
          </div>
        </div>

        <div className="settings-panel">
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <ScrollText size={18} />
            </div>
            <div>
              <h2>{t("settings.pagesTitle")}</h2>
              <span>{t("settings.pagesText")}</span>
            </div>
          </div>
          <div className="settings-links-list">
            <Link href="/logs" className="settings-link-row">
              <ScrollText size={18} />
              <span>{t("nav.logs")}</span>
            </Link>
            <Link href="/guide" className="settings-link-row">
              <BookOpen size={18} />
              <span>{t("nav.guide")}</span>
            </Link>
          </div>
        </div>

        <form className="settings-panel" onSubmit={handleChangePassword}>
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <KeyRound size={18} />
            </div>
            <div>
              <h2>{t("security.passwordTitle")}</h2>
              <span>{t("security.passwordText")}</span>
            </div>
          </div>
          <label>
            {t("security.currentPassword")}
            <input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, currentPassword: e.target.value }))} />
          </label>
          <label>
            {t("security.newPassword")}
            <input type="password" autoComplete="new-password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm((c) => ({ ...c, newPassword: e.target.value }))} />
          </label>
          <label>
            {t("security.repeatPassword")}
            <input type="password" autoComplete="new-password" required value={passwordForm.passwordRepeat} onChange={(e) => setPasswordForm((c) => ({ ...c, passwordRepeat: e.target.value }))} />
          </label>
          <button className="primary-button" type="submit">
            <Save size={18} />
            {t("security.changePassword")}
          </button>
        </form>

        <form className="settings-panel" onSubmit={submitTotp}>
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2>{t("security.totpTitle")}</h2>
              <span>{security.totpEnabled ? t("security.totpEnabledShort") : t("security.totpDisabledShort")}</span>
            </div>
          </div>
          <p className="hint">{security.totpEnabled ? t("security.totpEnabled") : t("security.totpDisabled")}</p>
          <label>
            {t("security.currentPassword")}
            <input type="password" autoComplete="current-password" required value={twoFactor.currentPassword} onChange={(e) => setTwoFactor((c) => ({ ...c, currentPassword: e.target.value }))} />
          </label>
          {!security.totpEnabled && twoFactor.secret ? (
            <>
              <div className="totp-setup-grid">
                <div className="totp-qr-card">
                  {twoFactor.qrCode ? <img src={twoFactor.qrCode} alt={t("security.qrCode")} /> : <QrCode size={54} />}
                  <span>{t("security.qrCode")}</span>
                </div>
                <div className="totp-secret-fields">
                  <label>
                    {t("security.totpSecret")}
                    <input value={twoFactor.secret} type="text" readOnly />
                  </label>
                  <label>
                    {t("security.totpUri")}
                    <textarea value={twoFactor.otpauthUrl} rows={3} readOnly />
                  </label>
                </div>
              </div>
              <label>
                {t("security.totpCode")}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={twoFactor.token}
                  onChange={(e) => setTwoFactor((c) => ({ ...c, token: e.target.value }))}
                />
              </label>
              <button className="primary-button" type="submit">
                <Save size={18} />
                {t("security.enableTotp")}
              </button>
            </>
          ) : security.totpEnabled ? (
            <>
              <label>
                {t("security.totpCode")}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={twoFactor.token}
                  onChange={(e) => setTwoFactor((c) => ({ ...c, token: e.target.value }))}
                />
              </label>
              <button className="danger-button" type="submit">
                {t("security.disableTotp")}
              </button>
            </>
          ) : (
            <button className="primary-button" type="submit">
              {t("security.startTotp")}
            </button>
          )}
        </form>
      </div>

      <CategoryFormModal open={categoryModalOpen} onOpenChange={setCategoryModalOpen} category={editingCategory} />
    </section>
  );
}
