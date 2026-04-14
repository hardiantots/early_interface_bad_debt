import React from "react";

interface RiskBarProps {
  summary: Record<string, number>;
}

export function RiskBar({ summary }: RiskBarProps) {
  const high = summary?.HIGH || 0;
  const med = summary?.MEDIUM || 0;
  const low = summary?.LOW || 0;
  const total = high + med + low || 1;

  return (
    <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Risk Breakdown — Invoice Level
      </h3>
      <div className="flex h-7 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 gap-0.5">
        {high > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center text-xs font-bold text-white transition-all rounded-l-full"
            style={{ width: `${(high / total) * 100}%` }}
            title={`HIGH: ${high}`}
          >
            {(high / total) > 0.08 ? high : ""}
          </div>
        )}
        {med > 0 && (
          <div
            className="bg-amber-500 flex items-center justify-center text-xs font-bold text-white transition-all"
            style={{ width: `${(med / total) * 100}%` }}
            title={`MEDIUM: ${med}`}
          >
            {(med / total) > 0.08 ? med : ""}
          </div>
        )}
        {low > 0 && (
          <div
            className={`bg-emerald-500 flex items-center justify-center text-xs font-bold text-white transition-all ${!high && !med ? "rounded-full" : "rounded-r-full"}`}
            style={{ width: `${(low / total) * 100}%` }}
            title={`LOW: ${low}`}
          >
            {(low / total) > 0.08 ? low : ""}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        {high > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <span className="text-red-700 dark:text-red-400 font-semibold">HIGH</span>
            <span>{high} ({((high / total) * 100).toFixed(1)}%)</span>
          </span>
        )}
        {med > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-400 font-semibold">MEDIUM</span>
            <span>{med} ({((med / total) * 100).toFixed(1)}%)</span>
          </span>
        )}
        {low > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">LOW</span>
            <span>{low} ({((low / total) * 100).toFixed(1)}%)</span>
          </span>
        )}
      </div>
    </div>
  );
}
