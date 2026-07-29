import type { Grade, QuarterlyResult } from '@wx/scoring';

export type { Grade, QuarterlyResult };

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export interface Supplier {
  id: number;
  name: string;
  supplierCode: string | null;
  materialCategory: string | null;
  region: string | null;
  isAU: string | null;
  vendorType: string;
}

export interface UserRow {
  id: number;
  username: string;
  role: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'admin', label: '系统管理员' },
  { value: 'quality_yearly_editor', label: '品质编辑' },
  { value: 'engineer', label: '工程师' },
  { value: 'purchase_editor', label: '采购编辑' },
  { value: 'viewer', label: '主管/检视' },
];

/** 評比原始輸入欄位（可編輯） */
export interface EvaluationRaw {
  receivedBatches: number;
  returnedBatches: number;
  externalCAR: number;
  arr: number;
  untimelyResponseCCR: number;
  serviceQuality: number;
  servicePurchase: number;
  deliveryRate: number | null;
  specialApproval: number;
  productionLineStop: number;
  remarks: string | null;
}

export interface EvaluationRow {
  vendorId: number;
  vendorName: string;
  isAU: boolean;
  raw: EvaluationRaw;
  score: QuarterlyResult;
}

export interface Period {
  year: number;
  quarter: Quarter;
}

export interface RankingItem {
  rank: number;
  vendorId: number;
  vendorName: string;
  isAU: boolean;
  score: number | null;
  grade: Grade | null;
  quality: number | null;
  purchase: number | null;
  service: number | null;
  downgraded: boolean;
}

export interface PeriodSummary {
  count: number;
  scored: number;
  avgScore: number | null;
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'none', number>;
  downgraded: number;
}

export interface SummaryResponse {
  period: Period;
  kpis: PeriodSummary;
  ranking: RankingItem[];
  watchlist: RankingItem[];
}

export interface TrendPoint extends PeriodSummary {
  quarter: Quarter;
}
