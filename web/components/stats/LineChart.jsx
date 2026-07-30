"use client";

import { useState } from "react";
import { computePoints, roundPoint } from "../../lib/statsTimeline";

// Ported from the hand-rolled SVG chart markup shared by StatsView's two
// line-chart panels (App.vue's showChartTooltip/hideChartTooltip +
// paymentAmount/CountPoints/AreaPoints/Hits computeds). Tooltip state is kept
// local to each chart instance instead of a single shared `chartTooltip` on
// the root — the two charts are independent DOM regions, so this is a
// behavior-neutral simplification (only one can be hovered at a time anyway).
//
// `forecastRows` (optional) renders as a dashed continuation of the same
// line, sharing one y-scale with the historical points (computed together —
// see computePoints()'s doc comment) so the two segments meet without a kink
// at the boundary. Only the historical portion gets the filled area under it.
export default function LineChart({ rows, valueKey, compact = false, axisLabels, formatValue, formatCount, emptyText, forecastRows = [] }) {
  const [tooltip, setTooltip] = useState(null);

  // Guards on "any row has a nonzero value", not just "any rows exist" —
  // buildPaymentTimeline() always generates time-bucket rows for the period,
  // even with zero payments, so `rows.length` alone would never be empty.
  const hasData = rows.some((row) => Number(row[valueKey] || 0) > 0) || forecastRows.some((row) => Number(row[valueKey] || 0) > 0);
  if (!hasData) return <div className="inline-empty">{emptyText}</div>;

  const merged = forecastRows.length ? [...rows, ...forecastRows] : rows;
  const points = computePoints(merged, valueKey);
  const boundary = Math.max(0, rows.length - 1);
  const historicalPoints = points.slice(0, boundary + 1);
  const forecastPoints = forecastRows.length ? points.slice(boundary) : [];

  const toPointsAttr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");
  const mainLine = toPointsAttr(historicalPoints);
  const forecastLine = toPointsAttr(forecastPoints);
  const fillPoints = historicalPoints.length ? `0,40 ${mainLine} ${historicalPoints[historicalPoints.length - 1].x},40` : "";

  const hitWidth = points.length === 1 ? 100 : 100 / points.length;
  const hits = points.map((point, index) => ({
    key: `${valueKey}-${index}`,
    x: roundPoint(Math.max(0, point.x - hitWidth / 2)),
    width: roundPoint(index === points.length - 1 ? 100 - Math.max(0, point.x - hitWidth / 2) : hitWidth),
    point,
  }));

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
        <polyline className={`line-main${compact ? " count-line" : ""}`} points={mainLine} />
        {forecastLine ? <polyline className="line-forecast" points={forecastLine} /> : null}
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
