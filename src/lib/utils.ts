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
  ACCOUNT_NUMBER: "Account",
  CUSTOMER_NAME: "Customer",
  SBU: "SBU",
  CUSTOMER_TRX_ID: "TRX ID",
  PARTY_ID: "Party ID",
  TRX_AMOUNT: "Amount",
  TRX_DATE: "Trx Date",
  days_to_due: "Days to Due",
  DUE_DATE: "Due Date",
  expected_financial_loss: "Expected Loss",
  prob_bad_debt: "Probability",
  risk_level: "Risk",
  risk_cust: "Risk",
  risk_ew: "Risk EW",
  recommended_action: "Action",
  paid_ratio: "Paid %",
  n_pay_pre_due: "Payments",
  party_prior_bd90_cnt: "Prior BD90",
  cust_score_max: "Max Score",
  cust_score_mean: "Mean Score",
  cust_score_wavg_amount: "WAvg Score",
  invoice_cnt: "Invoices",
  total_amount: "Total Amount",
  paid_ratio_pre_due_total: "Paid Total %",
  pct_invoices_gap_gt_90_pre_due: "Gap >90d %",
};

export function niceHeader(key: string): string {
  return NICE_HEADERS[key] || key.replace(/_/g, " ");
}
