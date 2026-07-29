"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";

// Ported from src/views/auth/{login,create,2fa}.vue — one route reproducing
// the same 3-state branch App.vue used to do at the root (setupRequired /
// authRequiresTotp / plain login), since all three post through the same
// submitAuth() flow and only differ in which fields they collect.
export default function LoginPage() {
  const { bootstrapped, authed, setupRequired, authRequiresTotp, authError, meta, submitAuth, resetTotpLogin } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");

  useEffect(() => {
    if (bootstrapped && authed) router.replace("/");
  }, [bootstrapped, authed, router]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await submitAuth({ login, password, passwordRepeat });
    },
    [submitAuth, login, password, passwordRepeat]
  );

  if (!bootstrapped || authed) return null;

  return (
    <div className="login-screen">
      {authRequiresTotp ? (
        <TotpForm
          authError={authError}
          onBack={() => resetTotpLogin()}
          submitAuth={(token) => submitAuth({ login, password, passwordRepeat, token })}
        />
      ) : (
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="brand compact">
            <img className="brand-mark" src="/app-icon.svg" alt="" width={42} height={42} />
            <div>
              <strong>{meta.siteTitle}</strong>
              <span>{setupRequired ? t("auth.createUser") : t("auth.title")}</span>
            </div>
          </div>
          <label>
            {t("auth.login")}
            <input type="text" autoComplete="username" required autoFocus value={login} onChange={(e) => setLogin(e.target.value)} />
          </label>
          <label>
            {t("auth.password")}
            <input
              type="password"
              autoComplete={setupRequired ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {setupRequired ? (
            <label>
              {t("auth.passwordRepeat")}
              <input type="password" autoComplete="new-password" required value={passwordRepeat} onChange={(e) => setPasswordRepeat(e.target.value)} />
            </label>
          ) : null}
          {authError ? <p className="form-error">{authError}</p> : null}
          <button className="primary-button" type="submit">
            {setupRequired ? t("auth.createUser") : t("common.login")}
          </button>
        </form>
      )}
    </div>
  );
}

function TotpForm({ authError, onBack, submitAuth }) {
  const { t } = useLocale();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  const focusOtp = useCallback((index) => {
    inputRefs.current[Math.max(0, Math.min(5, index))]?.focus();
  }, []);

  useEffect(() => {
    focusOtp(0);
  }, [focusOtp]);

  const fillOtp = useCallback(
    (value, startIndex = 0) => {
      const chars = String(value || "")
        .replace(/\D/g, "")
        .slice(0, 6 - startIndex)
        .split("");
      setDigits((current) => {
        const next = [...current];
        chars.forEach((digit, offset) => {
          next[startIndex + offset] = digit;
        });
        if (next.every(Boolean)) submitAuth(next.join(""));
        return next;
      });
      const next = Math.min(5, startIndex + chars.length);
      requestAnimationFrame(() => focusOtp(next));
    },
    [focusOtp, submitAuth]
  );

  function handleInput(index, event) {
    const value = String(event.target.value || "").replace(/\D/g, "");
    if (value.length > 1) return fillOtp(value, index);
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      if (value && index < 5) requestAnimationFrame(() => focusOtp(index + 1));
      if (next.every(Boolean)) submitAuth(next.join(""));
      return next;
    });
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
      requestAnimationFrame(() => focusOtp(index - 1));
    }
    if (event.key === "ArrowLeft" && index > 0) focusOtp(index - 1);
    if (event.key === "ArrowRight" && index < 5) focusOtp(index + 1);
  }

  function handlePaste(index, event) {
    event.preventDefault();
    const value = event.clipboardData?.getData("text") || "";
    const cleaned = String(value || "").replace(/\D/g, "");
    fillOtp(cleaned, cleaned.length >= 6 ? 0 : index);
  }

  return (
    <form className="login-card otp-card" onSubmit={(e) => e.preventDefault()}>
      <div className="brand compact">
        <img className="brand-mark" src="/app-icon.svg" alt="" width={42} height={42} />
        <div>
          <strong>{t("auth.totpTitle")}</strong>
          <span>{t("auth.totpText")}</span>
        </div>
      </div>
      <div className="otp-inputs">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            value={digit}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(e) => handleInput(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
          />
        ))}
      </div>
      {authError ? <p className="form-error">{authError}</p> : null}
      <button className="primary-button" type="submit" onClick={() => submitAuth(digits.join(""))}>
        {t("common.login")}
      </button>
      <button className="secondary-button" type="button" onClick={onBack}>
        {t("auth.backToLogin")}
      </button>
    </form>
  );
}
