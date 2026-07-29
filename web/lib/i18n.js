import ruLocale from "../../locale/ru.json";
import enLocale from "../../locale/en.json";

// Ported verbatim from src/App.vue (translate/translatePlural/translateList/
// getPath/interpolate/pluralIndex/countryFlag/countryName/countryLabelForLocale/
// countryNameForLocale) — framework-agnostic, no behavior changes.

export const messages = { ru: ruLocale, en: enLocale };

export function getPath(object, path) {
  return String(path)
    .split(".")
    .reduce((value, part) => value?.[part], object);
}

export function interpolate(value, params = {}) {
  return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

export function pluralIndex(locale, count) {
  const value = Math.abs(Number(count));
  if (locale === "ru") {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
    return 2;
  }
  return value === 1 ? 0 : 1;
}

export function translate(locale, key, params = {}) {
  const dictionary = messages[locale] || messages.ru;
  const fallback = messages.ru;
  const value = getPath(dictionary, key) ?? getPath(fallback, key) ?? key;
  return interpolate(value, params);
}

export function translatePlural(locale, key, count, params = {}) {
  const forms = getPath(messages[locale] || messages.ru, `plural.${key}`) || getPath(messages.ru, `plural.${key}`);
  if (!Array.isArray(forms)) return String(count);
  const index = pluralIndex(locale, count);
  return interpolate(forms[index] || forms[forms.length - 1], { ...params, count });
}

export function translateList(locale, key) {
  const dictionary = messages[locale] || messages.ru;
  const fallback = messages.ru;
  const value = getPath(dictionary, key) ?? getPath(fallback, key) ?? [];
  return Array.isArray(value) ? value : [];
}

export function countryFlag(code) {
  const countryCode = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return "🌐";
  return [...countryCode].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
}

export function countryName(code, locale) {
  const countryCode = String(code || "").toUpperCase();
  try {
    const displayNames = new Intl.DisplayNames([locale === "en" ? "en" : "ru"], { type: "region" });
    return displayNames.of(countryCode) || getPath(messages[locale] || messages.ru, `countries.${countryCode}`) || countryCode;
  } catch {
    return getPath(messages[locale] || messages.ru, `countries.${countryCode}`) || countryCode;
  }
}

export function countryLabelForLocale(code, locale) {
  const countryCode = String(code || "").toUpperCase();
  const flag = countryFlag(countryCode);
  const name = countryCode ? countryName(countryCode, locale) : translate(locale, "common.countryEmpty");
  return countryCode ? `${flag} ${name}` : name;
}

export function countryNameForLocale(code, locale) {
  const countryCode = String(code || "").toUpperCase();
  return countryCode ? countryName(countryCode, locale) : translate(locale, "common.countryEmpty");
}
