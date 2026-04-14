"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { StatCard } from "@/components/ui/StatCard";
import { RiskBar } from "@/components/ui/RiskBar";
import { RiskDonut } from "@/components/ui/RiskDonut";
import { EflBarChart } from "@/components/ui/EflBarChart";
import { ScoreDistribution } from "@/components/ui/ScoreDistribution";
import { DataTable } from "@/components/ui/DataTable";
import {
  ComputeJobStatus,
  ComputeTriggerResponse,
  PaginationMeta,
  ScoringResult,
  TimeRange,
} from "@/types";

// ── Config ─────────────────────────────────────────────────────────────
const normalizeApiBase = (value?: string): string => {
  const raw = String(value || "").trim();
  if (!raw) return "http://localhost:8000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withProtocol.replace(/\/+$/, "");
};

const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE);

const getTodayISO = () => new Date().toISOString().slice(0, 10);

type ProcessLog = {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
};

type EndpointMode = "score" | "alerts" | "receipt_trigger";

const NON_LOW_RISKS = new Set(["HIGH", "MEDIUM"]);

const normalizeRisk = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const getRowRisk = (row: Record<string, unknown>): string =>
  normalizeRisk(row.risk_level ?? row.risk_ew ?? row.risk_cust);

const isNonLowRiskRow = (
  row: Record<string, unknown>,
  threshold: number,
): boolean => {
  const risk = getRowRisk(row);
  if (risk) {
    return NON_LOW_RISKS.has(risk);
  }
  const prob = Number(row.prob_bad_debt);
  return Number.isFinite(prob) ? prob >= threshold : false;
};

const summarizeRowsByRisk = (
  rows: Record<string, unknown>[],
): Record<string, number> => {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const risk = getRowRisk(row);
    if (!risk) return acc;
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {});
};

const selectInvoiceRows = (
  result: ScoringResult | null,
  endpoint: EndpointMode,
  threshold: number,
): Record<string, unknown>[] => {
  if (!result) return [];

  const baseRows =
    endpoint === "alerts"
      ? (result.alerts ?? [])
      : endpoint === "receipt_trigger"
        ? (result.all_scores_preview ?? [])
        : (result.preview ?? []);

  if (endpoint === "score") {
    return baseRows;
  }
  return baseRows.filter((row) => isNonLowRiskRow(row, threshold));
};

