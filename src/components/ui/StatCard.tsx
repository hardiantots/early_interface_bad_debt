import React from "react";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  variant?: "danger" | "warning" | "success" | "default";
}

export function StatCard({
  icon,
  label,
  value,
  variant,
}: StatCardProps) {
  const border =
    variant === "danger"
      ? "border-red-500/30"
      : variant === "warning"
        ? "border-amber-500/30"
        : variant === "success"
          ? "border-emerald-500/30"
          : "border-gray-700/50";
  return (
    <div
      className={`bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border ${border} flex items-center gap-3 min-w-0`}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold truncate">{String(value)}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}
