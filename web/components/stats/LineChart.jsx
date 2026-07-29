"use client";

import { useState } from "react";
import { areaPoints, chartHits, linePoints } from "../../lib/statsTimeline";

// Ported from the hand-rolled SVG chart markup shared by StatsView's two
// line-chart panels (App.vue's showChartTooltip/hideChartTooltip +
// paymentAmount/CountPoints/AreaPoints/Hits computeds). Tooltip state is kept
// local to each chart instance instead of a single shared `chartTooltip` on
// the root — the two charts are independent DOM regions, so this is a
// behavior-neutral simplification (only one can be hovered at a time anyway).
export default function LineChart({ rows, valueKey, compact = false, axisLabels, formatValue, formatCount, emptyText }) {
  const [tooltip, setTooltip] = useState(null);

  // Guards on "any row has a nonzero value", not just "any rows exist" —
  // buildPaymentTimeline() always generates time-bucket rows for the period,
  // even with zero payments, so `rows.length` alone would never be empty.
  const hasData = rows.some((row) => Number(row[valueKey] || 0) > 0);
  if (!hasData) return <div className="inline-empty">{emptyText}</div>;

  const points = linePoints(rows, valueKey);
  const fillPoints = areaPoints(rows, valueKey);
  const hits = chartHits(rows, valueKey);

  function showTooltip(point, event) {
    const rect = event.currentTarget.closest(".line-chart").getBoundingClientRect();
    const left = Math.min(rect.width - 150, Math.max(10, event.clientX - rect.left + 12));
    const top = Math.max(10, event.clientY - rect.top - 58);
    setTooltip({
      left,
      top,
      label: point.row.label,
      value: formatValue(point.row),
      count: formatCount(point.row),
    });
  }

  return (
    <div className={`line-chart${compact ? " compact-line" : ""}`} onMouseLeave={() => setTooltip(null)}>
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
        <polyline className={`line-fill${compact ? " count-line" : ""}`} points={fillPoints} />
        <polyline className={`line-main${compact ? " count-line" : ""}`} points={points} />
        {hits.map((hit) => (
          <rect
            key={hit.key}
            className="line-hit"
            x={hit.x}
            y={0}
            width={hit.width}
            height={42}
            onMouseEnter={(e) => showTooltip(hit.point, e)}
            onMouseMove={(e) => showTooltip(hit.point, e)}
          />
        ))}
      </svg>
      {tooltip ? (
        <div className="chart-tooltip" style={{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }}>
          <strong>{tooltip.label}</strong>
          <span>{tooltip.value}</span>
          <small>{tooltip.count}</small>
        </div>
      ) : null}
      <div className="line-axis">
        {axisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
