<template>
  <section class="view active">
    <div class="section-head">
      <div>
        <h1>{{ app.t("nav.settings") }}</h1>
        <span>{{ app.t("settings.subtitle") }}</span>
      </div>
    </div>
    <div class="settings-stack">
      <form class="settings-panel settings-panel-wide" @submit.prevent="app.saveSettings">
        <div class="settings-card-head">
          <div class="settings-card-icon"><SettingsIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("settings.generalTitle") }}</h2>
            <span>{{ app.t("settings.generalText") }}</span>
          </div>
        </div>
        <label>{{ app.t("settings.siteTitle") }}<input v-model="app.settings.siteTitle" type="text" required></label>
        <div class="settings-form-grid">
          <label>{{ app.t("settings.language") }}
            <AppSelect v-model="app.settings.locale" :aria-label="app.t('settings.language')">
              <AppSelectItem v-for="locale in app.localeOptions" :key="locale" :value="locale">{{ app.t(`language.${locale}`) }}</AppSelectItem>
            </AppSelect>
          </label>
          <label>{{ app.t("settings.timezone") }}<input v-model="app.settings.timezone" type="text" placeholder="Europe/Moscow" required></label>
          <label>{{ app.t("settings.currency") }}
            <AppSelect v-model="app.settings.currency" :aria-label="app.t('settings.currency')">
              <AppSelectItem v-for="currency in app.currencyOptions" :key="currency" :value="currency">{{ currency === "USDT" ? "USDT" : app.t(`currency.${currency}`) }}</AppSelectItem>
            </AppSelect>
          </label>
        </div>
        <label>{{ app.t("settings.telegramNotifyUrl") }}
          <span class="input-with-action">
            <input v-model="app.settings.telegramNotifyUrl" type="text" placeholder="tgram://token/chat_id:topic">
            <AppTooltip :label="app.t('settings.testTelegram')" side="left">
              <button class="input-action-button" type="button" :aria-label="app.t('settings.testTelegram')" @click="app.testTelegram(app.settings.telegramNotifyUrl)">
                <SendIcon :size="16" />
              </button>
            </AppTooltip>
          </span>
        </label>
        <label>{{ app.t("settings.leads") }}<input v-model="app.settings.notificationLeads" type="text" placeholder="5m, 2h, 1d, 3d, 5d" required></label>
        <div class="settings-inline-footer">
          <label class="check-row"><input v-model="app.settings.notifyOnStart" type="checkbox">{{ app.t("settings.notifyOnStart") }}</label>
          <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("common.save") }}</button>
        </div>
        <p class="hint">{{ app.t("settings.leadsHint") }}</p>
        <div class="settings-inline-footer">
          <p class="hint">{{ app.t("settings.monthlyReportHint") }}</p>
          <button class="secondary-button" type="button" @click="app.testMonthlyReport"><SendIcon :size="16" />{{ app.t("settings.testMonthlyReport") }}</button>
        </div>
      </form>

      <div class="settings-panel">
        <div class="settings-card-head">
          <div class="settings-card-icon"><DownloadIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("update.title") }}</h2>
            <span>{{ app.t("update.text") }}</span>
          </div>
        </div>
        <div class="rate-display-grid">
          <div><span>{{ app.t("update.current") }}</span><strong>v{{ app.update.version || app.meta.version || "—" }}</strong></div>
          <div><span>{{ app.t("update.latest") }}</span><strong>{{ app.update.latest ? `v${app.update.latest}` : "—" }}</strong></div>
          <div><span>{{ app.t("update.checked") }}</span><strong>{{ app.update.checkedAt ? app.formatDateTime(app.update.checkedAt) : app.t("update.never") }}</strong></div>
        </div>
        <p v-if="app.update.error" class="hint">{{ app.t("update.checkFailed", { error: app.update.error }) }}</p>
        <p v-else-if="app.update.updateAvailable" class="hint">
          {{ app.t("update.availableToast", { version: app.update.latest }) }}
          <a :href="app.update.releaseUrl" target="_blank" rel="noreferrer">{{ app.t("update.releaseLink") }}</a>
        </p>
        <p v-else class="hint">{{ app.t("update.upToDate") }}</p>
        <p v-if="!app.update.canApply" class="hint">{{ app.t("update.dockerMissing") }}</p>
        <ul v-if="app.update.apply && app.update.apply.log && app.update.apply.log.length" class="update-log">
          <li v-for="entry in app.update.apply.log" :key="entry.at + entry.message">{{ app.formatDateTime(entry.at) }} — {{ entry.message }}</li>
        </ul>
        <div class="settings-inline-footer">
          <span class="hint">{{ app.t("update.repo", { repo: app.update.repo || "—" }) }}</span>
          <div class="export-actions">
            <button class="secondary-button" type="button" :disabled="app.updateBusy" @click="app.checkUpdate"><RefreshCwIcon :size="16" />{{ app.t("update.check") }}</button>
            <button class="primary-button" type="button" :disabled="app.updateBusy || !app.update.canApply || !app.update.updateAvailable || app.update.apply.status === 'running'" @click="app.applyUpdate"><DownloadIcon :size="18" />{{ app.t("update.apply") }}</button>
          </div>
        </div>
      </div>

      <div class="settings-panel">
        <div class="settings-card-head">
          <div class="settings-card-icon"><CoinsIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("settings.ratesTitle") }}</h2>
            <span>{{ app.t("settings.ratesText") }}</span>
          </div>
        </div>
        <div class="rate-display-grid">
          <div><span>{{ app.t("settings.rateRubPerEur") }}</span><strong>{{ app.formatShort(app.meta.rateRubPerEur) }} RUB</strong></div>
          <div><span>{{ app.t("settings.rateUsdtPerEur") }}</span><strong>{{ app.formatShort(app.meta.rateUsdtPerEur) }} USDT</strong></div>
          <div><span>{{ app.t("settings.rateUsdRub") }}</span><strong>{{ app.formatShort(app.usdRubRate()) }} RUB</strong></div>
        </div>
        <div class="settings-inline-footer">
          <span class="hint">{{ app.meta.rateUpdatedAt ? app.t("settings.ratesUpdated", { value: app.formatDateTime(app.meta.rateUpdatedAt) }) : app.t("settings.ratesNever") }}</span>
          <button class="secondary-button" type="button" @click="app.refreshRates"><RefreshCwIcon :size="16" />{{ app.t("settings.refreshRates") }}</button>
        </div>
      </div>

      <form class="settings-panel" @submit.prevent="app.changePassword">
        <div class="settings-card-head">
          <div class="settings-card-icon"><KeyRoundIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("security.passwordTitle") }}</h2>
            <span>{{ app.t("security.passwordText") }}</span>
          </div>
        </div>
        <label>{{ app.t("security.currentPassword") }}<input v-model="app.passwordForm.currentPassword" type="password" autocomplete="current-password" required></label>
        <label>{{ app.t("security.newPassword") }}<input v-model="app.passwordForm.newPassword" type="password" autocomplete="new-password" required></label>
        <label>{{ app.t("security.repeatPassword") }}<input v-model="app.passwordForm.passwordRepeat" type="password" autocomplete="new-password" required></label>
        <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("security.changePassword") }}</button>
      </form>

      <form class="settings-panel" @submit.prevent="app.submitTotp">
        <div class="settings-card-head">
          <div class="settings-card-icon"><ShieldCheckIcon :size="18" /></div>
          <div>
            <h2>{{ app.t("security.totpTitle") }}</h2>
            <span>{{ app.security.totpEnabled ? app.t("security.totpEnabledShort") : app.t("security.totpDisabledShort") }}</span>
          </div>
        </div>
        <p class="hint">{{ app.security.totpEnabled ? app.t("security.totpEnabled") : app.t("security.totpDisabled") }}</p>
        <label>{{ app.t("security.currentPassword") }}<input v-model="app.twoFactor.currentPassword" type="password" autocomplete="current-password" required></label>
        <template v-if="!app.security.totpEnabled && app.twoFactor.secret">
          <div class="totp-setup-grid">
            <div class="totp-qr-card">
              <img v-if="app.twoFactor.qrCode" :src="app.twoFactor.qrCode" :alt="app.t('security.qrCode')">
              <QrCodeIcon v-else :size="54" />
              <span>{{ app.t("security.qrCode") }}</span>
            </div>
            <div class="totp-secret-fields">
              <label>{{ app.t("security.totpSecret") }}<input :value="app.twoFactor.secret" type="text" readonly></label>
              <label>{{ app.t("security.totpUri") }}<textarea :value="app.twoFactor.otpauthUrl" rows="3" readonly></textarea></label>
            </div>
          </div>
          <label>{{ app.t("security.totpCode") }}<input v-model="app.twoFactor.token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></label>
          <button class="primary-button" type="submit"><SaveIcon :size="18" />{{ app.t("security.enableTotp") }}</button>
        </template>
        <template v-else-if="app.security.totpEnabled">
          <label>{{ app.t("security.totpCode") }}<input v-model="app.twoFactor.token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required></label>
          <button class="danger-button" type="submit">{{ app.t("security.disableTotp") }}</button>
        </template>
        <button v-else class="primary-button" type="submit">{{ app.t("security.startTotp") }}</button>
      </form>
    </div>
  </section>
</template>

<script>
import { Coins as CoinsIcon, Download as DownloadIcon, KeyRound as KeyRoundIcon, QrCode as QrCodeIcon, RefreshCw as RefreshCwIcon, Save as SaveIcon, Send as SendIcon, Settings as SettingsIcon, ShieldCheck as ShieldCheckIcon } from "@lucide/vue";
import AppSelect from "../components/AppSelect.vue";
import AppSelectItem from "../components/AppSelectItem.vue";
import AppTooltip from "../components/AppTooltip.vue";

export default {
  components: { AppSelect, AppSelectItem, AppTooltip, CoinsIcon, DownloadIcon, KeyRoundIcon, QrCodeIcon, RefreshCwIcon, SaveIcon, SendIcon, SettingsIcon, ShieldCheckIcon },
  props: {
    app: { type: Object, required: true }
  }
};
</script>
