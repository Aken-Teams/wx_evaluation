﻿﻿﻿﻿﻿﻿import { QualityAnalysisData, QualityReportData, PurchaseReportData, ComprehensiveReportData } from '../types';

export const calculateQualityReport = (data: QualityAnalysisData): QualityReportData => {
  const arr = data.arr;
  const lrr = data.lrr;
  const receivedBatches = typeof data.receivedBatches === 'string' ? parseInt(data.receivedBatches) || 0 : data.receivedBatches;
  const returnedBatches = typeof data.returnedBatches === 'string' ? parseInt(data.returnedBatches) || 0 : (data.returnedBatches || 0);

  // CAR評分(40分) = 40 - 外部客訴件數×10 - 產線CAR件數×5 - 延遲回覆件數×3，最小值為0
  const totalBaseScoreB = Math.max(0, 40 - (10 * data.externalCAR) - (5 * data.arr) - (3 * data.untimelyResponseCCR));

  // 檢驗批數為0時 LAR% 預設100（無退貨即視為100%良率）
  const larPercent = receivedBatches > 0 ? (1 - returnedBatches / receivedBatches) * 100 : 100;
  let larScore = 0;
  if (larPercent >= 100) larScore = 30;
  else if (larPercent >= 99) larScore = 28;
  else if (larPercent >= 95) larScore = 26;
  else if (larPercent >= 85) larScore = 22;
  else if (larPercent >= 80) larScore = 18;
  else if (larPercent >= 75) larScore = 14;
  else larScore = 0;

  // QC評核 = LAR評分 + CAR評分
  const qualityAssessmentScoreC1 = Math.round((larScore + totalBaseScoreB) * 100) / 100;
  const qualityAssessmentScoreC = Math.round((0.7 * qualityAssessmentScoreC1) * 100) / 100;

  return {
    vendorName: data.vendorName,
    receivedQuantity: data.receivedQuantity,
    receivedBatches,
    returnedQuantity: data.returnedQuantity,
    returnedBatches,
    arr,
    lrr,
    externalCAR: data.externalCAR,
    untimelyResponseCCR: data.untimelyResponseCCR,
    totalBaseScoreB,
    others: data.others,
    qualityAssessmentScoreC1,
    qualityAssessmentScoreC,
    service: data.service,
  };
};

// 根据达交率计算扣分值（参考表格规则）
const calcDeliveryDeduction = (deliveryRate: number | null): number => {
  if (deliveryRate === null) return 0;
  if (deliveryRate >= 99.5) return 0;
  if (deliveryRate >= 95) return 5;
  if (deliveryRate >= 90) return 10;
  if (deliveryRate >= 85) return 15;
  return 20;
};

export const calculatePurchaseReport = (data: QualityAnalysisData): PurchaseReportData => {
  const parsedBatches = typeof data.receivedBatches === 'string' ? parseInt(data.receivedBatches) || 0 : data.receivedBatches;
  const parsedReturnedBatches = typeof data.returnedBatches === 'string' ? parseInt(data.returnedBatches) || 0 : (data.returnedBatches || 0);
  const lateDelivery = data.lateDelivery || 0;

  // 達交率：預設 100.0%（尚未填寫時視為 100），後續依實際達交率手動更新；一律保留 1 位小數
  const deliveryRate = Math.round((data.deliveryRate ?? 100) * 10) / 10;
  const deliveryDeduction = calcDeliveryDeduction(deliveryRate);
  const totalPurchaseAssessmentScoreA = Math.max(
    0,
    20 - deliveryDeduction - (data.productionLineStop * 20) - data.specialApproval
  );

  return {
    vendorName: data.vendorName,
    receivedBatches: parsedBatches,
    returnedBatches: parsedReturnedBatches,
    lateDelivery,
    deliveryRate,
    deliveryDeduction,
    specialApproval: data.specialApproval,
    productionLineStop: data.productionLineStop,
    totalPurchaseAssessmentScoreA,
    service: data.service,
    assessmentScore: null,
  };
};

// 數值安全轉換：字串或空值統一轉為數字（無法解析時視為0）
const toNum = (v: number | string | null | undefined): number =>
  typeof v === 'number' ? v : (parseFloat(String(v ?? '')) || 0);

// 供應商是否為 AU：「是否AU」為自由文字，內容含「AU」(不分大小寫) 視為 AU，空白視為 Non-AU
export const isAUVendor = (isAUText?: string | null): boolean =>
  !!isAUText && String(isAUText).toUpperCase().includes('AU');

// 綜合評分 → 等級：AU 與 Non-AU 採不同分檔區間（下界不含、上界含）
// Non-AU：A>95，B(85,95]，C(75,85]，D(60,75]，E≤60
// AU：    A>98，B(90,98]，C(80,90]，D(70,80]，E≤70
export const gradeFromAssessmentScore = (
  score: number,
  isAU: boolean,
): 'A' | 'B' | 'C' | 'D' | 'E' => {
  if (isAU) {
    if (score > 98) return 'A';
    if (score > 90) return 'B';
    if (score > 80) return 'C';
    if (score > 70) return 'D';
    return 'E';
  }
  if (score > 95) return 'A';
  if (score > 85) return 'B';
  if (score > 75) return 'C';
  if (score > 60) return 'D';
  return 'E';
};

