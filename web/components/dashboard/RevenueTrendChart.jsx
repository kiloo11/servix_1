"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

const COLOR_LINE = "#ef4bc8";
const COLOR_LINE_FILL = "rgba(239, 75, 200, 0.12)";
const COLOR_FORECAST = "#9a8fb3";
const COLOR_BAND = "rgba(154, 143, 179, 0.16)";
const COLOR_MUTED = "#9a8fb3";
const COLOR_GRID = "rgba(154, 143, 179, 0.14)";

// Real months as a solid line, then a dashed continuation into the forecast
// months plus a shaded confidence band — same imperative canvas-ref
// lifecycle as pnl/NetChart.jsx, just with two extra datasets. Normally the
// dashed "forecast" dataset repeats the last real value at its own start so
// the line visually connects instead of jumping. But when the most recent
// real month is still in progress, the backend's forecastRows[0] is instead
// the regression's own trend estimate FOR that same month (see
// forecasting.py — it's excluded from the fit's input data, but still
// predicted like any other future point) — using that as the anchor, rather
// than the partial actual, is what makes the solid "real" line (partial,
// low) and dashed "forecast" line (trend estimate for the full month)
// visibly diverge at that shared month instead of the forecast appearing to
// crash and recover.
export default function RevenueTrendChart({ trendMonths, forecastRows, currency, t, formatMoney, formatShort }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !trendMonths.length) return undefined;

    const realCount = trendMonths.length;
    const lastTrendMonth = realCount ? trendMonths[realCount - 1].month : null;
    // forecastRows[0] shares trendMonths' last month exactly when that month
    // is still in progress (see the comment above) — it's the anchor point,
    // not a new month on the axis, so it's split off from the truly-future
    // rows rather than appended as a fifth label.
    const hasCurrentMonthProjection = forecastRows.length > 0 && forecastRows[0].month === lastTrendMonth;
    const futureForecastRows = hasCurrentMonthProjection ? forecastRows.slice(1) : forecastRows;
    const anchorValue = hasCurrentMonthProjection ? forecastRows[0].value : realCount ? trendMonths[realCount - 1].bookingsMrr : null;

    const forecastCount = futureForecastRows.length;
    const labels = [...trendMonths.map((row) => row.monthLabel), ...futureForecastRows.map((row) => row.monthLabel)];

    const realData = [...trendMonths.map((row) => row.bookingsMrr), ...Array(forecastCount).fill(null)];
    const forecastData = [...Array(Math.max(0, realCount - 1)).fill(null), ...(realCount ? [anchorValue] : []), ...futureForecastRows.map((row) => row.value)];
    const upperData = [...Array(realCount).fill(null), ...futureForecastRows.map((row) => row.upper)];
    const lowerData = [...Array(realCount).fill(null), ...futureForecastRows.map((row) => row.lower)];

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: t("dashboard.cardBookingsMrr"),
            data: realData,
            borderColor: COLOR_LINE,
            backgroundColor: COLOR_LINE_FILL,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.3,
            fill: "origin",
          },
          {
            label: t("dashboard.forecastLabel"),
            data: forecastData,
            borderColor: COLOR_FORECAST,
            borderDash: [6, 4],
            pointRadius: (ctx) => (ctx.dataIndex >= Math.max(0, realCount - 1) ? 4 : 0),
            pointHoverRadius: 6,
            pointBackgroundColor: COLOR_FORECAST,
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          },
          {
            label: "upper",
            data: upperData,
            borderWidth: 0,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
          },
          {
            label: "lower",
            data: lowerData,
            borderWidth: 0,
            pointRadius: 0,
            backgroundColor: COLOR_BAND,
            fill: "-1",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            filter: (item) => item.dataset.label === t("dashboard.cardBookingsMrr") || item.dataset.label === t("dashboard.forecastLabel"),
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.parsed.y == null ? "—" : formatMoney(item.parsed.y, currency)}`,
            },
          },
        },
        scales: {
          x: { grid: { color: COLOR_GRID }, ticks: { color: COLOR_MUTED } },
          y: { grid: { color: COLOR_GRID }, ticks: { color: COLOR_MUTED, callback: (value) => formatShort(value) } },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [trendMonths, forecastRows, currency, t, formatMoney, formatShort]);

  return <canvas ref={canvasRef} />;
}
