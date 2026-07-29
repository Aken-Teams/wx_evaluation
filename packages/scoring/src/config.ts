/**
 * 可設定評分規則 — 設定物件與預設值。
 * 預設值完全等於 constants.ts（故不覆寫時行為與現行系統 100% 一致）。
 * 管理員可透過「評分設定」畫面調整，引擎接受覆寫。
 */
import {
  CAR_BASE,
  CAR_COEFF,
  DELIVERY_DEDUCTION_BELOW,
  DELIVERY_DEDUCTION_LADDER,
  DOWNGRADE_PURCHASE_THRESHOLD,
  DOWNGRADE_QC_THRESHOLD,
  GRADE_THRESHOLDS,
  LAR_LADDER,
  LAR_SCORE_BELOW,
  PRODUCTION_LINE_STOP_COEFF,
  PURCHASE_BASE,
} from './constants.js';
import type { Grade } from './types.js';

export interface GradeThreshold {
  grade: Grade;
  gt: number;
}

export interface ScoringConfig {
  larLadder: Array<{ min: number; score: number }>;
  larScoreBelow: number;
  carBase: number;
  carCoeff: { externalCAR: number; arr: number; untimelyResponseCCR: number };
  deliveryDeductionLadder: Array<{ min: number; deduction: number }>;
  deliveryDeductionBelow: number;
  purchaseBase: number;
  productionLineStopCoeff: number;
  gradeThresholds: { nonAU: GradeThreshold[]; AU: GradeThreshold[] };
  downgradeQcThreshold: number;
  downgradePurchaseThreshold: number;
}

export const defaultConfig: ScoringConfig = {
  larLadder: LAR_LADDER.map((x) => ({ ...x })),
  larScoreBelow: LAR_SCORE_BELOW,
  carBase: CAR_BASE,
  carCoeff: { ...CAR_COEFF },
  deliveryDeductionLadder: DELIVERY_DEDUCTION_LADDER.map((x) => ({ ...x })),
  deliveryDeductionBelow: DELIVERY_DEDUCTION_BELOW,
  purchaseBase: PURCHASE_BASE,
  productionLineStopCoeff: PRODUCTION_LINE_STOP_COEFF,
  gradeThresholds: {
    nonAU: GRADE_THRESHOLDS.nonAU.map((x) => ({ grade: x.grade as Grade, gt: x.gt })),
    AU: GRADE_THRESHOLDS.AU.map((x) => ({ grade: x.grade as Grade, gt: x.gt })),
  },
  downgradeQcThreshold: DOWNGRADE_QC_THRESHOLD,
  downgradePurchaseThreshold: DOWNGRADE_PURCHASE_THRESHOLD,
};
