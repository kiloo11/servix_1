"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

const COLOR_LINE = "#ef4bc8";
const COLOR_LINE_FILL = "rgba(239, 75, 200, 0.12)";
const COLOR_GOOD = "#35d488";
const COLOR_DANGER = "#ff6f9e";
const COLOR_FORECAST = "#9a8fb3";
const COLOR_BAND = "rgba(154, 143, 179, 0.16)";
const COLOR_MUTED = "#9a8fb3";
const COLOR_GRID = "rgba(154, 143, 179, 0.14)";

// A React useEffect already runs after the DOM commit, so the chart's
// mount/rows-change/unmount lifecycle is handled directly here. `rows` are
// actual (solid) months; `forecastRows` (optional) are a dashed continuation
// plus a confidence band — same real+forecast pattern, including the
// "current month projected" anchor handling, as dashboard/RevenueTrendChart.jsx:
// when forecastRows[0] shares rows' last month, that's the divergence point
// (real = partial actual, forecast = projected estimate for that same
// month) rather than a new label on the axis.
export default function NetChart({ rows, forecastRows = [], currency, t, formatMoney, formatShort }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !rows.some((row) => row.revenue || row.cost)) return undefined;

    const realCount = rows.length;
    const lastRowMonth = realCount ? rows[realCount - 1].month : null;
    const hasCurrentMonthProjection = forecastRows.length > 0 && forecastRows[0].month === lastRowMonth;
    const futureForecastRows = hasCurrentMonthProjection ? forecastRows.slice(1) : forecastRows;
    const anchorValue = hasCurrentMonthProjection ? forecastRows[0].value : realCount ? rows[realCount - 1].net : null;

    const forecastCount = futureForecastRows.length;
    const labels = [...rows.map((row) => row.label), ...futureForecastRows.map((row) => row.label)];

    const realData = [...rows.map((row) => row.net), ...Array(forecastCount).fill(null)];
    const forecastData = [...Array(Math.max(0, realCount - 1)).fill(null), ...(realCount ? [anchorValue] : []), ...futureForecastRows.map((row) => row.value)];
    const upperData = [...Array(realCount).fill(null), ...futureForecastRows.map((row) => row.upper)];
    const lowerData = [...Array(realCount).fill(null), ...futureForecastRows.map((row) => row.lower)];

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: t("pnl.monthlyNet"),
            data: realData,
            borderColor: COLOR_LINE,
            backgroundColor: COLOR_LINE_FILL,
            pointBackgroundColor: rows.map((row) => (row.net >= 0 ? COLOR_GOOD : COLOR_DANGER)),
            pointBorderColor: rows.map((row) => (row.net >= 0 ? COLOR_GOOD : COLOR_DANGER)),
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2,
            tension: 0.3,
            fill: "origin",
          },
          {
            label: t("pnl.forecastLabel"),
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
            filter: (item) => item.dataset.label === t("pnl.monthlyNet") || item.dataset.label === t("pnl.forecastLabel"),
            callbacks: {
              title: (items) => {
                const index = items[0]?.dataIndex;
                if (index == null) return "";
                return index < realCount ? rows[index]?.monthLabel || "" : futureForecastRows[index - realCount]?.monthLabel || "";
              },
              label: (item) => {
                if (item.dataset.label === t("pnl.monthlyNet") && item.dataIndex < realCount) {
                  const row = rows[item.dataIndex];
                  return [
                    `${t("pnl.monthlyRevenue")}: ${formatMoney(row.revenue, currency)}`,
                    `${t("pnl.monthlyCost")}: ${formatMoney(row.cost, currency)}`,
                    `${t("pnl.monthlyNet")}: ${formatMoney(row.net, currency)}`,
                  ];
                }
                return `${t("pnl.forecastLabel")}: ${item.parsed.y == null ? "—" : formatMoney(item.parsed.y, currency)}`;
              },
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
  }, [rows, forecastRows, currency, t, formatMoney, formatShort]);

  return <canvas ref={canvasRef} />;
}
