export function fmtNumber(n: unknown): string {
  if (n == null || isNaN(Number(n))) return "—";
  const val = Number(n);
  if (Math.abs(val) >= 1e6)
    return val.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  if (Math.abs(val) >= 1)
    return val.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return val.toFixed(4);
}

export function fmtProb(p: unknown): string {
  if (p == null || isNaN(Number(p))) return "—";
  return (Number(p) * 100).toFixed(2) + "%";
}

export function riskColor(level: string): string {
  if (level === "HIGH")
    return "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
  if (level === "MEDIUM")
    return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30";
  return "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30";
}

const NICE_HEADERS: Record<string, string> = {
  ACCOUNT_NUMBER: "No. Akun",
  CUSTOMER_NAME: "Nama Customer",
  SBU: "Unit Bisnis",
  CUSTOMER_TRX_ID: "ID Transaksi",
  TRX_NUMBER: "No. Invoice",
  PARTY_ID: "ID Party",
  TRX_AMOUNT: "Nominal",
  TRX_AMOUNT_GROSS: "Nominal Bruto",
  credit_memo_reduction: "Potongan Credit Memo",
  TRX_DATE: "Tanggal Transaksi",
  days_to_due: "Sisa Hari",
  DUE_DATE: "Jatuh Tempo",
  expected_financial_loss: "Estimasi Kerugian",
  prob_bad_debt: "Probabilitas Bad Debt",
  risk_level: "Risiko",
  risk_cust: "Risiko",
  risk_ew: "Risiko (EW)",
  recommended_action: "Rekomendasi",
  paid_ratio: "Rasio Bayar",
  n_pay_pre_due: "Jumlah Pembayaran",
  party_prior_bd90_cnt: "Riwayat BD90",
  cust_score_max: "Skor Maks",
  cust_score_mean: "Skor Rata-rata",
  cust_score_wavg_amount: "Skor W-Avg",
  invoice_cnt: "Jumlah Invoice",
  total_amount: "Total Nominal",
  paid_ratio_pre_due_total: "Rasio Bayar (Total)",
  pct_invoices_gap_gt_90_pre_due: "Gap >90 hari (%)",
};

export function niceHeader(key: string): string {
  return NICE_HEADERS[key] || key.replace(/_/g, " ");
}
