import React from "react";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  variant?: "danger" | "warning" | "success" | "default";
}

const VARIANT_STYLES: Record<string, string> = {
  danger:
    "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-900/10",
  warning:
    "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/10",
  success:
    "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/10",
  default:
    "border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/80",
};

const VALUE_STYLES: Record<string, string> = {
  danger: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  success: "text-emerald-700 dark:text-emerald-400",
  default: "text-gray-900 dark:text-gray-100",
};

export function StatCard({ icon, label, value, variant = "default" }: StatCardProps) {
  const borderBg = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;
  const valueColor = VALUE_STYLES[variant] ?? VALUE_STYLES.default;

  return (
    <div
      className={`rounded-xl p-4 border backdrop-blur-sm flex items-center gap-3 min-w-0 transition-all hover:shadow-md ${borderBg}`}
    >
      <span className="text-2xl shrink-0 select-none">{icon}</span>
      <div className="min-w-0">
        <div className={`text-lg font-bold truncate leading-tight ${valueColor}`}>
          {String(value)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}
