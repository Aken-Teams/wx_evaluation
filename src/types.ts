﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿export interface ParsedExcelResult {
  data: QualityAnalysisData[];
  parsedYear?: number | null;
  parsedQuarter?: string | null;
}

// SQM/VQM 廠商進料品質評價分析表數據
export interface QualityAnalysisData {
  vendorName: string;
  receivedQuantity: string;
  receivedBatches: number | string; // 支持數字或字符串（用於多行顯示）
  returnedQuantity: string;
  returnedBatches: number | string; // 支持數字或字符串（用於多行顯示）
  arr: number;
  lrr: number;
  externalCAR: number;
  untimelyResponseCCR: number;
  others: number;
  service: number;
  lateDelivery: number;
  deliveryRate?: number | null; // 達交率（手動輸入，0-100）
  deliveryDeduction: number;
  specialApproval: number;
  productionLineStop: number;
  excessFreight: number;
  inspectionTime?: string; // 檢驗時間（如 2026Q1）
}

// SQM/VQM 品質評鑑報告數據
export interface QualityReportData {
  vendorName: string;
  receivedQuantity: string;
  receivedBatches: number;
  returnedQuantity: string;
  returnedBatches: number;
  arr: number;
  lrr: number;
  externalCAR: number;
  untimelyResponseCCR: number;
  totalBaseScoreB: number | null;
  others: number;
  qualityAssessmentScoreC1: number | null;
  qualityAssessmentScoreC: number | null;
  service: number;
}

// 採購評鑑報告數據
export interface PurchaseReportData {
  vendorName: string;
  receivedBatches: number;
  returnedBatches: number; // 退貨批數（與品質評鑑報告一致）
  lateDelivery: number;
  deliveryRate: number | null;
  deliveryDeduction: number;
  specialApproval: number;
  productionLineStop: number;
  totalPurchaseAssessmentScoreA: number | null;
  service: number;
  assessmentScore: number | null;
}

// 綜合評價表數據
export interface ComprehensiveReportData {
  vendorName: string;
  totalQualityScore: number | null;
  deliveryScore: number | null;
  serviceScore: number | null;
  assessmentScore: number | null;
  downgradeDecision: boolean | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  remarks?: string | null;
  downgradeLevelA?: boolean | null;
  downgradeLevelB?: boolean | null;
  downgradeLevelC?: boolean | null;
  finalAssessmentGrade?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  consecutiveDowngrade?: boolean | null;
  noTransaction?: boolean | null;   // 本季无交易：检验批数/退货批数为0且手动项均无异常，各评分栏显示「—」、备注锁定
}

// 年度供應商評鑑表（彙整後）
export interface YearlyEvaluationData {
  sequenceNo?: number | null;             // 序號
  vendorName: string;                     // 供應商名稱
  vendorCode?: string | null;             // 代號
  vendorType?: string;                    // 供應商類型（國內廠商/國外廠商）
  supplierType?: string;                  // 歸一化後的供應商地區（国内/国外/海外，後端 region 優先）
  year?: number;                          // 年份
  monthlyAssessmentScores?: Partial<Record<string, number | null>>; // 季考核得分 Q1~Q4
  monthlyAssessmentSummary?: number | null;   // 季平均得分
  monthlyPurchaseQuantities?: Partial<Record<string, number | null>>; // 季採購量 Q1~Q4
  purchaseTradingMonths?: number | null;  // 交易月數
  purchaseTotalQuantity?: number | null;  // 交易總量
  annualAudit?: {                         // 年度稽核各分項
    VDA?: number | null;
    QSA?: number | null;
    QPA?: number | null;
    HSF?: number | null;
    CSR?: number | null;
  };
  others?: number | null;                 // 其他
  annualScore?: number | null;            // 年度分數
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | null; // 年度等級
  nextYearAuditType?: string | null;      // 下年度稽核計畫-稽核類型
  remarks?: string | null;                // 備註
}

// SQM/VQM供應商管理數據
export interface SQMVQMData {
  id: string;
  vendorName: string;
  supplierCode: string;
  supplierType: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  qualificationStatus: string;
  auditDate: string;
  auditScore: number;
  nextAuditDate: string;
  remarks: string;
}

// OSAT供應商管理數據
export interface OSATData {
  id: string;
  vendorName: string;
  supplierCode: string;
  packageType: string;
  technologyNode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  qualificationStatus: string;
  auditDate: string;
  auditScore: number;
  nextAuditDate: string;
  capacity: string;
  leadTime: string;
  qualityRating: number;
  remarks: string;
}


