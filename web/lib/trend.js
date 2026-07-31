// Shared "current vs previous period" delta math — used by TrendTag.jsx (the
// on-screen ↑/↓ badge) and by anywhere else that needs the same
// direction-aware good/bad comparison without rendering JSX (e.g. the PDF
// report export in pdfExport.js).
//
// Arrow direction always follows the raw delta (up = value increased). Color
// follows whether that direction is actually good for the metric — `invert`
// flips it for cost-like metrics (e.g. churn, cost per subscriber), where
// rising is bad.
export function computeTrend(current, previous, invert = false) {
  // A zero previous-period base makes "% change" undefined (division by
  // zero) rather than just a big number — no trend rather than a misleading
  // e.g. "+100%".
  if (!previous) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return { flat: true, up: null, good: null, percent: 0 };
  const percent = (delta / Math.abs(previous)) * 100;
  const up = delta > 0;
  const good = invert ? !up : up;
  return { flat: false, up, good, percent: Math.abs(percent) };
}
