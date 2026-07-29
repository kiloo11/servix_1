"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useLocale } from "../context/LocaleContext";

// Ported from App.vue's checkUpdate/applyUpdate/waitForRestart — composes
// DataContext's raw `update` state with confirm/toast, same split as
// lib/assetActions.js.
export function useUpdateActions() {
  const { call } = useAuth();
  const { update, setUpdate } = useData();
  const toast = useToast();
  const confirmAction = useConfirm();
  const { t } = useLocale();
  const [updateBusy, setUpdateBusy] = useState(false);

  async function checkUpdate() {
    setUpdateBusy(true);
    try {
      const result = await call("/api/update/check", { method: "POST" });
      setUpdate(result);
      if (result.error) toast(t("update.checkFailed", { error: result.error }));
      else if (result.updateAvailable) toast(t("update.availableToast", { version: result.latest }));
      else toast(t("update.upToDate"));
    } catch (error) {
      toast(t("update.checkFailed", { error: error.message }));
    } finally {
      setUpdateBusy(false);
    }
  }

  // Ported from App.vue's waitForRestart: the container recreates itself and
  // goes unreachable for a few minutes, so poll /api/auth/status (not
  // /api/update — sessions are in-memory and a restart drops them, so
  // authenticated requests would 401) until the version changes, then reload.
  async function waitForRestart(deadlineMs = 10 * 60_000) {
    const previousVersion = update.version;
    const until = Date.now() + deadlineMs;
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const status = await call("/api/auth/status");
        const version = status.meta?.version || "";
        if (version && version !== previousVersion) {
          toast(t("update.done", { version }));
          setTimeout(() => location.reload(), 1500);
          return;
        }
        if (status.authenticated) {
          const state = await call("/api/update");
          setUpdate(state);
          if (state.apply?.status === "error") {
            toast(t("update.failed", { error: state.apply.message }));
            return;
          }
        }
      } catch {
        // The server restarting is expected to be unreachable here.
      }
    }
  }

  async function applyUpdate() {
    if (!(await confirmAction(t("update.confirm", { version: update.latest || update.version })))) return;
    setUpdateBusy(true);
    try {
      setUpdate(await call("/api/update/apply", { method: "POST" }));
      toast(t("update.started"));
      waitForRestart();
    } catch (error) {
      toast(t("update.failed", { error: error.message }));
    } finally {
      setUpdateBusy(false);
    }
  }

  return { updateBusy, checkUpdate, applyUpdate };
}
