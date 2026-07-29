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

export interface AnnualRow {
  vendorId: number;
  vendorName: string;
  supplierType: string;
  quarterScores: Record<Quarter, number | null>;
  tradingQuarters: number;
  totalReceivedBatches: number;
  audit: { VDA: number | null; QSA: number | null; QPA: number | null; HSF: number | null; CSR: number | null };
  others: number | null;
  nextYearAuditType: string;
  remarks: string | null;
  monthlyAssessmentAverage: number | null;
  auditComponent: number;
  annualScore: number | null;
  grade: Grade | null;
}

export interface OsatPeriod {
  year: number;
  month: number;
}

export interface OsatRow {
  vendorId: number;
  vendorName: string;
  factory: string;
  shipmentQuantity: string;
  receivedBatches: number;
  returnedBatches: number;
  totalComplaintCCR: number;
  qualityAssessmentScore: number | null;
  purchaseAssessmentScoreA: number | null;
  assessmentScore: number | null;
  remarks: string | null;
}

export interface BackgroundRow {
  vendorId: number;
  vendorName: string;
  region: string | null;
  latePaymentCount: number;
  customerComplaintCount: number;
  qualityAbnormal8D: number;
  cooperationScore: number | null;
  notes: string | null;
}

export interface SourcingEvent {
  id: number;
  title: string;
  itemName: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  _count?: { quotes: number };
}

export interface SourcingQuote {
  id: number;
  eventId: number;
  supplierName: string;
  stage: string;
  moldItems: string | null;
  moldPriceTaxed: number | null;
  productUnitPrice: number | null;
  unitPriceTotal: number | null;
  sampleLeadTime: string | null;
  deliveryCycle: string | null;
  paymentTerms: string | null;
  moldPaymentTerms: string | null;
  priceTier: string | null;
  backgroundInfo: string | null;
  evaluation: string | null;
  isBest: boolean;
}

export interface SourcingEventDetail extends SourcingEvent {
  quotes: SourcingQuote[];
}
