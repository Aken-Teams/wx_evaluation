/**
 * 年度評鑑計算（忠實移植自舊 server/src/index.js: getAuditComponent + yearly-evaluation）。
 * 注意：年度等級門檻用「≥」且不分 AU（與季度的「>」+ AU/Non-AU 不同）。
 */
import type { Grade } from './types.js';

export interface AnnualAuditInput {
  VDA?: number | null;
  QSA?: number | null;
  QPA?: number | null;
  HSF?: number | null;
  CSR?: number | null;
  others?: number | null;
}

/** 四捨五入至 3 位小數（年度計算與舊系統一致） */
export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** 稽核組件：VDA>0 取 VDA，否則 QSA；有 HSF 則與之平均。無則 0。 */
export const getAuditComponent = (a?: AnnualAuditInput | null): number => {
  if (!a) return 0;
  const arr: number[] = [];
  if (typeof a.VDA === 'number' && a.VDA > 0) arr.push(a.VDA);
  else if (typeof a.QSA === 'number') arr.push(a.QSA);
  if (typeof a.HSF === 'number') arr.push(a.HSF);
  return arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
};

/** 月考核平均：該年各季 assessmentScore 的平均（僅計非 null）。無資料回 null。 */
export const monthlyAverage = (scores: Array<number | null>): number | null => {
  const valid = scores.filter((s): s is number => s !== null);
  return valid.length ? round3(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
};

/**
 * 年度分數：
 * - 月考核平均為 null → null
 * - 無稽核（component=0）→ 月均 − others
 * - 有稽核 → 月均×0.9 + 稽核×0.1 − others
 */
export const calcAnnualScore = (
  monthlyAssessmentAverage: number | null,
  auditComponent: number,
  others: number,
): number | null => {
  if (monthlyAssessmentAverage === null) return null;
  if (auditComponent === 0) return round3(monthlyAssessmentAverage - others);
  return round3(monthlyAssessmentAverage * 0.9 + auditComponent * 0.1 - others);
};

/** 年度等級（用 ≥，不分 AU） */
export const annualGradeFromScore = (score: number | null): Grade | null => {
  if (score === null) return null;
  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 75) return 'C';
  if (score >= 60) return 'D';
  return 'E';
};

/** 一家供應商的完整年度評鑑 */
export interface AnnualResult {
  monthlyAssessmentAverage: number | null;
  auditComponent: number;
  annualScore: number | null;
  grade: Grade | null;
}

export const evaluateAnnual = (
  quarterlyScores: Array<number | null>,
  audit: AnnualAuditInput | null,
): AnnualResult => {
  const avg = monthlyAverage(quarterlyScores);
  const auditComponent = getAuditComponent(audit);
  const others = audit?.others ?? 0;
  const annualScore = calcAnnualScore(avg, auditComponent, others);
  return {
    monthlyAssessmentAverage: avg,
    auditComponent,
    annualScore,
    grade: annualGradeFromScore(annualScore),
  };
};
