/**
 * 季度評比 — 所有評分常數（單一真相來源）。
 *
 * 這些常數原本散落在前端 reportService.ts / QualityReport.tsx / excelExport.ts
 * 與後端 index.js（共四份，且與舊文件不符）。此處集中管理，改一處即全系統生效。
 *
 * 公式規格見 docs/評分規則_現況萃取.md。
 */

/** 品質總分上限（LAR 30 + CAR 40） */
export const QUALITY_MAX = 70;
/** 交期分數上限 */
export const PURCHASE_MAX = 20;
/** 服務分數上限（品質服務 + 採購服務） */
export const SERVICE_MAX = 10;

// ── LAR（批退良率）評分階梯：LAR% ≥ min → score，由高至低比對 ──
export const LAR_LADDER: ReadonlyArray<{ min: number; score: number }> = [
  { min: 100, score: 30 },
  { min: 99, score: 28 },
  { min: 95, score: 26 },
  { min: 85, score: 22 },
  { min: 80, score: 18 },
  { min: 75, score: 14 },
];
/** 低於最低門檻（<75）之 LAR 分數 */
export const LAR_SCORE_BELOW = 0;

// ── CAR（糾正措施）評分：基數扣加權缺失件數，最低 0 ──
export const CAR_BASE = 40;
export const CAR_COEFF = {
  /** 外部客訴件數 */
  externalCAR: 10,
  /** 產線 CAR 件數（現行欄位名為 arr） */
  arr: 5,
  /** 延遲回覆件數 */
  untimelyResponseCCR: 3,
} as const;

// ── 交期（採購評核）：達交率扣分階梯 ──
export const DELIVERY_DEDUCTION_LADDER: ReadonlyArray<{ min: number; deduction: number }> = [
  { min: 99.5, deduction: 0 },
  { min: 95, deduction: 5 },
  { min: 90, deduction: 10 },
  { min: 85, deduction: 15 },
];
/** 低於最低門檻（<85）之扣分 */
export const DELIVERY_DEDUCTION_BELOW = 20;
/** 交期分數基數 */
export const PURCHASE_BASE = 20;
/** 產線停線每次扣分 */
export const PRODUCTION_LINE_STOP_COEFF = 20;
/** 達交率未填時的預設值 */
export const DEFAULT_DELIVERY_RATE = 100;

// ── 等級門檻：綜合評分「嚴格大於」gt 者得該等級；分 AU / Non-AU 兩套 ──
export const GRADE_THRESHOLDS = {
  nonAU: [
    { grade: 'A', gt: 95 },
    { grade: 'B', gt: 85 },
    { grade: 'C', gt: 75 },
    { grade: 'D', gt: 60 },
  ],
  AU: [
    { grade: 'A', gt: 98 },
    { grade: 'B', gt: 90 },
    { grade: 'C', gt: 80 },
    { grade: 'D', gt: 70 },
  ],
} as const;
/** 未達任何門檻之最低等級 */
export const LOWEST_GRADE = 'E' as const;

// ── 降級規則（單季低分）門檻 ──
export const DOWNGRADE_QC_THRESHOLD = 56;
export const DOWNGRADE_PURCHASE_THRESHOLD = 15;

/** 等級由高至低順序，供降級位移使用 */
export const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E'] as const;
