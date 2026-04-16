"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { fmtNumber, fmtProb } from "@/lib/utils";

interface RiskMatrixChartProps {
  rows: Record<string, unknown>[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | string;
    payload: {
      name: string;
      prob: number;
      efl: number;
      risk: string;
    };
  }>;
}

const riskToColor: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#10b981",
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
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
        maxWidth: 240,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="font-semibold text-gray-800 truncate mb-1">
        {data.name}
      </div>
      <div className="flex flex-col gap-1 mt-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Exp. Loss:</span>
          <span className="font-medium text-red-600">
            {fmtNumber(data.efl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Probability:</span>
          <span className="font-medium text-blue-600">
            {fmtProb(data.prob)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-gray-100 pt-1 mt-1 text-xs">
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

export const RiskMatrixChart = React.memo(function RiskMatrixChart({ rows }: RiskMatrixChartProps) {
  const data = rows
    .filter(
      (r) =>
        r.prob_bad_debt != null &&
        r.expected_financial_loss != null &&
        !isNaN(Number(r.prob_bad_debt)) &&
        !isNaN(Number(r.expected_financial_loss))
    )
    .map((r) => ({
      name: String(r.CUSTOMER_NAME || r.ACCOUNT_NUMBER || r.CUSTOMER_TRX_ID || "Unknown"),
      prob: Number(r.prob_bad_debt),
      efl: Number(r.expected_financial_loss),
      risk: String(r.risk_level || "LOW"),
    }));

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Risk Matrix (EFL vs Probability)
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Persebaran invoice berdampak tinggi (pojok kanan atas)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
          <XAxis 
            type="number" 
            dataKey="prob" 
            name="Probability" 
            domain={[0, 1]} 
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            label={{ value: 'Probability', position: 'bottom', offset: 0, fontSize: 10, fill: "#9ca3af" }}
          />
          <YAxis 
            type="number" 
            dataKey="efl" 
            name="Exp. Loss" 
            tickFormatter={(v) => {
              if (v >= 1000000) return `Rp${(v / 1000000).toFixed(0)}M`;
              if (v >= 1000) return `Rp${(v / 1000).toFixed(0)}K`;
              return `Rp${v}`;
            }}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
            width={60}
          />
          <ZAxis type="number" range={[60, 60]} />
          <Tooltip 
            cursor={{ strokeDasharray: "3 3" }} 
            content={<CustomTooltip />} 
          />
          <Scatter name="Invoices" data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={riskToColor[entry.risk] || "#6b7280"} 
                fillOpacity={0.7} 
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});