export const calculateComprehensiveReport = (
  qualityReport: QualityReportData,
  purchaseReport: PurchaseReportData,
  existingComprehensive?: ComprehensiveReportData,
  isAU: boolean = false,
): ComprehensiveReportData => {
  // 本季無交易判定：品質評鑑報告的檢驗批數、退貨批數皆為0，且其手動輸入項（外部客訴件數、
  // 產線CAR件數、延遲回覆件數、服務評分-QC）皆為0（即手動輸入無異常）。
  const isNoTransaction =
    toNum(qualityReport.receivedBatches) === 0 &&
    toNum(qualityReport.returnedBatches) === 0 &&
    toNum(qualityReport.externalCAR) === 0 &&
    toNum(qualityReport.arr) === 0 &&
    toNum(qualityReport.untimelyResponseCCR) === 0 &&
    toNum(qualityReport.service) === 0;

  // 本季無交易：品質總分/交期分數/服務分數/綜合評分/降級決策/等級 六欄一律顯示「—」（值設為 null），
  // 備註固定為「本季无交易」並於畫面鎖定（灰化、不可編輯）。
  if (isNoTransaction) {
    return {
      vendorName: qualityReport.vendorName,
      totalQualityScore: null,
      deliveryScore: null,
      serviceScore: null,
      assessmentScore: null,
      downgradeDecision: null,
      grade: null,
      remarks: '本季无交易',
      downgradeLevelA: null,
      downgradeLevelB: null,
      downgradeLevelC: null,
      finalAssessmentGrade: null,
      noTransaction: true,
    };
  }

  const remarks = existingComprehensive?.remarks ?? null;

  if (qualityReport.qualityAssessmentScoreC1 === null || purchaseReport.totalPurchaseAssessmentScoreA === null) {
    return {
      vendorName: qualityReport.vendorName,
      totalQualityScore: null,
      deliveryScore: null,
      serviceScore: null,
      assessmentScore: null,
      downgradeDecision: null,
      grade: null,
      remarks,
      downgradeLevelA: null,
      downgradeLevelB: null,
      downgradeLevelC: null,
      finalAssessmentGrade: null,
    };
  }
  
  // 品質總分 = 品质评鉴报告的品质评分-QC评分 = qualityAssessmentScoreC1 (LAR + CAR = 70)
  const qcScore = qualityReport.qualityAssessmentScoreC1;
  // 交期分數 = 采购评鉴的采购评核 = totalPurchaseAssessmentScoreA (20)
  const purchaseScore = purchaseReport.totalPurchaseAssessmentScoreA;
  // 服務分數 = 品质评鉴报告的服务评分 + 采购评鉴报告的服务评分 = 0-10
  const qcServiceScore = qualityReport.service || 0;
  const purchaseServiceScore = purchaseReport.service || 0;
  const totalServiceScore = Math.round((qcServiceScore + purchaseServiceScore) * 100) / 100;
  // 綜合評分 = 品質總分 + 交期分數 + 服務分數 = 70 + 20 + 10 = 100
  const assessmentScore = Math.round((qcScore + (purchaseScore || 0) + qcServiceScore + purchaseServiceScore) * 100) / 100;
  
  // 等級判断（依供應商 AU/Non-AU 採不同分檔）
  const grade: 'A' | 'B' | 'C' | 'D' | 'E' | null = gradeFromAssessmentScore(assessmentScore, isAU);
  
  // 降级决策：品质或交期分数过低时触发降等
  const downgradeLevelA = grade === 'A' && (qcScore < 56 || (purchaseScore || 0) < 15);
  const downgradeLevelB = grade === 'B' && (qcScore < 56 || (purchaseScore || 0) < 15);
  const downgradeLevelC = grade === 'C' && (qcScore < 56 && (purchaseScore || 0) < 15);
  
  let finalAssessmentGrade: 'A' | 'B' | 'C' | 'D' | 'E' | null = null;
  if (!downgradeLevelA && !downgradeLevelB && !downgradeLevelC) {
    finalAssessmentGrade = grade;
  } else if (!downgradeLevelA && !downgradeLevelB) {
    finalAssessmentGrade = 'D';
  } else if (!downgradeLevelA) {
    finalAssessmentGrade = 'C';
  } else {
    finalAssessmentGrade = 'B';
  }
  
  return {
    vendorName: qualityReport.vendorName,
    totalQualityScore: qcScore,
    deliveryScore: purchaseScore,
    serviceScore: totalServiceScore,
    assessmentScore,
    downgradeDecision: downgradeLevelA || downgradeLevelB || downgradeLevelC,
    grade,
    remarks,
    downgradeLevelA,
    downgradeLevelB,
    downgradeLevelC,
    finalAssessmentGrade,
  };
};

const GRADE_ORDER: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];

// 返回上一季的 periodStore 鍵（例：'2024-Q3' → '2024-Q2'，'2024-Q1' → '2023-Q4'）
export const getPrevQuarterKey = (year: string, period: string): string | null => {
  const idx = ['Q1', 'Q2', 'Q3', 'Q4'].indexOf(period);
  if (idx === -1) return null;
  return idx === 0 ? `${Number(year) - 1}-Q4` : `${year}-Q${idx}`;
};

// 降等規則4：連續2季（含）以上評核等級為C或D，再向下降低1個等級
export const applyConsecutiveDowngradeToList = (
  comps: ComprehensiveReportData[],
  prevGrades: Record<string, 'A' | 'B' | 'C' | 'D' | 'E' | null>,
): ComprehensiveReportData[] => {
  if (!prevGrades || Object.keys(prevGrades).length === 0) return comps;
  return comps.map(c => {
    const prevGrade = prevGrades[c.vendorName] ?? null;
    const current = c.finalAssessmentGrade ?? null;
    if (!prevGrade || !current) return c;
    if ((current === 'C' || current === 'D') && (prevGrade === 'C' || prevGrade === 'D')) {
      const idx = GRADE_ORDER.indexOf(current);
      const newGrade = idx < GRADE_ORDER.length - 1 ? GRADE_ORDER[idx + 1] : current;
      return { ...c, finalAssessmentGrade: newGrade, downgradeDecision: true, consecutiveDowngrade: true };
    }
    return c;
  });
};




