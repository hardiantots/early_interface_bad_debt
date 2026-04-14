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

interface ActionBarChartProps {
  rows: Record<string, unknown>[];
}

const COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#64748b", // slate
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        color: "#111",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div className="font-semibold text-gray-800 mb-1">{data.action}</div>
      <div className="flex justify-between gap-4 font-medium text-blue-600">
        <span className="text-gray-500 font-normal">Jumlah Invoice:</span>
        <span>{data.count}</span>
      </div>
    </div>
  );
};

export function ActionBarChart({ rows }: ActionBarChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const action = String(r.recommended_action || "Unknown");
      counts[action] = (counts[action] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .reverse();
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Recommended Action Distribution
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Distribusi rekomendasi tindakan penagihan untuk invoice
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} horizontal={true} vertical={false} />
          <XAxis 
            type="number" 
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis 
            type="category" 
            dataKey="action" 
            tick={{ fontSize: 10, fill: "#4b5563", fontWeight: 500 }}
            width={120}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "#f3f4f6", opacity: 0.4 }} content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
