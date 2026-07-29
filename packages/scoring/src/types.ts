/** 評核等級 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * 季度評比的原始輸入（一家供應商、一個季度）。
 * 欄位語意見 docs/評分規則_現況萃取.md。
 */
export interface QuarterlyInput {
  /** 檢驗批數（進料批數） */
  receivedBatches: number;
  /** 退貨批數 */
  returnedBatches: number;
  /** 外部客訴件數 */
  externalCAR: number;
  /** 產線 CAR 件數（現行欄位名 arr） */
  arr: number;
  /** 延遲回覆件數 */
  untimelyResponseCCR: number;
  /** 品質構面服務評分（0~10 的一部分，人工輸入） */
  serviceQuality: number;
  /** 採購構面服務評分 */
  servicePurchase: number;
  /** 達交率 %（null / undefined 視為預設 100） */
  deliveryRate: number | null;
  /** 特批扣分 */
  specialApproval: number;
  /** 產線停線次數 */
  productionLineStop: number;
  /** 是否 AU 供應商（採較嚴等級門檻） */
  isAU: boolean;
}

/** 品質構面計算結果 */
export interface QualityResult {
  /** CAR 評分（滿分 40） */
  carScore: number;
  /** 批退良率 % */
  larPercent: number;
  /** LAR 評分（滿分 30） */
  larScore: number;
  /** 品質總分 = LAR + CAR（滿分 70） */
  qualityScore: number;
}

/** 交期（採購評核）構面計算結果 */
export interface PurchaseResult {
  /** 實際採用的達交率（四捨五入至 1 位小數） */
  deliveryRate: number;
  /** 達交率扣分 */
  deliveryDeduction: number;
  /** 交期分數（滿分 20） */
  purchaseScore: number;
}

/** 一家供應商一季的完整評比結果 */
export interface QuarterlyResult {
  /** 本季無交易（六欄顯示「—」） */
  noTransaction: boolean;
  quality: QualityResult | null;
  purchase: PurchaseResult | null;
  /** 服務分數 = 品質服務 + 採購服務（滿分 10） */
  serviceScore: number | null;
  /** 綜合評分 = 品質總分 + 交期分數 + 服務分數（滿分 100） */
  assessmentScore: number | null;
  /** 依綜合評分得出的原始等級 */
  grade: Grade | null;
  /** 是否觸發單季降級 */
  downgraded: boolean;
  /** 套用單季降級後的等級（尚未套用跨季連續降級） */
  finalGrade: Grade | null;
}
