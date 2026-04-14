"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ScoreDistributionProps {
  rows: Record<string, unknown>[];
  scoreKey?: string;
}

const BUCKETS = [
  { label: "0–20%", min: 0, max: 0.2, color: "#10b981" },
  { label: "20–40%", min: 0.2, max: 0.4, color: "#84cc16" },
  { label: "40–60%", min: 0.4, max: 0.6, color: "#f59e0b" },
  { label: "60–80%", min: 0.6, max: 0.8, color: "#f97316" },
  { label: "80–100%", min: 0.8, max: 1.01, color: "#ef4444" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        color: "#111",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="font-semibold text-gray-700 mb-1">Bucket Probabilitas: {label}</div>
      <div className="text-blue-600 font-medium flex justify-between gap-3 items-center">
        <span>Jumlah Invoice:</span>
        <span className="text-sm">{payload[0]?.value}</span>
      </div>
    </div>
  );
};

export function ScoreDistribution({
  rows,
  scoreKey = "prob_bad_debt",
}: ScoreDistributionProps) {
  const data = useMemo(() => {
    return BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: rows.filter((r) => {
        const v = Number(r[scoreKey]);
        return (
          !isNaN(v) &&
          v >= bucket.min &&
          v < bucket.max
        );
      }).length,
      color: bucket.color,
    }));
  }, [rows, scoreKey]);

  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Score Distribution
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Distribusi probabilitas bad debt ({total} invoice)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -8, bottom: 4 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-2">
        {data
          .filter((d) => d.count > 0)
          .map((d) => (
            <div
              key={d.label}
              className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400"
            >
              <span
                className="w-2 h-2 rounded-sm"
                style={{ background: d.color }}
              />
              {d.label}: <span className="font-semibold">{d.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
