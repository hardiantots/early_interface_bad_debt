"use client";

import React, { useState, useMemo } from "react";
import { SortDirection } from "@/types";
import { fmtNumber, fmtProb, riskColor, niceHeader } from "@/lib/utils";

interface DataTableProps {
  rows: Record<string, unknown>[];
  title: string;
  subtitle?: string;
  priorityCols?: string[];
  isServerMode?: boolean;
  serverPagination?: {
    page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
  };
  serverSearch?: string;
  onSearchChange?: (value: string) => void;
  serverSort?: {
    key: string;
    direction: SortDirection;
  };
  onSortChange?: (key: string, direction: SortDirection) => void;
  onPageChange?: (page: number) => void;
}

export function DataTable({
  rows,
  title,
  subtitle,
  priorityCols,
  isServerMode = false,
  serverPagination,
  serverSearch,
  onSearchChange,
  serverSort,
  onSortChange,
  onPageChange,
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: SortDirection;
  }>({ key: "", direction: null });
  const rowsPerPage = 25;

  const columns = useMemo(() => {
    if (!rows.length) return [];
    const allKeys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
    const prio = (priorityCols || []).filter((k) => allKeys.has(k));
    const rest = [...allKeys].filter((k) => !prio.includes(k));
    return [...prio, ...rest];
  }, [rows, priorityCols]);

  const filteredAndSorted = useMemo(() => {
    if (isServerMode) return rows;

    let result = rows;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((k) =>
          String(row[k] ?? "")
            .toLowerCase()
            .includes(q),
        ),
      );
    }

    // Sorting
    if (sortConfig.key && sortConfig.direction !== null) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === "asc" ? 1 : -1;
        if (bVal == null) return sortConfig.direction === "asc" ? -1 : 1;

        // Attempt numeric comparison
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const isNumeric =
          !isNaN(aNum) && !isNaN(bNum) && aVal !== "" && bVal !== "";

        if (isNumeric) {
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, search, columns, sortConfig]);

  const requestSort = (key: string) => {
    const baseSort = isServerMode ? (serverSort || { key: "", direction: null }) : sortConfig;

    let direction: SortDirection = "asc";
    if (baseSort.key === key && baseSort.direction === "asc") {
      direction = "desc";
    } else if (baseSort.key === key && baseSort.direction === "desc") {
      direction = null;
    }

    if (isServerMode) {
      onSortChange?.(key, direction);
      onPageChange?.(1);
    } else {
      setSortConfig({ key, direction });
      setPage(1);
    }
  };

  const getSortIcon = (key: string) => {
    const activeSort = isServerMode ? (serverSort || { key: "", direction: null }) : sortConfig;

    if (activeSort.key !== key || activeSort.direction === null) {
      return <span className="text-gray-600 opacity-50 ml-1">⇅</span>;
    }
    return activeSort.direction === "asc" ? (
      <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">↑</span>
    ) : (
      <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">↓</span>
    );
  };

  if (!rows.length) return null;

  const totalPages = isServerMode
    ? Math.max(1, serverPagination?.total_pages || 1)
    : Math.max(1, Math.ceil(filteredAndSorted.length / rowsPerPage));

  const currentRows = isServerMode
    ? filteredAndSorted
    : filteredAndSorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const activePage = isServerMode ? Math.max(1, serverPagination?.page || 1) : page;
  const activePageSize = isServerMode
    ? Math.max(1, serverPagination?.page_size || rowsPerPage)
    : rowsPerPage;
  const activeTotal = isServerMode
    ? Math.max(0, serverPagination?.total_records || 0)
    : filteredAndSorted.length;

  const fromIdx =
    activeTotal === 0 ? 0 : (activePage - 1) * activePageSize + 1;
  const toIdx = Math.min(activePage * activePageSize, activeTotal);

  const searchValue = isServerMode ? (serverSearch || "") : search;

  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {activeTotal} rows
          </span>
          <input
            type="text"
            placeholder="Search all..."
            value={searchValue}
            onChange={(e) => {
              if (isServerMode) {
                onSearchChange?.(e.target.value);
                onPageChange?.(1);
              } else {
                setSearch(e.target.value);
                setPage(1);
              }
            }}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 
                       placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-gray-900/40">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => requestSort(col)}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-800/60 transition-colors select-none group"
                >
                  <div className="flex items-center">
                    {niceHeader(col)}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {getSortIcon(col)}
                    </span>
                    <span
                      className={`transition-opacity ${(isServerMode ? (serverSort?.key === col && serverSort?.direction !== null) : (sortConfig.key === col && sortConfig.direction !== null)) ? "opacity-100" : "opacity-0 hidden"}`}
                    >
                      {getSortIcon(col)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
              >
                {columns.map((col) => {
                  const val = row[col];
                  const isRisk =
                    col === "risk_level" ||
                    col === "risk_cust" ||
                    col === "risk_ew";
                  const isProb =
                    col === "prob_bad_debt" || col.startsWith("cust_score_");
                  const isAmount =
                    col === "TRX_AMOUNT" ||
                    col === "total_amount" ||
                    col === "expected_financial_loss";

                  return (
                    <td key={col} className="px-3 py-2 whitespace-nowrap">
                      {isRisk && val ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${riskColor(String(val))}`}
                        >
                          {String(val)}
                        </span>
                      ) : isProb ? (
                        <span className="font-mono text-xs">
                          {fmtProb(val)}
                        </span>
                      ) : isAmount ? (
                        <span className="font-mono text-xs">
                          {fmtNumber(val)}
                        </span>
                      ) : val == null ? (
                        <span className="text-gray-600">—</span>
                      ) : (
                        <span className="text-xs">{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-3 bg-white/40 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-gray-500">
          Showing {fromIdx} to {toIdx} of {activeTotal} rows
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isServerMode) {
                onPageChange?.(Math.max(1, activePage - 1));
              } else {
                setPage((p) => Math.max(1, p - 1));
              }
            }}
            disabled={activePage === 1}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-700 rounded transition-colors text-gray-700 dark:text-gray-300 font-medium"
          >
            Previous
          </button>
          <div className="px-3 font-medium text-gray-600 dark:text-gray-400">
            Page{" "}
            <span className="text-gray-800 dark:text-gray-200">{activePage}</span> of{" "}
            {totalPages}
          </div>
          <button
            onClick={() => {
              if (isServerMode) {
                onPageChange?.(Math.min(totalPages, activePage + 1));
              } else {
                setPage((p) => Math.min(totalPages, p + 1));
              }
            }}
            disabled={activePage === totalPages}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-700 rounded transition-colors text-gray-700 dark:text-gray-300 font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
