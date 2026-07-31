"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { computeTrend } from "../../lib/trend";

export default function TrendTag({ current, previous, invert = false }) {
  const { t } = useLocale();
  const trend = computeTrend(current, previous, invert);
  if (!trend) return null;
  if (trend.flat) return <span className="trend-tag trend-flat">{t("summary.trendFlat")}</span>;
  const Icon = trend.up ? ArrowUp : ArrowDown;
  return (
    <span className={`trend-tag ${trend.good ? "trend-good" : "trend-bad"}`}>
      <Icon size={11} />
      {trend.percent.toFixed(1)}%
    </span>
  );
}
