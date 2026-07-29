/**
 * 季度供應商評比 — 評分引擎（單一真相來源）。
 *
 * 忠實移植自現行 src/services/reportService.ts 的計算邏輯，並將常數抽至 constants.ts。
 * 純函式、框架無關，前端與後端皆可直接引用。
 *
 * 規格：docs/評分規則_現況萃取.md
 */
import {
  CAR_BASE,
  CAR_COEFF,
  DEFAULT_DELIVERY_RATE,
  DELIVERY_DEDUCTION_BELOW,
  DELIVERY_DEDUCTION_LADDER,
  DOWNGRADE_PURCHASE_THRESHOLD,
  DOWNGRADE_QC_THRESHOLD,
  GRADE_ORDER,
  GRADE_THRESHOLDS,
  LAR_LADDER,
  LAR_SCORE_BELOW,
  LOWEST_GRADE,
  PRODUCTION_LINE_STOP_COEFF,
  PURCHASE_BASE,
} from './constants.js';
import type {
  Grade,
  PurchaseResult,
  QualityResult,
  QuarterlyInput,
  QuarterlyResult,
} from './types.js';

export * from './types.js';
export * as constants from './constants.js';

/** 四捨五入至 2 位小數（與現行系統一致） */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
/** 四捨五入至 1 位小數 */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 「是否 AU」為自由文字，內容含「AU」（不分大小寫）視為 AU，空白視為 Non-AU。
 */
export const isAUVendor = (isAUText?: string | null): boolean =>
  !!isAUText && String(isAUText).toUpperCase().includes('AU');

/**
 * CAR 評分（滿分 40）= max(0, 40 − 10×外部客訴 − 5×產線CAR − 3×延遲回覆)
 */
export const calcCarScore = (input: Pick<QuarterlyInput, 'externalCAR' | 'arr' | 'untimelyResponseCCR'>): number =>
  Math.max(
    0,
    CAR_BASE -
      CAR_COEFF.externalCAR * input.externalCAR -
      CAR_COEFF.arr * input.arr -
      CAR_COEFF.untimelyResponseCCR * input.untimelyResponseCCR,
  );

/** 批退良率 %：檢驗批數為 0 時視為 100（無退貨即 100%） */
export const calcLarPercent = (receivedBatches: number, returnedBatches: number): number =>
  receivedBatches > 0 ? (1 - returnedBatches / receivedBatches) * 100 : 100;

/** 依 LAR% 對照階梯取得 LAR 評分（滿分 30） */
export const calcLarScore = (larPercent: number): number => {
  for (const tier of LAR_LADDER) {
    if (larPercent >= tier.min) return tier.score;
  }
  return LAR_SCORE_BELOW;
};

/** 品質構面：CAR + LAR → 品質總分（滿分 70） */
export const calcQuality = (input: QuarterlyInput): QualityResult => {
  const carScore = calcCarScore(input);
  const larPercent = calcLarPercent(input.receivedBatches, input.returnedBatches);
  const larScore = calcLarScore(larPercent);
  return {
    carScore,
    larPercent,
    larScore,
    qualityScore: round2(larScore + carScore),
  };
};

/** 達交率扣分（階梯） */
export const calcDeliveryDeduction = (deliveryRate: number): number => {
  for (const tier of DELIVERY_DEDUCTION_LADDER) {
    if (deliveryRate >= tier.min) return tier.deduction;
  }
  return DELIVERY_DEDUCTION_BELOW;
};

/** 交期（採購評核）構面：滿分 20，扣分制 */
export const calcPurchase = (input: QuarterlyInput): PurchaseResult => {
  const deliveryRate = round1(input.deliveryRate ?? DEFAULT_DELIVERY_RATE);
  const deliveryDeduction = calcDeliveryDeduction(deliveryRate);
  const purchaseScore = Math.max(
    0,
    PURCHASE_BASE - deliveryDeduction - input.productionLineStop * PRODUCTION_LINE_STOP_COEFF - input.specialApproval,
  );
  return { deliveryRate, deliveryDeduction, purchaseScore };
};

/** 綜合評分 → 等級（依 AU / Non-AU 採不同門檻，區間為「下界不含、上界含」） */
export const gradeFromScore = (score: number, isAU: boolean): Grade => {
  const table = isAU ? GRADE_THRESHOLDS.AU : GRADE_THRESHOLDS.nonAU;
  for (const tier of table) {
    if (score > tier.gt) return tier.grade as Grade;
  }
  return LOWEST_GRADE;
};

