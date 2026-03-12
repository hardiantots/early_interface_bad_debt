export interface TimeRange {
  key: string;
  label: string;
}

export interface ScoringResult {
  mode?: string;
  analysis_type?: string;
  analysis_description?: string;
  model_name?: string;
  model_key?: string;
  model?: string;
  model_label?: string;
  feature_count?: number;
  snapshot_date?: string;
  time_range?: string;
  total_invoices?: number;
  processed_invoices?: number;
  risk_summary?: Record<string, number>;
  high_risk_count?: number;
  alerts_count?: number;
  threshold?: number;
  preview?: Record<string, unknown>[];
  alerts?: Record<string, unknown>[];
  all_scores_preview?: Record<string, unknown>[];
  top_efl_invoices?: Record<string, unknown>[];
  customer_risk_summary?: Record<string, number>;
  customer_risk?: Record<string, unknown>[];
  warning?: string;
  error?: string;
}

export type SortDirection = "asc" | "desc" | null;
