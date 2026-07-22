<template>
  <div class="login-screen">
    <form class="login-card otp-card" @submit.prevent="app.submitAuth">
      <div class="brand compact">
        <img class="brand-mark" src="/app-icon.svg" alt="" width="42" height="42">
        <div>
          <strong>{{ app.t("auth.totpTitle") }}</strong>
          <span>{{ app.t("auth.totpText") }}</span>
        </div>
      </div>
      <div class="otp-inputs">
        <input
          v-for="(_, index) in app.otpDigits"
          :key="index"
          :ref="(element) => app.setOtpInputRef(element, index)"
          :value="app.otpDigits[index]"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          @input="app.handleOtpInput(index, $event)"
          @keydown="app.handleOtpKeydown(index, $event)"
          @paste="app.handleOtpPaste(index, $event)"
        >
      </div>
      <p v-if="app.authError" class="form-error">{{ app.authError }}</p>
      <button class="primary-button" type="submit">{{ app.t("common.login") }}</button>
      <button class="secondary-button" type="button" @click="app.resetTotpLogin">{{ app.t("auth.backToLogin") }}</button>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    app: { type: Object, required: true }
  }
};
</script>
