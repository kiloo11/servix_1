// Picks a legible text color for an arbitrary solid background color (e.g. a
// user-picked category color): white when it clears 4.5:1, otherwise a
// progressively darkened shade of that same color (never plain black) so
// the text still reads as "this category's color", just legible — the same
// pattern used for the danger/success/warning badge tokens in globals.css,
// generalized to work for any hex a user might pick.

function hexToRgb(hex) {
  const value = String(hex || "").replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function toHex(n) {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
}

function rgbToHex({ r, g, b }) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(luminanceA, luminanceB) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Returns "#fff" or a darkened same-hue shade that reaches minRatio against
// `hex` used as a solid background; falls back to "#fff" for unparseable
// input rather than guessing.
export function contrastTextColor(hex, minRatio = 4.5) {
  const bg = hexToRgb(hex);
  if (!bg) return "#fff";
  const bgLuminance = relativeLuminance(bg);
  if (contrastRatio(1, bgLuminance) >= minRatio) return "#fff";

  for (let scale = 0.9; scale >= 0.1; scale -= 0.05) {
    const candidate = { r: bg.r * scale, g: bg.g * scale, b: bg.b * scale };
    if (contrastRatio(relativeLuminance(candidate), bgLuminance) >= minRatio) {
      return rgbToHex(candidate);
    }
  }
  return "#000";
}
