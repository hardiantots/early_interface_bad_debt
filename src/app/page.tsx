"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { StatCard } from "@/components/ui/StatCard";
import { RiskBar } from "@/components/ui/RiskBar";
import { DataTable } from "@/components/ui/DataTable";
import { TimeRange, ScoringResult } from "@/types";

// ── Config ─────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// ── Main Page ──────────────────────────────────────────────────────────

export default function Dashboard() {
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
  const [models, setModels] = useState<{key: string, label: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState("stacked");
  const [snapshotDate, setSnapshotDate] = useState("2026-02-10");
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);
  const [threshold, setThreshold] = useState(0.3);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<
    "score" | "alerts" | "receipt_trigger"
  >("score");
  const [initialLoaded, setInitialLoaded] = useState(false);
  
  // AbortController ref to handle race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load models and time ranges from API config
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
            setStartDate(prev => prev || data.min_date);
        }
        if (data.max_date) {
            setMaxDate(data.max_date);
            setEndDate(prev => prev || data.max_date);
        }
      })
      .catch(() => {});
  }, []);

  const runScoring = useCallback(async (
    endpoint: "score" | "alerts" | "receipt_trigger" = "score",
    opts?: { timeRange?: string; thresh?: number; modelKey?: string },
  ) => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    const tr = opts?.timeRange ?? selectedTimeRange;
    const th = opts?.thresh ?? threshold;
    const mk = opts?.modelKey ?? selectedModel;

    const params = new URLSearchParams({
      model: mk,
      snapshot_date: snapshotDate,
      time_range: tr,
    });
    if (tr === "custom") {
        params.set("start_date", startDate);
        params.set("end_date", endDate);
    }

    let path = "/db/score";
    if (endpoint === "alerts") {
      path = "/db/alerts";
      params.set("threshold", String(th));
    } else if (endpoint === "receipt_trigger") {
      path = "/db/early_warning/receipt_trigger";
    }

    try {
      const resp = await fetch(`${API_BASE}${path}?${params}`, {
          signal: abortController.signal
      });
      const data: ScoringResult = await resp.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
          console.log('Fetch aborted due to new request');
          return;
      }
      setError(
        `Connection failed. Make sure FastAPI is running on ${API_BASE}. Error: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      // Only set loading to false if this was the latest request
      if (abortControllerRef.current === abortController) {
          setLoading(false);
      }
    }
  }, [
    snapshotDate,
    selectedTimeRange,
    threshold,
    selectedModel,
    startDate,
    endDate,
  ]);

  // Auto-load on mount
  useEffect(() => {
    if (!initialLoaded) {
      setInitialLoaded(true);
      runScoring("score");
    }
  }, [initialLoaded, runScoring]);

  // Auto re-score when time range or model changes
  useEffect(() => {
    if (initialLoaded) {
      runScoring(activeEndpoint, { timeRange: selectedTimeRange, modelKey: selectedModel });
    }
  }, [selectedTimeRange, selectedModel, initialLoaded, activeEndpoint, runScoring]);

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

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (abortControllerRef.current) {
              abortControllerRef.current.abort();
          }
      };
  }, []);

  // Data rows from result
  const invoiceRows =
    result?.preview || result?.alerts || result?.all_scores_preview || [];
  const customerRows = result?.customer_risk || [];

  return (
    <main className="min-h-screen">
      {/* ── Header ─── */}
      <header className="bg-gradient-to-r from-blue-50 dark:from-blue-900/40 via-white dark:via-gray-900 to-gray-50 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <Image
                src={
                  theme === "dark"
                    ? "/kalla_logo_new_white.png"
                    : "/kalla_logo_new.png"
                }
                alt="Kalla Group"
                width={140}
                height={56}
                className="h-12 sm:h-14 w-auto object-contain"
                priority
              />
              <div>
                <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-widest uppercase">
                  Early-Warning System
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                  Bad Debt Risk Console
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Deteksi dini risiko bad debt · Data langsung dari database
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
                className="p-2 rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition"
                title="Toggle Theme"
              >
                {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
              </button>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected to API
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Control Panel ─── */}
        <section className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Configuration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
            {/* Model Selection */}
            <div className="flex flex-col">
              <label htmlFor="modelSelect" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Model Selection
              </label>
              <select
                id="modelSelect"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                aria-label="Select Model"
              >
                {models.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time range */}
            <div className="flex flex-col">
              <label htmlFor="timeRange" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Time Range
              </label>
              <select
                id="timeRange"
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                aria-label="Select Time Range"
              >
                {timeRanges.map((tr) => (
                  <option key={tr.key} value={tr.key}>
                    {tr.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Range: Start Date */}
            {selectedTimeRange === "custom" && (
              <div className="flex flex-col">
                <label htmlFor="startDate" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Dari Tanggal
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  min={minDate}
                  max={endDate || maxDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Custom Range: End Date */}
            {selectedTimeRange === "custom" && (
              <div className="flex flex-col">
                <label htmlFor="endDate" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Sampai Tanggal
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate || minDate}
                  max={maxDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Snapshot date */}
            <div className="flex flex-col">
              <label htmlFor="snapshotDate" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Snapshot Date
              </label>
              <input
                id="snapshotDate"
                type="date"
                value={snapshotDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
                           text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                aria-label="Select Snapshot Date"
              />
            </div>

            {/* Threshold */}
            <div className="flex flex-col sm:col-span-2 lg:col-span-1">
              <label htmlFor="riskThreshold" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Alert Threshold: <span className="font-semibold text-blue-600 dark:text-blue-400">{threshold.toFixed(2)}</span>
              </label>
              <input
                id="riskThreshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-blue-500 mt-1 cursor-grab active:cursor-grabbing"
                aria-label="Set Risk Alert Threshold"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setActiveEndpoint("score");
                runScoring("score");
              }}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                         text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 active:scale-95"
            >
              {loading && activeEndpoint === "score" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Processing...
                </span>
              ) : (
                "🔍 Refresh Scoring"
              )}
            </button>

            <button
              onClick={() => {
                setActiveEndpoint("alerts");
                runScoring("alerts");
              }}
              disabled={loading}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500
                         text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-amber-600/20 hover:shadow-amber-600/40
                         focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 active:scale-95"
            >
              ⚠️ Alerts Only
            </button>

            <button
              onClick={() => {
                setActiveEndpoint("receipt_trigger");
                runScoring("receipt_trigger");
              }}
              disabled={loading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500
                         text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-600/20 hover:shadow-red-600/40
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 active:scale-95"
            >
              🚨 Early Warning
            </button>

            <button
              onClick={downloadCsv}
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500
                         text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 active:scale-95"
            >
              📥 Download CSV
            </button>
          </div>
        </section>

        {/* ── Error ─── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500 dark:text-red-400 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-xl">🛑</span>
            <div>
                <strong className="block mb-1">Error Processing Request</strong> 
                {error}
            </div>
          </div>
        )}

        {/* ── Warning ─── */}
        {result?.warning && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-600 dark:text-amber-400 text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-xl">⚠️</span>
            <div>
                {result.warning}
            </div>
          </div>
        )}

        {/* ── Loading ─── */}
        {loading && (
          <div className="flex items-center justify-center py-20 animate-in fade-in duration-500">
            <div className="text-center space-y-4">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto" />
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium animate-pulse">
                Querying database & running inference...
              </p>
            </div>
          </div>
        )}

        {/* ── Results ─── */}
        {result && !result.warning && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Mode info */}
            {result.analysis_type && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔶</span>
                  <h3 className="font-semibold text-blue-700 dark:text-blue-300">
                    {result.analysis_type}
                  </h3>
                </div>
                {result.analysis_description && (
                  <p className="text-sm text-gray-700 dark:text-gray-400">
                    {result.analysis_description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {result.model_name && (
                    <span>
                      <strong className="text-gray-800 dark:text-gray-300">
                        Model:
                      </strong>{" "}
                      {result.model_name}
                    </span>
                  )}
                  {result.model_label && (
                    <span>
                      <strong className="text-gray-800 dark:text-gray-300">
                        Model:
                      </strong>{" "}
                      {result.model_label}
                    </span>
                  )}
                  {result.feature_count && (
                    <span>
                      <strong className="text-gray-800 dark:text-gray-300">
                        Features:
                      </strong>{" "}
                      {result.feature_count}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4">
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
                value={result.snapshot_date || "—"}
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

            {/* Risk bar */}
            {result.risk_summary && <RiskBar summary={result.risk_summary} />}

            {/* Top EFL table */}
            {result.top_efl_invoices && result.top_efl_invoices.length > 0 && (
              <div className="mb-6">
                <DataTable
                  rows={result.top_efl_invoices}
                  title="Top Expected Financial Loss"
                  subtitle="Invoice dengan potensi kerugian finansial tertinggi"
                  priorityCols={[
                    "CUSTOMER_NAME",
                    "ACCOUNT_NUMBER",
                    "CUSTOMER_TRX_ID",
                    "expected_financial_loss",
                    "prob_bad_debt",
                    "TRX_AMOUNT",
                    "DUE_DATE",
                    "TRX_DATE",
                    "risk_level",
                    "recommended_action",
                  ]}
                />
              </div>
            )}

            {/* Invoice table */}
            {invoiceRows.length > 0 && (
              <DataTable
                rows={invoiceRows}
                title="Invoice Scores"
                subtitle="Hasil prediksi per invoice"
                priorityCols={[
                  "CUSTOMER_NAME",
                  "ACCOUNT_NUMBER",
                  "CUSTOMER_TRX_ID",
                  "TRX_AMOUNT",
                  "DUE_DATE",
                  "TRX_DATE",
                  "paid_ratio",
                  "n_pay_pre_due",
                  "party_prior_bd90_cnt",
                  "prob_bad_debt",
                  "risk_level",
                  "recommended_action",
                ]}
              />
            )}

            {/* Customer risk section */}
            {customerRows.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">👥 Customer Risk</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    Aggregated from invoice-level predictions
                  </span>
                </div>

                {/* Customer risk summary */}
                {result.customer_risk_summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:gap-4">
                    <StatCard
                      icon="👥"
                      label="Total Customers"
                      value={customerRows.length}
                    />
                    {result.customer_risk_summary.HIGH != null && (
                      <StatCard
                        icon="🔴"
                        label="High Risk"
                        value={result.customer_risk_summary.HIGH}
                        variant="danger"
                      />
                    )}
                    {result.customer_risk_summary.MEDIUM != null && (
                      <StatCard
                        icon="🟠"
                        label="Medium Risk"
                        value={result.customer_risk_summary.MEDIUM}
                        variant="warning"
                      />
                    )}
                    {result.customer_risk_summary.LOW != null && (
                      <StatCard
                        icon="🟢"
                        label="Low Risk"
                        value={result.customer_risk_summary.LOW}
                        variant="success"
                      />
                    )}
                  </div>
                )}

                {/* Customer risk table */}
                <DataTable
                  rows={customerRows}
                  title="Customer Risk List"
                  subtitle="List customer berisiko berdasarkan agregasi invoice-level predictions"
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
              </div>
            )}

            {/* Raw JSON collapsible */}
            <details className="bg-white/40 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl group transition-all">
              <summary className="px-4 py-3 cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
                <span className="inline-flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform duration-200">▶</span>
                    📋 View Raw JSON Response
                </span>
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
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="text-6xl mb-6 bg-blue-50 dark:bg-blue-900/20 w-24 h-24 rounded-full flex items-center justify-center">📊</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Ready to Analyze
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md leading-relaxed">
              Pilih konfigurasi dan threshold di control panel atas, lalu klik tombol <strong className="text-gray-700 dark:text-gray-300">Refresh Scoring</strong> untuk melihat
              hasil prediksi bad debt terbaru dari database.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ─── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 py-8 bg-white/50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            Bad Debt Early-Warning System · Kalla Group
          </div>
          <div>
            &copy; {new Date().getFullYear()} All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
