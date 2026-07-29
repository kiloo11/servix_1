"use client";

import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useLocale } from "../context/LocaleContext";
import { compareAssetsOrder, parseAppDate, quickRenewBase, quickRenewDays, toLocalInput } from "./dates";

function fallbackCopyText(value) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  field.style.top = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(field);
  if (!copied) throw new Error("Copy failed");
}

// Composed business actions, ported from App.vue's saveAsset/deleteAsset/
// toggleAssetInactive/quickRenew/copyIp/saveProvider/deleteProvider/
// addQuickPayment/deletePayment/adjustExpireDays/startAssetDrag/endAssetDrag/
// dropAsset. Each wraps DataContext's raw CRUD primitives (which already
// reload after mutating) with the same confirm/toast semantics the Vue
// methods had directly via `this`.
export function useAssetActions() {
  const { assets, createAsset, putAsset, removeAsset, createProvider, putProvider, removeProvider, createCategory, putCategory, removeCategory, reorderAssets } =
    useData();
  const toast = useToast();
  const confirmAction = useConfirm();
  const { t, tc } = useLocale();

  async function saveAsset(draft) {
    const asset = { ...draft };
    const isNew = !asset.id;
    if (asset.type === "vps") asset.domain = "";
    else {
      asset.ip = "";
      asset.countryCode = "";
    }
    const price = Number(asset.price || 0);
    if (isNew && price > 0) {
      asset.payments = [...(asset.payments || []), { amount: price, currency: asset.priceCurrency || "USDT", paidAt: toLocalInput(new Date()), note: "" }];
    }
    if (asset.id) await putAsset(asset.id, asset);
    else await createAsset(asset);
    toast(t("assets.saved"));
  }

  async function deleteAsset(asset) {
    if (!(await confirmAction(t("assets.deleteConfirm", { name: asset.name })))) return false;
    await removeAsset(asset.id);
    toast(t("assets.deleted"));
    return true;
  }

  async function toggleAssetInactive(asset, inactive = true) {
    if (inactive && !(await confirmAction(t("assets.deactivateConfirm", { name: asset.name })))) return;
    await putAsset(asset.id, { ...asset, inactive });
    toast(inactive ? t("assets.deactivated") : t("assets.activated"));
  }

  async function quickRenew(asset) {
    const date = quickRenewBase(asset);
    const days = quickRenewDays(asset);
    const daysLabel = tc("day", days);
    date.setDate(date.getDate() + days);
    const updated = { ...asset, expiresAt: toLocalInput(date) };
    const price = Number(asset.price || 0);
    if (price > 0) {
      updated.payments = [...(asset.payments || []), { amount: price, currency: asset.priceCurrency || "USDT", paidAt: toLocalInput(new Date()), note: t("assets.quickRenewNote", { days: daysLabel }) }];
    }
    await putAsset(asset.id, updated);
    toast(t("assets.quickRenewed", { days: daysLabel }));
  }

  async function copyIp(ip) {
    const value = String(ip || "").trim();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else fallbackCopyText(value);
      toast(t("assets.ipCopied"));
    } catch {
      try {
        fallbackCopyText(value);
        toast(t("assets.ipCopied"));
      } catch {
        toast(t("assets.copyFailed"));
      }
    }
  }

  async function saveProvider(draft) {
    if (draft.id) await putProvider(draft.id, draft);
    else await createProvider(draft);
    toast(t("providers.saved"));
  }

  async function deleteProvider(provider) {
    if (!(await confirmAction(t("providers.deleteConfirm", { name: provider.name })))) return false;
    await removeProvider(provider.id);
    toast(t("providers.deleted"));
    return true;
  }

  async function saveCategory(draft) {
    if (draft.id) await putCategory(draft.id, draft);
    else await createCategory(draft);
    toast(t("categories.saved"));
  }

  async function deleteCategory(category) {
    if (!(await confirmAction(t("categories.deleteConfirm", { name: category.name })))) return false;
    await removeCategory(category.id);
    toast(t("categories.deleted"));
    return true;
  }

  async function addQuickPayment(asset, quickPayment) {
    const amount = Number(quickPayment.amount || 0);
    if (!asset || amount <= 0) return toast(t("payments.addAmount"));
    const currency = quickPayment.currency || "USDT";
    await putAsset(asset.id, { ...asset, payments: [...(asset.payments || []), { amount, currency, paidAt: quickPayment.paidAt || toLocalInput(new Date()), note: "" }] });
    toast(t("payments.added"));
  }

  async function deletePayment(asset, paymentId) {
    if (!asset) return;
    await putAsset(asset.id, { ...asset, payments: (asset.payments || []).filter((payment) => payment.id !== paymentId) });
    toast(t("payments.deleted"));
  }

  async function adjustExpireDays(asset, days, renewalPayment) {
    if (!asset) return;
    const current = parseAppDate(asset.expiresAt);
    const date = Number.isNaN(current.getTime()) ? new Date() : current;
    date.setDate(date.getDate() + days);
    const updated = { ...asset, expiresAt: toLocalInput(date) };
    const price = Number(renewalPayment.amount || 0);
    if (days > 0 && price > 0) {
      updated.payments = [...(asset.payments || []), { amount: price, currency: renewalPayment.currency || "USDT", paidAt: toLocalInput(new Date()), note: "" }];
    }
    await putAsset(asset.id, updated);
    toast(t("settings.saved"));
  }

  async function dropAsset(draggedId, targetAsset) {
    const dragged = assets.find((asset) => asset.id === draggedId);
    if (!dragged || !targetAsset || dragged.id === targetAsset.id || dragged.type !== targetAsset.type || Boolean(dragged.inactive) !== Boolean(targetAsset.inactive)) return;
    const sameType = assets.filter((asset) => asset.type === dragged.type && Boolean(asset.inactive) === Boolean(dragged.inactive)).sort(compareAssetsOrder);
    const nextOrder = sameType.filter((asset) => asset.id !== dragged.id);
    const targetIndex = nextOrder.findIndex((asset) => asset.id === targetAsset.id);
    nextOrder.splice(Math.max(0, targetIndex), 0, dragged);
    const orderedIds = nextOrder.map((asset) => asset.id);
    try {
      await reorderAssets(dragged.type, Boolean(dragged.inactive), orderedIds);
    } catch (error) {
      toast(error.message);
    }
  }

  return {
    saveAsset,
    deleteAsset,
    toggleAssetInactive,
    quickRenew,
    copyIp,
    saveProvider,
    deleteProvider,
    saveCategory,
    deleteCategory,
    addQuickPayment,
    deletePayment,
    adjustExpireDays,
    dropAsset,
  };
}
