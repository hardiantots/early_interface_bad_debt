"use client";

import React from "react";
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
import { fmtNumber } from "@/lib/utils";

interface EflBarChartProps {
  rows: Record<string, unknown>[];
  topN?: number;
}

interface TooltipPayload {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
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
        maxWidth: 220,
      }}
    >
      <div className="font-semibold text-gray-800 truncate max-w-[200px]">
        {label}
      </div>
      <div className="text-red-600 font-medium mt-0.5">
        EFL: {fmtNumber(payload[0]?.value)}
      </div>
    </div>
  );
};

export function EflBarChart({ rows, topN = 10 }: EflBarChartProps) {
  const data = rows
    .filter(
      (r) =>
        r.CUSTOMER_NAME != null &&
        r.expected_financial_loss != null &&
        Number(r.expected_financial_loss) > 0,
    )
    .slice(0, topN)
    .map((r) => ({
      name: String(r.CUSTOMER_NAME || r.ACCOUNT_NUMBER || "Unknown"),
      efl: Number(r.expected_financial_loss),
      risk: String(r.risk_level || "LOW"),
    }))
    .sort((a, b) => b.efl - a.efl);

  if (data.length === 0) return null;

  const riskToColor: Record<string, string> = {
    HIGH: "#ef4444",
    MEDIUM: "#f59e0b",
    LOW: "#10b981",
  };

  const trimName = (name: string) =>
    name.length > 22 ? name.slice(0, 20) + "…" : name;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Top Expected Financial Loss
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {data.length} invoice dengan potensi kerugian tertinggi
        </p>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={(v) => fmtNumber(v)}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tickFormatter={trimName}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="efl" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={riskToColor[entry.risk] || "#6b7280"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
