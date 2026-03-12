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
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Risk Breakdown
      </h3>
      <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        {high > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center text-xs font-bold text-white transition-all"
            style={{ width: `${(high / total) * 100}%` }}
          >
            {high}
          </div>
        )}
        {med > 0 && (
          <div
            className="bg-amber-500 flex items-center justify-center text-xs font-bold text-gray-900 transition-all"
            style={{ width: `${(med / total) * 100}%` }}
          >
            {med}
          </div>
        )}
        {low > 0 && (
          <div
            className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white transition-all"
            style={{ width: `${(low / total) * 100}%` }}
          >
            {low}
          </div>
        )}
      </div>
      <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        {high > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            HIGH {high} ({((high / total) * 100).toFixed(1)}%)
          </span>
        )}
        {med > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            MEDIUM {med} ({((med / total) * 100).toFixed(1)}%)
          </span>
        )}
        {low > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            LOW {low} ({((low / total) * 100).toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
}
