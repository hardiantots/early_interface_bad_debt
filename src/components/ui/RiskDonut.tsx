"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RiskDonutProps {
  summary: Record<string, number>;
  title: string;
  subtitle?: string;
}

const RISK_CONFIG: Record<
  string,
  { color: string; label: string; textClass: string }
> = {
  HIGH: { color: "#ef4444", label: "High Risk", textClass: "text-red-600" },
  MEDIUM: {
    color: "#f59e0b",
    label: "Medium Risk",
    textClass: "text-amber-600",
  },
  LOW: {
    color: "#10b981",
    label: "Low Risk",
    textClass: "text-emerald-600",
  },
};

const RISK_ORDER = ["HIGH", "MEDIUM", "LOW"];

interface CustomLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

const CustomLabel = ({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
}: CustomLabelProps) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="bold"
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export function RiskDonut({ summary, title, subtitle }: RiskDonutProps) {
  const data = RISK_ORDER.filter((k) => (summary[k] || 0) > 0).map((k) => ({
    name: RISK_CONFIG[k]?.label || k,
    value: summary[k] || 0,
    key: k,
    color: RISK_CONFIG[k]?.color || "#6b7280",
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={(props) => <CustomLabel {...props} />}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const num = Number(value);
              return [`${num} (${((num / total) * 100).toFixed(1)}%)`, ""];
            }}
            contentStyle={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#111",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "#6b7280" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center total overlay via absolute positioned div isn't easy in SVG,
           so we show summary pills below */}
      <div className="flex flex-wrap justify-center gap-2">
        {data.map((d) => (
          <div
            key={d.key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: d.color }}
            />
            {d.name}: <span className="font-bold">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
