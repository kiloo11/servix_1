"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

const COLOR_LINE = "#ef4bc8";
const COLOR_LINE_FILL = "rgba(239, 75, 200, 0.12)";
const COLOR_GOOD = "#35d488";
const COLOR_DANGER = "#ff6f9e";
const COLOR_MUTED = "#9a8fb3";
const COLOR_GRID = "rgba(154, 143, 179, 0.14)";

// A React useEffect already runs after the DOM commit, so the chart's
// mount/rows-change/unmount lifecycle is handled directly here.
export default function NetChart({ rows, currency, t, formatMoney, formatShort }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !rows.some((row) => row.revenue || row.cost)) return undefined;

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map((row) => row.label),
        datasets: [
          {
            label: t("pnl.monthlyProfitTitle"),
            data: rows.map((row) => row.net),
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
            callbacks: {
              title: (items) => rows[items[0].dataIndex]?.monthLabel || "",
              label: (item) => {
                const row = rows[item.dataIndex];
                return [
                  `${t("pnl.monthlyRevenue")}: ${formatMoney(row.revenue, currency)}`,
                  `${t("pnl.monthlyCost")}: ${formatMoney(row.cost, currency)}`,
                  `${t("pnl.monthlyNet")}: ${formatMoney(row.net, currency)}`,
                ];
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
  }, [rows, currency, t, formatMoney, formatShort]);

  return <canvas ref={canvasRef} />;
}
