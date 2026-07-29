"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { messages, translate, translatePlural, translateList } from "../lib/i18n";

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState("ru");

  // Mirrors App.vue's pattern of deriving currentLocale from server meta.locale
  // (on auth status, on /api/assets load, on settings save) — callers pass
  // whatever meta.locale the backend reports, we just validate it's known.
  const setLocale = useCallback((next) => {
    setLocaleState(messages[next] ? next : "ru");
  }, []);

  const t = useCallback((key, params) => translate(locale, key, params), [locale]);
  const tc = useCallback((key, count, params) => translatePlural(locale, key, count, params), [locale]);
  const tList = useCallback((key) => translateList(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, tc, tList }), [locale, setLocale, t, tc, tList]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
