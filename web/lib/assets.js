import { makeId } from "./ids";
import { toLocalInput } from "./dates";

export const CURRENCIES = ["USDT", "EUR", "RUB"];
export const ASSET_TYPES = ["vps", "domain", "certificate"];

export function emptyAsset() {
  return {
    id: "",
    type: "vps",
    name: "",
    providerId: "",
    ip: "",
    domain: "",
    countryCode: "",
    category: "",
    inactive: false,
    sortOrder: Date.now(),
    expiresAt: toLocalInput(new Date()),
    payments: [],
    price: "",
    priceCurrency: "USDT",
  };
}

export function emptyProvider() {
  return { id: "", name: "", loginUrl: "", faviconUrl: "", color: "", note: "" };
}

export function emptyCategory() {
  return { id: "", name: "", color: providerFallbackColor(makeId()) };
}

export function providerFallbackColor(seed = "provider") {
  let hash = 0;
  for (const char of String(seed)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 68, 54);
}

export function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function domainHref(domain) {
  const value = String(domain || "").trim();
  if (!value) return "#";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
