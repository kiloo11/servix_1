"use client";

import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";

// Ported verbatim from App.vue's convertToEur/convertAmount/usdRubRate/
// formatMoney/paymentsTotalIn/formatPaymentTotal/totalPayments — EUR stays the
// backend's pivot currency (see CLAUDE.md). Parameterized by meta/locale
// instead of reading `this.*` so they're plain, testable functions; useMoney()
// below binds them to context the way call sites actually use them.

export function convertToEur(amount, currency, meta) {
  const value = Number(amount || 0);
  if (currency === "RUB") return value / (Number(meta.rateRubPerEur) || 100);
  if (currency === "USDT") return value / (Number(meta.rateUsdtPerEur) || 1.08);
  return value;
}

export function convertAmount(amount, from, to, meta) {
  const fromCurrency = from || "USDT";
  const toCurrency = to || meta.currency || "USDT";
  if (fromCurrency === toCurrency) return Number(amount || 0);
  const eur = convertToEur(amount, fromCurrency, meta);
  if (toCurrency === "EUR") return eur;
  if (toCurrency === "RUB") return eur * (Number(meta.rateRubPerEur) || 100);
  if (toCurrency === "USDT") return eur * (Number(meta.rateUsdtPerEur) || 1.08);
  return eur;
}

export function usdRubRate(meta) {
  return Number(meta.rateRubPerEur || 0) / (Number(meta.rateUsdtPerEur) || 1);
}

// For currency *pickers* (option labels), not amounts — formatMoney already
// renders EUR/RUB amounts with their Intl-native €/₽ symbols; this is what
// those selects need to show the same symbols instead of full names like
// "Российский рубль", which wrapped to 2 lines and forced the select (and
// any grid/flex track sizing it) wider than intended.
export function currencySymbol(currency) {
  return { USDT: "₮", EUR: "€", RUB: "₽" }[currency] || currency;
}

export function formatMoney(value, currency = "USDT", locale = "ru") {
  const intlLocale = locale === "en" ? "en-US" : "ru-RU";
  const num = Number(value || 0);
  if (currency === "EUR" || currency === "RUB") {
    return new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 2 }).format(num);
  }
  return `${new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)} ₮`;
}

export function paymentsTotalIn(payments = [], targetCurrency, meta) {
  return (payments || []).reduce((sum, payment) => sum + convertAmount(payment.amount, payment.currency || "USDT", targetCurrency || meta.currency || "USDT", meta), 0);
}

export function totalPayments(payments = []) {
  return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

export function useMoney() {
  const { meta } = useAuth();
  const { locale } = useLocale();

  return {
    convertToEur: (amount, currency) => convertToEur(amount, currency, meta),
    convertAmount: (amount, from, to) => convertAmount(amount, from, to, meta),
    usdRubRate: () => usdRubRate(meta),
    formatMoney: (value, currency = "USDT") => formatMoney(value, currency, locale),
    paymentsTotalIn: (payments = [], targetCurrency) => paymentsTotalIn(payments, targetCurrency, meta),
    formatPaymentTotal: (payments = [], currency) => formatMoney(paymentsTotalIn(payments, currency || meta.currency, meta), currency || meta.currency, locale),
    totalPayments,
  };
}