/**
 * 本季無交易判定：檢驗批數、退貨批數、外部客訴、產線CAR、延遲回覆、服務評分皆為 0。
 */
export const isNoTransaction = (input: QuarterlyInput): boolean =>
  input.receivedBatches === 0 &&
  input.returnedBatches === 0 &&
  input.externalCAR === 0 &&
  input.arr === 0 &&
  input.untimelyResponseCCR === 0 &&
  input.serviceQuality === 0 &&
  input.servicePurchase === 0;

/**
 * 單季降級規則（規則 1~3）：品質或交期過低時降一級。
 * - A：品質 < 56 或 交期 < 15 → 降 B
 * - B：品質 < 56 或 交期 < 15 → 降 C
 * - C：品質 < 56 且 交期 < 15 → 降 D
 */
const applySingleQuarterDowngrade = (
  grade: Grade,
  qualityScore: number,
  purchaseScore: number,
): { finalGrade: Grade; downgraded: boolean } => {
  const qcLow = qualityScore < DOWNGRADE_QC_THRESHOLD;
  const purLow = purchaseScore < DOWNGRADE_PURCHASE_THRESHOLD;
  const dA = grade === 'A' && (qcLow || purLow);
  const dB = grade === 'B' && (qcLow || purLow);
  const dC = grade === 'C' && qcLow && purLow;

  let finalGrade: Grade;
  if (!dA && !dB && !dC) finalGrade = grade;
  else if (!dA && !dB) finalGrade = 'D';
  else if (!dA) finalGrade = 'C';
  else finalGrade = 'B';

  return { finalGrade, downgraded: dA || dB || dC };
};

/** 一家供應商一季的完整評比 */
export const evaluateQuarter = (input: QuarterlyInput): QuarterlyResult => {
  // 元件分數（品質/交期）一律計算並保留，與現行系統一致——
  // 即使全零列，也存 CAR=40 / 品質=70 / 交期=20 的預設滿分。
  const quality = calcQuality(input);
  const purchase = calcPurchase(input);

  // 「本季無交易」僅影響綜合層級：服務/綜合評分/等級/降級六欄標記為 null（畫面顯示「—」）。
  if (isNoTransaction(input)) {
    return {
      noTransaction: true,
      quality,
      purchase,
      serviceScore: null,
      assessmentScore: null,
      grade: null,
      downgraded: false,
      finalGrade: null,
    };
  }

  const serviceScore = round2(input.serviceQuality + input.servicePurchase);
  const assessmentScore = round2(quality.qualityScore + purchase.purchaseScore + serviceScore);
  const grade = gradeFromScore(assessmentScore, input.isAU);
  const { finalGrade, downgraded } = applySingleQuarterDowngrade(grade, quality.qualityScore, purchase.purchaseScore);

  return {
    noTransaction: false,
    quality,
    purchase,
    serviceScore,
    assessmentScore,
    grade,
    downgraded,
    finalGrade,
  };
};

/**
 * 跨季連續降級（規則 4）：本季與上一季等級皆為 C 或 D → 再降一級（E 為底不再降）。
 * 回傳套用後的等級與是否觸發。
 */
export const applyConsecutiveDowngrade = (
  currentGrade: Grade | null,
  prevGrade: Grade | null,
): { grade: Grade | null; consecutiveDowngrade: boolean } => {
  if (!currentGrade || !prevGrade) return { grade: currentGrade, consecutiveDowngrade: false };
  const isLow = (g: Grade) => g === 'C' || g === 'D';
  if (isLow(currentGrade) && isLow(prevGrade)) {
    const idx = GRADE_ORDER.indexOf(currentGrade);
    const next = idx < GRADE_ORDER.length - 1 ? GRADE_ORDER[idx + 1] : currentGrade;
    return { grade: next as Grade, consecutiveDowngrade: true };
  }
  return { grade: currentGrade, consecutiveDowngrade: false };
};

/** 上一季鍵（例：2024-Q1 → 2023-Q4） */
export const getPrevQuarterKey = (year: number, quarter: 1 | 2 | 3 | 4): string =>
  quarter === 1 ? `${year - 1}-Q4` : `${year}-Q${quarter - 1}`;
