/**
 * 季度供應商評比 — 評分引擎（單一真相來源）。
 *
 * 忠實移植自現行 src/services/reportService.ts 的計算邏輯，常數抽至 constants.ts，
 * 並支援以 ScoringConfig 覆寫（預設 = 現行常數，故不覆寫時行為完全一致）。
 * 純函式、框架無關，前端與後端皆可直接引用。
 *
 * 規格：docs/評分規則_現況萃取.md
 */
import { defaultConfig, type ScoringConfig } from './config.js';
import type {
  Grade,
  PurchaseResult,
  QualityResult,
  QuarterlyInput,
  QuarterlyResult,
} from './types.js';

export * from './types.js';
export * from './config.js';
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

/** CAR 評分（滿分 40）= max(0, 40 − 10×外部客訴 − 5×產線CAR − 3×延遲回覆) */
export const calcCarScore = (
  input: Pick<QuarterlyInput, 'externalCAR' | 'arr' | 'untimelyResponseCCR'>,
  cfg: ScoringConfig = defaultConfig,
): number =>
  Math.max(
    0,
    cfg.carBase -
      cfg.carCoeff.externalCAR * input.externalCAR -
      cfg.carCoeff.arr * input.arr -
      cfg.carCoeff.untimelyResponseCCR * input.untimelyResponseCCR,
  );

/** 批退良率 %：檢驗批數為 0 時視為 100（無退貨即 100%） */
export const calcLarPercent = (receivedBatches: number, returnedBatches: number): number =>
  receivedBatches > 0 ? (1 - returnedBatches / receivedBatches) * 100 : 100;

/** 依 LAR% 對照階梯取得 LAR 評分（滿分 30） */
export const calcLarScore = (larPercent: number, cfg: ScoringConfig = defaultConfig): number => {
  for (const tier of cfg.larLadder) {
    if (larPercent >= tier.min) return tier.score;
  }
  return cfg.larScoreBelow;
};

/** 品質構面：CAR + LAR → 品質總分（滿分 70） */
export const calcQuality = (input: QuarterlyInput, cfg: ScoringConfig = defaultConfig): QualityResult => {
  const carScore = calcCarScore(input, cfg);
  const larPercent = calcLarPercent(input.receivedBatches, input.returnedBatches);
  const larScore = calcLarScore(larPercent, cfg);
  return { carScore, larPercent, larScore, qualityScore: round2(larScore + carScore) };
};

/** 達交率扣分（階梯） */
export const calcDeliveryDeduction = (deliveryRate: number, cfg: ScoringConfig = defaultConfig): number => {
  for (const tier of cfg.deliveryDeductionLadder) {
    if (deliveryRate >= tier.min) return tier.deduction;
  }
  return cfg.deliveryDeductionBelow;
};

/** 交期（採購評核）構面：滿分 20，扣分制 */
export const calcPurchase = (input: QuarterlyInput, cfg: ScoringConfig = defaultConfig): PurchaseResult => {
  const deliveryRate = round1(input.deliveryRate ?? 100);
  const deliveryDeduction = calcDeliveryDeduction(deliveryRate, cfg);
  const purchaseScore = Math.max(
    0,
    cfg.purchaseBase - deliveryDeduction - input.productionLineStop * cfg.productionLineStopCoeff - input.specialApproval,
  );
  return { deliveryRate, deliveryDeduction, purchaseScore };
};

/** 綜合評分 → 等級（依 AU / Non-AU 採不同門檻，區間為「下界不含、上界含」） */
export const gradeFromScore = (score: number, isAU: boolean, cfg: ScoringConfig = defaultConfig): Grade => {
  const table = isAU ? cfg.gradeThresholds.AU : cfg.gradeThresholds.nonAU;
  for (const tier of table) {
    if (score > tier.gt) return tier.grade;
  }
  return 'E';
};

/** 本季無交易判定 */
export const isNoTransaction = (input: QuarterlyInput): boolean =>
  input.receivedBatches === 0 &&
  input.returnedBatches === 0 &&
  input.externalCAR === 0 &&
  input.arr === 0 &&
  input.untimelyResponseCCR === 0 &&
  input.serviceQuality === 0 &&
  input.servicePurchase === 0;

/** 單季降級規則（規則 1~3）：品質或交期過低時降一級。 */
const applySingleQuarterDowngrade = (
  grade: Grade,
  qualityScore: number,
  purchaseScore: number,
  cfg: ScoringConfig,
): { finalGrade: Grade; downgraded: boolean } => {
  const qcLow = qualityScore < cfg.downgradeQcThreshold;
  const purLow = purchaseScore < cfg.downgradePurchaseThreshold;
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
export const evaluateQuarter = (input: QuarterlyInput, cfg: ScoringConfig = defaultConfig): QuarterlyResult => {
  const quality = calcQuality(input, cfg);
  const purchase = calcPurchase(input, cfg);

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
  const grade = gradeFromScore(assessmentScore, input.isAU, cfg);
  const { finalGrade, downgraded } = applySingleQuarterDowngrade(grade, quality.qualityScore, purchase.purchaseScore, cfg);

  return { noTransaction: false, quality, purchase, serviceScore, assessmentScore, grade, downgraded, finalGrade };
};

/** 跨季連續降級（規則 4）：本季與上一季等級皆為 C 或 D → 再降一級。 */
export const applyConsecutiveDowngrade = (
  currentGrade: Grade | null,
  prevGrade: Grade | null,
): { grade: Grade | null; consecutiveDowngrade: boolean } => {
  if (!currentGrade || !prevGrade) return { grade: currentGrade, consecutiveDowngrade: false };
  const order: Grade[] = ['A', 'B', 'C', 'D', 'E'];
  const isLow = (g: Grade) => g === 'C' || g === 'D';
  if (isLow(currentGrade) && isLow(prevGrade)) {
    const idx = order.indexOf(currentGrade);
    const next = idx < order.length - 1 ? order[idx + 1]! : currentGrade;
    return { grade: next, consecutiveDowngrade: true };
  }
  return { grade: currentGrade, consecutiveDowngrade: false };
};

/** 上一季鍵（例：2024-Q1 → 2023-Q4） */
export const getPrevQuarterKey = (year: number, quarter: 1 | 2 | 3 | 4): string =>
  quarter === 1 ? `${year - 1}-Q4` : `${year}-Q${quarter - 1}`;
