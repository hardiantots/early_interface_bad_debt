export interface TimeRange {
  key: string;
  label: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export interface ComputeJobStatus {
  job_id: string;
  status: "running" | "completed" | "failed";
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
  duration_sec?: number | null;
}

export interface ComputeTriggerResponse {
  job_id?: string;
  status: "running";
  message?: string;
  status_url?: string;
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
  effective_snapshot_date?: string;
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
  pagination?: PaginationMeta;
  last_computed_at?: string;
  job_id?: string;
  warning?: string;
  error?: string;
}

export type SortDirection = "asc" | "desc" | null;
