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
import { fmtNumber, fmtProb } from "@/lib/utils";

interface EflBarChartProps {
  rows: Record<string, unknown>[];
  topN?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      name: string;
      efl: number;
      prob: number;
      trx_amount: number;
      risk: string;
    };
  }>;
  label?: string;
}

const riskToColor: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        color: "#111",
        maxWidth: 260,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div className="font-semibold text-gray-800 truncate max-w-[240px] mb-1.5">
        {label}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Expected Loss:</span>
          <span className="font-medium text-red-600 dark:text-red-500">
            {fmtNumber(data.efl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">TRX Amount:</span>
          <span className="font-medium text-gray-700">
            {fmtNumber(data.trx_amount)}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs mt-1 pt-1 border-t border-gray-100">
          <span className="text-gray-500">Probability:</span>
          <span className="font-medium text-blue-600">
            {fmtProb(data.prob)}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-gray-500">Risk Level:</span>
          <span 
            className="font-bold uppercase" 
            style={{ color: riskToColor[data.risk] || "#6b7280" }}
          >
            {data.risk}
          </span>
        </div>
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
    .sort((a, b) => Number(b.expected_financial_loss) - Number(a.expected_financial_loss))
    .slice(0, topN)
    .map((r) => ({
      name: String(r.CUSTOMER_NAME || r.ACCOUNT_NUMBER || "Unknown"),
      efl: Number(r.expected_financial_loss),
      prob: Number(r.prob_bad_debt || 0),
      trx_amount: Number(r.TRX_AMOUNT || 0),
      risk: String(r.risk_level || "LOW"),
    }))
    .reverse();

  if (data.length === 0) return null;

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

      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" opacity={0.5} />
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
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: "transparent" }}
          />
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
