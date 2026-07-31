"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useLocale } from "./LocaleContext";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

const DEFAULT_META = {
  siteTitle: "SERVIX",
  notificationLeads: "5m,2h,1d,3d,5d",
  locale: "ru",
  timezone: "Europe/Moscow",
  telegramNotifyUrl: "",
  notifyOnStart: true,
  telegramConfigured: false,
  currency: "USDT",
  rateRubPerEur: 100,
  rateUsdtPerEur: 1.08,
  rateUpdatedAt: "",
};

export function AuthProvider({ children }) {
  const { t, setLocale } = useLocale();
  const toast = useToast();

  const [bootstrapped, setBootstrapped] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [authRequiresTotp, setAuthRequiresTotp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [meta, setMeta] = useState(DEFAULT_META);

  const call = useCallback((path, options) => api(path, options, t), [t]);

  // Bootstrap sequence: fetch auth status, decide which of
  // setup/login/2FA/dashboard to show. Data loading (assets/providers/
  // security/update) is triggered from DataContext once `authed` flips true,
  // not here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const auth = await call("/api/auth/status");
        if (cancelled) return;
        if (auth.meta) {
          setMeta((current) => ({ ...current, ...auth.meta }));
          setLocale(auth.meta.locale);
          document.title = auth.meta.siteTitle;
        }
        setSetupRequired(Boolean(auth.setupRequired));
        setNeedsLogin(Boolean(auth.setupRequired) || !auth.authenticated);
      } catch {
        if (!cancelled) setNeedsLogin(true);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAuth = useCallback(
    async (payload) => {
      try {
        const path = setupRequired ? "/api/auth/setup" : "/api/auth/login";
        const result = await call(path, { method: "POST", body: JSON.stringify(payload) });
        if (result.requiresTotp) {
          setAuthRequiresTotp(true);
          setAuthError("");
          return { requiresTotp: true };
        }
        setNeedsLogin(false);
        setAuthRequiresTotp(false);
        setAuthError("");
        toast(t("toast.login"));
        return { requiresTotp: false };
      } catch {
        setAuthError(authRequiresTotp ? t("security.invalidTotp") : t("auth.invalidLogin"));
        return { requiresTotp: authRequiresTotp, error: true };
      }
    },
    [setupRequired, authRequiresTotp, call, t, toast]
  );

  const resetTotpLogin = useCallback(() => {
    setAuthRequiresTotp(false);
    setAuthError("");
  }, []);

  const logout = useCallback(async () => {
    await call("/api/auth/logout", { method: "POST" });
    location.reload();
  }, [call]);

  const authed = bootstrapped && !needsLogin;

  const value = useMemo(
    () => ({
      bootstrapped,
      needsLogin,
      setupRequired,
      authRequiresTotp,
      authError,
      setAuthError,
      meta,
      setMeta,
      authed,
      submitAuth,
      resetTotpLogin,
      logout,
      call,
    }),
    [bootstrapped, needsLogin, setupRequired, authRequiresTotp, authError, meta, authed, submitAuth, resetTotpLogin, logout, call]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