// ── Main Page ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const defaultPagination: PaginationMeta = {
    page: 1,
    page_size: 50,
    total_records: 0,
    total_pages: 1,
  };

  // ── Preferences ──────────────────────────────────────────────────────
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([
    { key: "1w", label: "1 minggu terakhir" },
    { key: "2w", label: "2 minggu terakhir" },
    { key: "1m", label: "1 bulan terakhir" },
    { key: "3m", label: "3 bulan terakhir" },
    { key: "6m", label: "6 bulan terakhir" },
    { key: "1y", label: "1 tahun terakhir" },
    { key: "all", label: "Semua data (terlama s/d terbaru)" },
  ]);
  const [selectedTimeRange, setSelectedTimeRange] = useState("1w");
  const [models, setModels] = useState<{ key: string; label: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState("stacked");
  const [snapshotDate, setSnapshotDate] = useState(getTodayISO());
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Light theme is the default
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [threshold, setThreshold] = useState(0.3);

  // ── UI State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [customerRows, setCustomerRows] = useState<Record<string, unknown>[]>([]);
  const [customerRiskSummary, setCustomerRiskSummary] = useState<Record<string, number> | null>(null);
  const [invoicePagination, setInvoicePagination] = useState<PaginationMeta>(defaultPagination);
  const [customerPagination, setCustomerPagination] = useState<PaginationMeta>(defaultPagination);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize] = useState(50);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSortBy, setInvoiceSortBy] = useState("prob_bad_debt");
  const [invoiceSortOrder, setInvoiceSortOrder] = useState<"asc" | "desc">("desc");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize] = useState(50);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSortBy, setCustomerSortBy] = useState("cust_score_max");
  const [customerSortOrder, setCustomerSortOrder] = useState<"asc" | "desc">("desc");
  const [computeStatus, setComputeStatus] = useState<ComputeJobStatus | null>(null);
  const [computeMessage, setComputeMessage] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>([]);
  const [activeEndpoint, setActiveEndpoint] = useState<EndpointMode>("score");
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"invoice" | "customer">("invoice");

  // ── Refs ──────────────────────────────────────────────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPolledStatusRef = useRef<string | null>(null);
  const terminalBodyRef = useRef<HTMLDivElement | null>(null);

  // ── Theme ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // ── Logging ───────────────────────────────────────────────────────────
  const appendLog = useCallback(
    (level: ProcessLog["level"], message: string) => {
      const ts = new Date().toLocaleTimeString("id-ID", { hour12: false });
      setProcessLogs((prev) => {
        const next = [...prev, { ts, level, message }];
        return next.slice(-120);
      });
    },
    [],
  );

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalOpen && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [processLogs, terminalOpen]);

  // ── API Status Monitor ────────────────────────────────────────────────
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { method: "GET" });
        setApiStatus(res.ok ? "connected" : "disconnected");
      } catch {
        setApiStatus("disconnected");
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Load Config from API ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then((r) => r.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.models[0].key);
        }
        if (data.time_ranges) setTimeRanges(data.time_ranges);
        if (data.min_date) {
          setMinDate(data.min_date);
          setStartDate((prev) => prev || data.min_date);
        }
        if (data.max_date) {
          setMaxDate(data.max_date);
          setEndDate((prev) => prev || data.max_date);
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch Customer Risk ───────────────────────────────────────────────
  const fetchCustomerRisk = useCallback(
    async (opts?: {
      timeRange?: string;
      modelKey?: string;
      page?: number;
      pageSize?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }) => {
      const tr = opts?.timeRange ?? selectedTimeRange;
      const mk = opts?.modelKey ?? selectedModel;
      const page = opts?.page ?? customerPage;
      const pageSize = opts?.pageSize ?? customerPageSize;
      const search = opts?.search ?? customerSearch;
      const sortBy = opts?.sortBy ?? customerSortBy;
      const sortOrder = opts?.sortOrder ?? customerSortOrder;

      const params = new URLSearchParams({
        model: mk,
        snapshot_date: snapshotDate,
        time_range: tr,
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (tr === "custom") {
        params.set("start_date", startDate);
        params.set("end_date", endDate);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }

      const resp = await fetch(`${API_BASE}/db/customer_risk?${params}`);
      const data = (await resp.json()) as
        | ScoringResult
        | (ComputeTriggerResponse & { error?: string; detail?: string });

      if (resp.status === 202 && "status" in data && data.status === "running") {
        setCustomerRows([]);
        setCustomerRiskSummary(null);
        setCustomerPagination(defaultPagination);
        setComputeStatus((prev) => {
          if (data.job_id) {
            return { job_id: data.job_id, status: "running" };
          }
          return prev?.job_id
            ? { job_id: prev.job_id, status: "running" }
            : prev;
        });
        setComputeMessage(
          data.message || "Customer risk sedang dipersiapkan di background.",
        );
        appendLog(
          "warn",
          data.message || "Customer risk belum tersedia, compute sedang berjalan.",
        );
        return;
      }

      if (!resp.ok || (data as { error?: string }).error) {
        setCustomerRows([]);
        setCustomerRiskSummary(null);
        setCustomerPagination(defaultPagination);
        const detail =
          "detail" in data && data.detail
            ? data.detail
            : "Customer risk belum tersedia pada sumber lokal.";
        appendLog("warn", detail);
        return;
      }

      const scoringData = data as ScoringResult;
      setCustomerRows(scoringData.customer_risk || []);
      setCustomerRiskSummary(scoringData.customer_risk_summary || null);
      setCustomerPagination(scoringData.pagination || defaultPagination);
    },
    [
      selectedTimeRange,
      selectedModel,
      snapshotDate,
      startDate,
      endDate,
      customerPage,
      customerPageSize,
      customerSearch,
      customerSortBy,
      customerSortOrder,
      appendLog,
    ],
  );

  // ── Trigger Compute ───────────────────────────────────────────────────
  const triggerCompute = useCallback(async () => {
    setLoading(true);
    setNotice("Memicu perhitungan data terbaru...");
    setError(null);
    appendLog("info", "Manual trigger compute started.");

    try {
      const params = new URLSearchParams({
        model: selectedModel,
        time_range: selectedTimeRange,
      });
      if (snapshotDate) params.set("snapshot_date", snapshotDate);
      if (selectedTimeRange === "custom") {
        params.set("start_date", startDate);
        params.set("end_date", endDate);
      }

      const resp = await fetch(`${API_BASE}/db/compute?${params}`, {
        method: "POST",
      });
      const data = await resp.json();

      if (resp.status === 202 || resp.ok) {
        setComputeStatus({ job_id: data.job_id, status: "running" });
        setComputeMessage(data.message || "Compute berjalan di background...");
        appendLog("info", "Compute job didaftarkan: " + data.job_id);
      } else {
        setNotice("Compute task gagal didaftarkan.");
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [selectedModel, selectedTimeRange, snapshotDate, startDate, endDate, appendLog]);

  // ── Run Scoring ───────────────────────────────────────────────────────
  const runScoring = useCallback(
    async (
      endpoint: "score" | "alerts" | "receipt_trigger" = "score",
      opts?: { timeRange?: string; thresh?: number; modelKey?: string },
    ) => {
      if (scoreRetryTimerRef.current) {
        clearTimeout(scoreRetryTimerRef.current);
        scoreRetryTimerRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoading(true);
      setError(null);
      setNotice(null);

      const tr = opts?.timeRange ?? selectedTimeRange;
      const th = opts?.thresh ?? threshold;
      const mk = opts?.modelKey ?? selectedModel;

      const params = new URLSearchParams({
        model: mk,
        snapshot_date: snapshotDate,
        time_range: tr,
        page: String(invoicePage),
        page_size: String(invoicePageSize),
        sort_by: invoiceSortBy,
        sort_order: invoiceSortOrder,
      });
      if (tr === "custom") {
        params.set("start_date", startDate);
        params.set("end_date", endDate);
      }
      if (invoiceSearch.trim()) {
        params.set("search", invoiceSearch.trim());
      }

      let path = "/db/score";
      if (endpoint === "alerts") {
        path = "/db/alerts";
        params.set("threshold", String(th));
      } else if (endpoint === "receipt_trigger") {
        path = "/db/early_warning/receipt_trigger";
      }

      appendLog("info", `Request ${endpoint} dimulai (range=${tr}, model=${mk})`);

      try {
        const resp = await fetch(`${API_BASE}${path}?${params}`, {
          signal: abortController.signal,
        });
        const data = (await resp.json()) as ScoringResult & ComputeTriggerResponse;

        if (resp.status === 202 && data.status === "running") {
          setNotice("Data belum tersedia. Sistem sedang menyiapkan hasil compute.");
          setComputeStatus((prev) => {
            if (data.job_id) {
              return { job_id: data.job_id, status: "running" };
            }
            return prev?.job_id
              ? { job_id: prev.job_id, status: "running" }
              : prev;
          });
          setComputeMessage(
            data.message || "Compute sedang berjalan. Menunggu hasil pertama...",
          );
          appendLog("info", data.message || "Compute berjalan di background");

          scoreRetryTimerRef.current = setTimeout(() => {
            runScoring(endpoint, { timeRange: tr, modelKey: mk, thresh: th });
          }, 4000);
          return;
        }

        if (!resp.ok) {
          if (resp.status === 404 && data.error?.includes("No pre-computed")) {
            setResult(null);
            setCustomerRows([]);
            setCustomerRiskSummary(null);
            setInvoicePagination(defaultPagination);
            setCustomerPagination(defaultPagination);
            setNotice(
              "Data untuk filter ini belum tersedia. Sistem akan menyiapkan compute otomatis.",
            );
            appendLog("warn", "Data belum ada untuk filter saat ini");
            return;
          }
          setError(data.error || `Request failed (${resp.status})`);
          appendLog("error", data.error || `Request gagal (${resp.status})`);
          return;
        }

        if (data.error) {
          setError(data.error);
          appendLog("error", data.error);
        } else {
          if (scoreRetryTimerRef.current) {
            clearTimeout(scoreRetryTimerRef.current);
            scoreRetryTimerRef.current = null;
          }
          setResult(data);
          setInvoicePagination(data.pagination || defaultPagination);
          await fetchCustomerRisk({ timeRange: tr, modelKey: mk });
          const effectiveSnapshot =
            data.effective_snapshot_date || data.snapshot_date;
          if (effectiveSnapshot && effectiveSnapshot !== snapshotDate) {
            setNotice(
              `Data prediksi dibaca dari publish terbaru (snapshot efektif ${effectiveSnapshot}).`,
            );
            appendLog(
              "warn",
              `Snapshot efektif dari MySQL publish: ${effectiveSnapshot} (request: ${snapshotDate})`,
            );
          }
          const rowsLen =
            (data.preview?.length || 0) +
            (data.alerts?.length || 0) +
            (data.all_scores_preview?.length || 0);
          if (rowsLen === 0) {
            setNotice("Tidak ada data untuk filter ini.");
            appendLog("warn", "Fetch sukses namun tidak ada data yang cocok");
          } else {
            setNotice(null);
            appendLog("info", `Fetch sukses: ${rowsLen} baris dimuat`);
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          appendLog("info", "Request dibatalkan karena ada request baru");
          return;
        }
        setError(
          `Connection failed. Make sure FastAPI is running on ${API_BASE}. Error: ${e instanceof Error ? e.message : String(e)}`,
        );
        appendLog(
          "error",
          `Koneksi API gagal: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          setLoading(false);
        }
      }
    },
    [
      snapshotDate,
      selectedTimeRange,
      threshold,
      selectedModel,
      startDate,
      endDate,
      invoicePage,
      invoicePageSize,
      invoiceSearch,
      invoiceSortBy,
      invoiceSortOrder,
      fetchCustomerRisk,
      appendLog,
    ],
  );

  // ── Compute Polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!computeStatus?.job_id || computeStatus.status !== "running") {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const resp = await fetch(
          `${API_BASE}/db/compute/status/${computeStatus.job_id}`,
        );
        const data = (await resp.json()) as ComputeJobStatus & {
          error?: string;
        };
        if (!resp.ok || data.error) return;

        setComputeStatus(data);
        if (data.status !== lastPolledStatusRef.current) {
          lastPolledStatusRef.current = data.status;
          appendLog("info", `Job ${data.job_id} status: ${data.status}`);
        }
        if (data.status === "completed") {
          setComputeMessage("Compute selesai. Data terbaru sedang dimuat...");
          appendLog("info", "Compute selesai. Melakukan refresh data...");
          await runScoring(activeEndpoint, {
            timeRange: selectedTimeRange,
            modelKey: selectedModel,
            thresh: threshold,
          });
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        } else if (data.status === "failed") {
          setError(`Compute failed: ${data.error_message || "Unknown error"}`);
          appendLog(
            "error",
            `Compute gagal: ${data.error_message || "Unknown error"}`,
          );
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      } catch {
        appendLog("warn", "Polling status compute tertunda (API sibuk)");
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, 5000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [
    computeStatus?.job_id,
    computeStatus?.status,
    activeEndpoint,
    runScoring,
    selectedTimeRange,
    selectedModel,
    threshold,
    appendLog,
  ]);

  // ── Auto-Load on Mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialLoaded) {
      setInitialLoaded(true);
      runScoring("score");
    }
  }, [initialLoaded, runScoring]);

  // ── Re-fetch on Filter Change ─────────────────────────────────────────
  useEffect(() => {
    if (!initialLoaded) return;
    runScoring(activeEndpoint, {
      timeRange: selectedTimeRange,
      modelKey: selectedModel,
    });
  }, [
    invoicePage,
    invoiceSearch,
    invoiceSortBy,
    invoiceSortOrder,
    initialLoaded,
    activeEndpoint,
    selectedTimeRange,
    selectedModel,
    runScoring,
  ]);

  useEffect(() => {
    if (!initialLoaded) return;
    fetchCustomerRisk();
  }, [
    customerPage,
    customerSearch,
    customerSortBy,
    customerSortOrder,
    initialLoaded,
    fetchCustomerRisk,
  ]);

  // ── CSV Download ──────────────────────────────────────────────────────
  const downloadCsv = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      model: selectedModel,
      snapshot_date: snapshotDate,
      time_range: selectedTimeRange,
    });
    if (selectedTimeRange === "custom") {
      params.set("start_date", startDate);
      params.set("end_date", endDate);
    }
    try {
      const resp = await fetch(`${API_BASE}/db/score_csv?${params}`);
      if (!resp.ok) {
        const text = await resp.text();
        setError(text);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bad_debt_${selectedTimeRange}_${snapshotDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Download failed: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [snapshotDate, selectedTimeRange, selectedModel, startDate, endDate]);

  // ── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (scoreRetryTimerRef.current) {
        clearTimeout(scoreRetryTimerRef.current);
      }
    };
  }, []);

  // ── Derived State ─────────────────────────────────────────────────────
  const invoiceRows = useMemo(
    () => selectInvoiceRows(result, activeEndpoint, threshold),
    [result, activeEndpoint, threshold],
  );

  const displayedRiskSummary = useMemo(() => {
    if (activeEndpoint === "score") {
      return result?.risk_summary || null;
    }
    return invoiceRows.length > 0 ? summarizeRowsByRisk(invoiceRows) : null;
  }, [activeEndpoint, result?.risk_summary, invoiceRows]);

  const topEflRows = useMemo(() => {
    const rows = result?.top_efl_invoices || [];
    if (activeEndpoint === "score") return rows;
    return rows.filter((row) => isNonLowRiskRow(row, threshold));
  }, [result?.top_efl_invoices, activeEndpoint, threshold]);

  const displayedCustomerRows = useMemo(() => {
    if (activeEndpoint === "score") return customerRows;
    return customerRows.filter((row) => isNonLowRiskRow(row, threshold));
  }, [activeEndpoint, customerRows, threshold]);

  const displayedCustomerRiskSummary = useMemo(() => {
    if (activeEndpoint === "score") return customerRiskSummary;
    return displayedCustomerRows.length > 0
      ? summarizeRowsByRisk(displayedCustomerRows)
      : null;
  }, [activeEndpoint, customerRiskSummary, displayedCustomerRows]);

  const hasCharts =
    (displayedRiskSummary && Object.keys(displayedRiskSummary).length > 0) ||
    topEflRows.length > 0 ||
    invoiceRows.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main
      className={`min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 ${terminalOpen ? "pb-80 sm:pb-96" : "pb-28"}`}
    >
      {/* ── Header ─── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Branding */}
            <div className="flex items-center gap-4">
              <Image
                src={
                  theme === "dark"
                    ? "/kalla_logo_new_white.png"
                    : "/kalla_logo_new.png"
                }
                alt="Kalla Group"
                width={130}
                height={52}
                className="h-10 sm:h-12 w-auto object-contain"
                priority
              />
              <div className="min-w-0">
                <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-widest uppercase">
                  Early-Warning System
                </p>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white truncate">
                  Bad Debt Risk Console
                </h1>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* API Status */}
              <div
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                title={
                  apiStatus === "connected"
                    ? "Connected to API server"
                    : apiStatus === "disconnected"
                      ? "API server offline"
                      : "Connecting..."
                }
              >
                {apiStatus === "connected" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {apiStatus === "checking" && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                {apiStatus === "disconnected" && (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
                <span className="hidden sm:inline">
                  {apiStatus === "connected"
                    ? "API Active"
                    : apiStatus === "checking"
                      ? "Checking..."
                      : "API Offline"}
                </span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Toggle Theme"
                aria-label="Toggle dark/light theme"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-28 py-6 space-y-6">
        {/* ── Control Panel ─── */}
        <section className="bg-white dark:bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            ⚙️ Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Model Selection */}
            <div className="flex flex-col">
              <label
                htmlFor="modelSelect"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Model Selection
              </label>
              <select
                id="modelSelect"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setInvoicePage(1);
                  setCustomerPage(1);
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                aria-label="Select Model"
              >
                {models.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range */}
            <div className="flex flex-col">
              <label
                htmlFor="timeRange"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Time Range
              </label>
              <select
                id="timeRange"
                value={selectedTimeRange}
                onChange={(e) => {
                  setSelectedTimeRange(e.target.value);
                  setInvoicePage(1);
                  setCustomerPage(1);
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                aria-label="Select Time Range"
              >
                {timeRanges.map((tr) => (
                  <option key={tr.key} value={tr.key}>
                    {tr.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Range */}
            {selectedTimeRange === "custom" && (
              <>
                <div className="flex flex-col">
                  <label
                    htmlFor="startDate"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
                  >
                    Dari Tanggal
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    min={minDate}
                    max={endDate || maxDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                               text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col">
                  <label
                    htmlFor="endDate"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
                  >
                    Sampai Tanggal
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    min={startDate || minDate}
                    max={maxDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                               text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* Snapshot Date */}
            <div className="flex flex-col">
              <label
                htmlFor="snapshotDate"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Snapshot Date
              </label>
              <input
                id="snapshotDate"
                type="date"
                value={snapshotDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => {
                  setSnapshotDate(e.target.value);
                  setInvoicePage(1);
                  setCustomerPage(1);
                }}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                aria-label="Select Snapshot Date"
              />
            </div>

            {/* Threshold */}
            <div className="flex flex-col sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="riskThreshold"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Alert Threshold:{" "}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {threshold.toFixed(2)}
                </span>
              </label>
              <input
                id="riskThreshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-blue-500 mt-2 cursor-grab active:cursor-grabbing"
                aria-label="Set Risk Alert Threshold"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
            <button
              id="btn-refresh-scoring"
              onClick={() => {
                setActiveEndpoint("score");
                setInvoicePage(1);
                triggerCompute();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading && activeEndpoint === "score" ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                "🔍"
              )}
              <span>Refresh Scoring</span>
            </button>

            <button
              id="btn-alerts"
              onClick={() => {
                setActiveEndpoint("alerts");
                setInvoicePage(1);
                runScoring("alerts");
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              ⚠️ <span>Alerts Only</span>
            </button>

            <button
              id="btn-early-warning"
              onClick={() => {
                setActiveEndpoint("receipt_trigger");
                setInvoicePage(1);
                runScoring("receipt_trigger");
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              🚨 <span>Early Warning</span>
            </button>

            <button
              id="btn-download-csv"
              onClick={downloadCsv}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-semibold rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              📥 <span>Download CSV</span>
            </button>
          </div>
        </section>

        {/* ── Notifications ─── */}
        {error && (
          <div
            id="alert-error"
            className="bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm flex items-start gap-3 fade-in animate-in"
          >
            <span className="text-xl shrink-0">🛑</span>
            <div>
              <strong className="block mb-1 font-semibold">
                Error Processing Request
              </strong>
              {error}
            </div>
          </div>
        )}

        {notice && !error && (
          <div
            id="alert-notice"
            className="bg-blue-50 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/30 rounded-xl p-4 text-blue-700 dark:text-blue-300 text-sm flex items-start gap-3 fade-in animate-in"
          >
            <span className="text-xl shrink-0">ℹ️</span>
            <div>{notice}</div>
          </div>
        )}

        {result?.warning && (
          <div
            id="alert-warning"
            className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-4 text-amber-700 dark:text-amber-400 text-sm flex items-start gap-3 fade-in animate-in"
          >
            <span className="text-xl shrink-0">⚠️</span>
            <div>{result.warning}</div>
          </div>
        )}

        {/* ── Compute Running Banner ─── */}
        {computeStatus?.status === "running" && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/40 rounded-xl p-4 flex items-center gap-3 text-sm text-violet-800 dark:text-violet-300">
            <span className="animate-spin w-4 h-4 border-2 border-violet-400 border-t-violet-700 dark:border-t-violet-300 rounded-full shrink-0" />
            <div>
              <strong className="font-semibold">Compute berjalan di background</strong>
              {computeMessage && (
                <span className="ml-2 opacity-80">— {computeMessage}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Loading ─── */}
        {loading && (
          <div className="flex items-center justify-center py-16 fade-in animate-in">
            <div className="text-center space-y-4">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                Loading data...
              </p>
            </div>
          </div>
        )}

        {/* ── Results ─── */}
        {result && !loading && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            {/* Meta Info Banner */}
            {result.analysis_type && (
              <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                  <div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Mode
                    </span>
                    <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                      {result.analysis_type}
                    </p>
                  </div>
                  {result.model_label && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Model
                      </span>
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                        {result.model_label}
                      </p>
                    </div>
                  )}
                  {result.effective_snapshot_date && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Snapshot
                      </span>
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                        {result.effective_snapshot_date}
                      </p>
                    </div>
                  )}
                  {result.last_computed_at && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Last Compute
                      </span>
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                        {result.last_computed_at}
                      </p>
                    </div>
                  )}
                  {result.feature_count && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Features
                      </span>
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                        {result.feature_count}
                      </p>
                    </div>
                  )}
                  {result.pagination && (
                    <div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Records
                      </span>
                      <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                        {result.pagination.total_records.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                icon="📊"
                label="Mode"
                value={
                  result.mode === "early_warning"
                    ? "Early Warning"
                    : result.mode === "snapshot"
                      ? "Snapshot"
                      : result.mode || "—"
                }
              />
              <StatCard
                icon="📅"
                label="Snapshot"
                value={
                  result.effective_snapshot_date ||
                  result.snapshot_date ||
                  "—"
                }
              />
              <StatCard
                icon="📄"
                label="Total Invoices"
                value={
                  result.total_invoices ?? result.processed_invoices ?? "—"
                }
              />
              {result.alerts_count != null && (
                <StatCard
                  icon="⚠️"
                  label="Alerts"
                  value={result.alerts_count}
                  variant="warning"
                />
              )}
              {result.high_risk_count != null && (
                <StatCard
                  icon="🔴"
                  label="High Risk"
                  value={result.high_risk_count}
                  variant="danger"
                />
              )}
            </div>

            {/* Risk Bar */}
            {displayedRiskSummary && (
              <RiskBar summary={displayedRiskSummary} />
            )}

            {/* ── Charts Section ─── */}
            {hasCharts && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  📈 <span>Data Visualisasi</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Invoice Risk Donut */}
                  {displayedRiskSummary &&
                    Object.keys(displayedRiskSummary).length > 0 && (
                      <RiskDonut
                        summary={displayedRiskSummary}
                        title="Invoice Risk Distribution"
                        subtitle="Distribusi risiko per invoice"
                      />
                    )}

                  {/* Customer Risk Donut */}
                  {displayedCustomerRiskSummary &&
                    Object.keys(displayedCustomerRiskSummary).length > 0 && (
                      <RiskDonut
                        summary={displayedCustomerRiskSummary}
                        title="Customer Risk Distribution"
                        subtitle="Distribusi risiko per customer"
                      />
                    )}

                  {/* Score Distribution */}
                  {invoiceRows.length > 0 && (
                    <ScoreDistribution rows={invoiceRows} />
                  )}

                  {/* EFL Bar Chart - spans full width when alone */}
                  {topEflRows.length > 0 && (
                    <div className="md:col-span-2 xl:col-span-3">
                      <EflBarChart rows={topEflRows} topN={10} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tables Section — Tabbed ─── */}
            <div className="space-y-4">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab("invoice")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "invoice"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  📄 Invoice Scores
                  {invoiceRows.length > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">
                      {invoicePagination.total_records > 0
                        ? invoicePagination.total_records.toLocaleString()
                        : invoiceRows.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("customer")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "customer"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  👥 Customer Risk
                  {displayedCustomerRows.length > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">
                      {customerPagination.total_records > 0
                        ? customerPagination.total_records.toLocaleString()
                        : displayedCustomerRows.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Invoice Tab */}
              {activeTab === "invoice" && (
                <div className="space-y-4">
                  {/* Top EFL table */}
                  {topEflRows.length > 0 && (
                    <DataTable
                      rows={topEflRows}
                      title="Top Expected Financial Loss"
                      subtitle="Invoice dengan potensi kerugian finansial tertinggi"
                      priorityCols={[
                        "CUSTOMER_NAME",
                        "ACCOUNT_NUMBER",
                        "CUSTOMER_TRX_ID",
                        "TRX_DATE",
                        "days_to_due",
                        "expected_financial_loss",
                        "prob_bad_debt",
                        "TRX_AMOUNT",
                        "risk_level",
                        "recommended_action",
                      ]}
                    />
                  )}

                  {/* Invoice table */}
                  {invoiceRows.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Tidak ada invoice yang cocok dengan filter saat ini.
                    </div>
                  ) : (
                    <DataTable
                      rows={invoiceRows}
                      title="Invoice Scores"
                      subtitle="Hasil prediksi per invoice"
                      isServerMode={activeEndpoint === "score"}
                      serverPagination={invoicePagination}
                      serverSearch={invoiceSearch}
                      onSearchChange={(value) => {
                        setInvoiceSearch(value);
                        setInvoicePage(1);
                      }}
                      serverSort={{ key: invoiceSortBy, direction: invoiceSortOrder }}
                      onSortChange={(key, direction) => {
                        if (!direction) {
                          setInvoiceSortBy("prob_bad_debt");
                          setInvoiceSortOrder("desc");
                        } else {
                          setInvoiceSortBy(key);
                          setInvoiceSortOrder(direction);
                        }
                      }}
                      onPageChange={(page) => setInvoicePage(page)}
                      priorityCols={[
                        "CUSTOMER_NAME",
                        "ACCOUNT_NUMBER",
                        "CUSTOMER_TRX_ID",
                        "TRX_DATE",
                        "days_to_due",
                        "TRX_AMOUNT",
                        "prob_bad_debt",
                        "risk_level",
                        "recommended_action",
                      ]}
                    />
                  )}
                </div>
              )}

              {/* Customer Tab */}
              {activeTab === "customer" && (
                <div className="space-y-4">
                  {/* Customer Summary Cards */}
                  {displayedCustomerRiskSummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard
                        icon="👥"
                        label="Total Customers"
                        value={
                          activeEndpoint === "score"
                            ? customerPagination.total_records ||
                              customerRows.length
                            : displayedCustomerRows.length
                        }
                      />
                      {displayedCustomerRiskSummary.HIGH != null && (
                        <StatCard
                          icon="🔴"
                          label="High Risk"
                          value={displayedCustomerRiskSummary.HIGH}
                          variant="danger"
                        />
                      )}
                      {displayedCustomerRiskSummary.MEDIUM != null && (
                        <StatCard
                          icon="🟠"
                          label="Medium Risk"
                          value={displayedCustomerRiskSummary.MEDIUM}
                          variant="warning"
                        />
                      )}
                      {displayedCustomerRiskSummary.LOW != null && (
                        <StatCard
                          icon="🟢"
                          label="Low Risk"
                          value={displayedCustomerRiskSummary.LOW}
                          variant="success"
                        />
                      )}
                    </div>
                  )}

                  {displayedCustomerRows.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Data customer risk belum tersedia.
                    </div>
                  ) : (
                    <DataTable
                      rows={displayedCustomerRows}
                      title="Customer Risk List"
                      subtitle="Agregasi prediksi risiko per customer"
                      isServerMode={activeEndpoint === "score"}
                      serverPagination={customerPagination}
                      serverSearch={customerSearch}
                      onSearchChange={(value) => {
                        setCustomerSearch(value);
                        setCustomerPage(1);
                      }}
                      serverSort={{ key: customerSortBy, direction: customerSortOrder }}
                      onSortChange={(key, direction) => {
                        if (!direction) {
                          setCustomerSortBy("cust_score_max");
                          setCustomerSortOrder("desc");
                        } else {
                          setCustomerSortBy(key);
                          setCustomerSortOrder(direction);
                        }
                      }}
                      onPageChange={(page) => setCustomerPage(page)}
                      priorityCols={[
                        "CUSTOMER_NAME",
                        "ACCOUNT_NUMBER",
                        "PARTY_ID",
                        "cust_score_max",
                        "cust_score_mean",
                        "cust_score_wavg_amount",
                        "risk_cust",
                        "invoice_cnt",
                        "total_amount",
                        "paid_ratio_pre_due_total",
                        "pct_invoices_gap_gt_90_pre_due",
                      ]}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Raw JSON Collapsible */}
            <details className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl group">
              <summary className="px-4 py-3 cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform duration-200 text-xs">
                  ▶
                </span>
                📋 View Raw JSON Response
              </summary>
              <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-800 mt-2">
                <pre className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg text-xs text-gray-700 dark:text-gray-400 overflow-x-auto max-h-96 scrollbar-thin">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}

        {/* ── Empty State ─── */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center fade-in animate-in">
            <div className="text-5xl mb-5 bg-blue-100 dark:bg-blue-900/20 w-20 h-20 rounded-2xl flex items-center justify-center">
              📊
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Ready to Analyze
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm leading-relaxed">
              Sistem akan mencoba memuat hasil secara otomatis. Jika data belum
              tersedia, compute akan dijalankan di background.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ─── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 py-6 bg-white/80 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>Bad Debt Early-Warning System · Kalla Group</span>
          <span>© {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>

      {/* ── Fixed Process Terminal ─── */}
      <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-3 pointer-events-auto">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/98 dark:bg-gray-900/98 shadow-2xl backdrop-blur overflow-hidden">
            {/* Terminal Header */}
            <button
              id="terminal-toggle"
              onClick={() => setTerminalOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                  $
                </span>
                Terminal Proses Backend
                {processLogs.length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({processLogs.length} logs)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {computeStatus?.status === "running" && (
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                )}
                <span className="text-xs text-gray-500">
                  {terminalOpen ? "▼ Hide" : "▲ Show"}
                </span>
              </div>
            </button>

            {terminalOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
                {/* Job Status + Clear */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
                  <span className="font-mono">
                    {computeStatus?.job_id
                      ? `Job: ${computeStatus.job_id} · Status: ${computeStatus.status}`
                      : "No active compute job"}
                  </span>
                  <button
                    onClick={() => setProcessLogs([])}
                    className="self-start sm:self-auto px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors text-xs"
                  >
                    Clear Logs
                  </button>
                </div>

                {/* Log Area */}
                <div
                  ref={terminalBodyRef}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-100 p-3 h-40 sm:h-52 overflow-y-auto font-mono text-xs scrollbar-thin"
                >
                  {processLogs.length === 0 ? (
                    <div className="text-gray-500">
                      [info] Menunggu aktivitas backend...
                    </div>
                  ) : (
                    processLogs.map((log, idx) => (
                      <div
                        key={`${log.ts}-${idx}`}
                        className="whitespace-pre-wrap break-words leading-5"
                      >
                        <span className="text-gray-500">[{log.ts}]</span>{" "}
                        <span
                          className={
                            log.level === "error"
                              ? "text-rose-400"
                              : log.level === "warn"
                                ? "text-amber-400"
                                : "text-emerald-400"
                          }
                        >
                          [{log.level}]
                        </span>{" "}
                        <span className="text-gray-200">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>

                {computeMessage && (
                  <p className="text-xs text-violet-600 dark:text-violet-300 font-medium">
                    › {computeMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
