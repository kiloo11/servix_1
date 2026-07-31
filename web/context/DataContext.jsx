"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLocale } from "./LocaleContext";

const DataContext = createContext(null);

const DEFAULT_SECURITY = { login: "", totpEnabled: false, hasPendingTotp: false };
const DEFAULT_BOT_REVENUE = { configured: false, totalRub: 0, monthRub: 0, count: 0, monthCount: 0, items: [], updatedAt: "" };

export function DataProvider({ children }) {
  const { authed, call, setMeta } = useAuth();
  const { setLocale } = useLocale();

  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [security, setSecurity] = useState(DEFAULT_SECURITY);
  const [botRevenue, setBotRevenue] = useState(DEFAULT_BOT_REVENUE);
  const [botRevenueMonthly, setBotRevenueMonthly] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await call("/api/assets");
    setMeta(data.meta);
    setLocale(data.meta.locale);
    setProviders(data.providers || []);
    setCategories(data.categories || []);
    setAssets(data.assets || []);
    setAlerts((await call("/api/notifications")).items || []);
    document.title = data.meta.siteTitle;
  }, [call, setMeta, setLocale]);

  const loadSecurity = useCallback(async () => {
    setSecurity(await call("/api/auth/security"));
  }, [call]);

  // Sidebar's summary card needs a total-revenue figure alongside "Уплачено"
  // to show income/profit — best-effort: an unconfigured or unreachable
  // Bedolaga API must not break the rest of the app's data load.
  const loadBotRevenue = useCallback(async () => {
    try {
      setBotRevenue(await call("/api/bot/revenue"));
    } catch {
      // Keep whatever was last successfully loaded (or the all-zero default).
    }
    try {
      setBotRevenueMonthly((await call("/api/bot/revenue/monthly")).months || []);
    } catch {
      // Same — a stale/empty monthly breakdown just means no trend shows.
    }
  }, [call]);

  useEffect(() => {
    if (!authed || loaded) return;
    setLoaded(true);
    load();
    loadSecurity();
    loadBotRevenue();
  }, [authed, loaded, load, loadSecurity, loadBotRevenue]);

  // Raw CRUD primitives — every mutation here reloads afterward, so that
  // invariant lives here once rather than repeated at every call site (see
  // lib/assetActions.js for the confirm/toast-wrapped composed actions built
  // on top of these).
  const createAsset = useCallback(
    async (asset) => {
      await call("/api/assets", { method: "POST", body: JSON.stringify(asset) });
      await load();
    },
    [call, load]
  );
  const putAsset = useCallback(
    async (id, asset) => {
      const result = await call(`/api/assets/${id}`, { method: "PUT", body: JSON.stringify(asset) });
      await load();
      return result;
    },
    [call, load]
  );
  const removeAsset = useCallback(
    async (id) => {
      await call(`/api/assets/${id}`, { method: "DELETE" });
      await load();
    },
    [call, load]
  );
  // Optimistically reorders `assets` locally before the API confirms, then
  // reloads on both success and failure — on failure this pulls the server's
  // real order back in as a revert.
  const reorderAssets = useCallback(
    async (type, inactive, orderedIds) => {
      setAssets((current) =>
        current.map((asset) => {
          const index = orderedIds.indexOf(asset.id);
          return index >= 0 ? { ...asset, sortOrder: index } : asset;
        })
      );
      try {
        await call("/api/assets/reorder", { method: "POST", body: JSON.stringify({ type, inactive, ids: orderedIds }) });
        await load();
      } catch (error) {
        await load();
        throw error;
      }
    },
    [call, load]
  );
  const createProvider = useCallback(
    async (provider) => {
      await call("/api/providers", { method: "POST", body: JSON.stringify(provider) });
      await load();
    },
    [call, load]
  );
  const putProvider = useCallback(
    async (id, provider) => {
      await call(`/api/providers/${id}`, { method: "PUT", body: JSON.stringify(provider) });
      await load();
    },
    [call, load]
  );
  const removeProvider = useCallback(
    async (id) => {
      await call(`/api/providers/${id}`, { method: "DELETE" });
      await load();
    },
    [call, load]
  );
  const createCategory = useCallback(
    async (category) => {
      await call("/api/categories", { method: "POST", body: JSON.stringify(category) });
      await load();
    },
    [call, load]
  );
  const putCategory = useCallback(
    async (id, category) => {
      await call(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(category) });
      await load();
    },
    [call, load]
  );
  const removeCategory = useCallback(
    async (id) => {
      await call(`/api/categories/${id}`, { method: "DELETE" });
      await load();
    },
    [call, load]
  );

  const value = useMemo(
    () => ({
      providers,
      setProviders,
      categories,
      setCategories,
      assets,
      setAssets,
      alerts,
      setAlerts,
      security,
      botRevenue,
      botRevenueMonthly,
      dataLoaded: loaded,
      load,
      loadSecurity,
      loadBotRevenue,
      createAsset,
      putAsset,
      removeAsset,
      reorderAssets,
      createProvider,
      putProvider,
      removeProvider,
      createCategory,
      putCategory,
      removeCategory,
    }),
    [
      providers,
      categories,
      assets,
      alerts,
      security,
      botRevenue,
      botRevenueMonthly,
      loaded,
      load,
      loadSecurity,
      loadBotRevenue,
      createAsset,
      putAsset,
      removeAsset,
      reorderAssets,
      createProvider,
      putProvider,
      removeProvider,
      createCategory,
      putCategory,
      removeCategory,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
