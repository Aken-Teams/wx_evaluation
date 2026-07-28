﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import * as XLSX from 'xlsx';
import { QualityReportData, PurchaseReportData, ComprehensiveReportData, YearlyEvaluationData, SQMVQMData } from '../types';

// LAR 評分（與品質評鑑報告 UI 計算一致）
const calcLARScore = (larPercent: number | null): number => {
  if (larPercent === null || larPercent < 0) return 0;
  if (larPercent >= 100) return 30;
  if (larPercent >= 99) return 28;
  if (larPercent >= 95) return 26;
  if (larPercent >= 85) return 22;
  if (larPercent >= 80) return 18;
  if (larPercent >= 75) return 14;
  return 0;
};

export const exportMonthlyToExcel = (
  qualityData: QualityReportData[],
  purchaseData: PurchaseReportData[],
  comprehensiveData: ComprehensiveReportData[],
  year: string,
  period: string,
  isQuarterly: boolean = false,
  vendorCategoryMap: Record<string, string> = {}
) => {
  const workbook = XLSX.utils.book_new();

  // 品質評鑑報告（欄位與當前頁面一致）
  const qualitySheet = qualityData.map((item, index) => {
    // 檢驗批數為0時 LAR% 預設100（與UI一致）
    const larPercent = item.receivedBatches === 0
      ? 100
      : (1 - item.returnedBatches / item.receivedBatches) * 100;
    return {
      '序號': index + 1,
      '廠商名稱': item.vendorName,
      '物料類別': vendorCategoryMap[item.vendorName] || '',
      '检验批数': item.receivedBatches,
      '退貨批數': item.receivedBatches === 0 ? 0 : item.returnedBatches,
      'LAR(%)': larPercent.toFixed(2),
      '外部客诉件数': item.externalCAR,
      '产线(CAR件数)': item.arr,
      '延迟回复件数': item.untimelyResponseCCR,
      'LAR评分(30分)': calcLARScore(larPercent),
      'CAR评分(40分)': item.totalBaseScoreB != null ? item.totalBaseScoreB.toFixed(2) : '',
      '品质评分-QC评分(70分)': item.qualityAssessmentScoreC1 != null ? item.qualityAssessmentScoreC1.toFixed(2) : '',
      '服务评分-QC评分(5分)': item.service,
    };
  });

  // 採購評鑑報告（欄位與當前頁面一致）
  const purchaseSheet = purchaseData.map((item, index) => ({
    '序號': index + 1,
    '廠商名稱': item.vendorName,
    '物料類別': vendorCategoryMap[item.vendorName] || '',
    '進貨批數': item.receivedBatches,
    '退貨批數': item.returnedBatches,
    '达交率(%)': item.deliveryRate != null ? item.deliveryRate.toFixed(1) : '',
    '达交率扣分项': item.deliveryDeduction ?? 0,
    '特採': item.specialApproval,
    '断线次数': item.productionLineStop,
    '采购评核(20分)': item.totalPurchaseAssessmentScoreA?.toFixed(2) || '',
    '服务评分-采购评分(5分)': item.service,
  }));

  // 綜合評價表（欄位與當前頁面一致）
  // 與頁面 formatScore 保持一致：null/NaN 顯示「—」，否則保留兩位小數
  const fmtCompScore = (v: number | null | undefined) =>
    (v === null || v === undefined || Number.isNaN(v)) ? '—' : v.toFixed(2);
  const comprehensiveSheet = comprehensiveData.map((item, index) => ({
    '序号': index + 1,
    '厂商名称': item.vendorName,
    '物料類別': vendorCategoryMap[item.vendorName] || '',
    // 本季無交易：六個評分欄一律顯示「—」，備註固定「本季无交易」，與頁面一致
    '品質總分': fmtCompScore(item.totalQualityScore),
    '交期分數': fmtCompScore(item.deliveryScore),
    '服務分數': fmtCompScore(item.serviceScore),
    '綜合評分': fmtCompScore(item.assessmentScore),
    '降級決策': item.noTransaction ? '—' : (item.downgradeDecision ? '是' : '否'),
    '等級': item.noTransaction ? '—' : (item.finalAssessmentGrade || item.grade || '—'),
    '備註': item.noTransaction ? '本季无交易' : (item.remarks || ''),
  }));

  // 建立工作表
  const qualityWorksheet = XLSX.utils.json_to_sheet(qualitySheet);
  const purchaseWorksheet = XLSX.utils.json_to_sheet(purchaseSheet);
  const comprehensiveWorksheet = XLSX.utils.json_to_sheet(comprehensiveSheet);

  // 設定欄寬
  qualityWorksheet['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ];
  purchaseWorksheet['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
  ];
  comprehensiveWorksheet['!cols'] = [
    { wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 30 },
  ];

  // 加入工作表到活頁簿
  XLSX.utils.book_append_sheet(workbook, qualityWorksheet, '品質評鑑報告');
  XLSX.utils.book_append_sheet(workbook, purchaseWorksheet, '採購評鑑報告');
  XLSX.utils.book_append_sheet(workbook, comprehensiveWorksheet, '綜合評價表');

  // 下載檔案
  const fileName = `${year}年${period}${isQuarterly ? '' : '月'}供應商評核報告.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportYearlyToExcel = (yearlyData: YearlyEvaluationData[], year: string, vendorCategoryMap: Record<string, string> = {}) => {
  const fmtScore = (v: number | null | undefined) => (v != null ? v.toFixed(2) : '');
  const fmtAudit = (v: number | null | undefined) => (v != null ? v.toFixed(1) : '');
  // OSAT 無物料類別，對照表為空時不輸出該欄
  const hasCategory = Object.keys(vendorCategoryMap).length > 0;

  const sheet = yearlyData.map((item, index) => {
    // 下年度稽核計畫-稽核類型：国内/海外 → 实地稽核；国外 → 文件审核（優先用後端回傳值）
    const isForeign = item.supplierType === '国外';
    const auditType = item.nextYearAuditType || (isForeign ? '文件审核' : '实地稽核');

    return {
      '序號': index + 1,
      '供應商名稱': item.vendorName,
      ...(hasCategory ? { '物料類別': vendorCategoryMap[item.vendorName] || '' } : {}),
      'Q1': fmtScore(item.monthlyAssessmentScores?.['Q1']),
      'Q2': fmtScore(item.monthlyAssessmentScores?.['Q2']),
      'Q3': fmtScore(item.monthlyAssessmentScores?.['Q3']),
      'Q4': fmtScore(item.monthlyAssessmentScores?.['Q4']),
      '季平均得分': fmtScore(item.monthlyAssessmentSummary),
      'VDA': fmtAudit(item.annualAudit?.VDA),
      'QSA': fmtAudit(item.annualAudit?.QSA),
      'QPA': fmtAudit(item.annualAudit?.QPA),
      'HSF': fmtAudit(item.annualAudit?.HSF),
      '年度分數': fmtScore(item.annualScore),
      '年度等級': item.grade || '',
      '下年度稽核計畫-稽核類型': auditType,
      '備註': item.remarks || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(sheet);

  // 設定欄寬（對應上面欄位順序）
  worksheet['!cols'] = [
    { wch: 5 }, { wch: 28 }, // 序號, 供應商名稱
    ...(hasCategory ? [{ wch: 18 }] : []), // 物料類別
    { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, // Q1-Q4
    { wch: 12 }, // 季平均得分
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, // VDA, QSA, QPA, HSF
    { wch: 10 }, { wch: 10 }, // 年度分數, 年度等級
    { wch: 24 }, { wch: 24 }, // 下年度稽核類型, 備註
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${year}年度供應商評鑑表`);

  const fileName = `${year}年度供應商評鑑表.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportSQMVQMToExcel = (sqmVqmData: SQMVQMData[], year: string) => {
  const sheet = sqmVqmData.map((item, index) => ({
    '序號': index + 1,
    '供應商名稱': item.vendorName,
    '供應商代碼': item.supplierCode,
    '供應商類型': item.supplierType,
    '聯絡人': item.contactPerson,
    '聯絡電話': item.contactPhone,
    '聯絡信箱': item.contactEmail,
    '資格狀態': item.qualificationStatus,
    '稽核日期': item.auditDate,
    '稽核分數': item.auditScore?.toFixed(1) || '',
    '下次稽核日期': item.nextAuditDate,
    '備註': item.remarks,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheet);

  // 設定欄寬
  const cols = [
    { wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 30 }
  ];
  worksheet['!cols'] = cols;

  const workbook = XLSX.utils.book_new();
  // Excel 工作表名稱不能包含 : \ / ? * [ ] 等字符
  XLSX.utils.book_append_sheet(workbook, worksheet, `${year}年SQM-VQM供應商管理`);

  const fileName = `${year}年SQM_VQM供應商管理.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// 導出供應商列表
export const exportVendorListToExcel = (
  vendors: Array<{
    id: number;
    name: string;
    vendorType?: string;
    supplierCode?: string | null;
    materialCategory?: string | null;
    region?: string | null;
    isAU?: string | null;
    createdAt: string
  }>
) => {
  const sheet = vendors.map((vendor, index) => ({
    '序號': index + 1,
    '供應商名稱': vendor.name,
    '創建時間': new Date(vendor.createdAt).toLocaleString('zh-TW'),
    '供應商編號': vendor.supplierCode || '',
    '物料類別': vendor.materialCategory || '',
    '是否AU': vendor.isAU || '',
    '供應商地區': vendor.region || vendor.vendorType || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheet);

  // 設定欄寬（對應：序號/供應商名稱/創建時間/供應商編號/物料類別/是否AU/供應商地區）
  const cols = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
  worksheet['!cols'] = cols;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SQM-VQM供應商列表');

  const fileName = `SQM_VQM供應商列表_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportUploadTemplate = () => {
  const templateData = [
    {
      '供应商': 'C-PAK PTE LTD',
      '检验时间': '2026Q1',
      '检验批数': 1,
      '退货批数': 0,
    },
    {
      '供应商': 'Lucky Forests Corporation Ltd.',
      '检验时间': '2026Q1',
      '检验批数': 7,
      '退货批数': 0,
    },
    {
      '供应商': '上海桐烨贸易商行',
      '检验时间': '2026Q1',
      '检验批数': 4,
      '退货批数': 0,
    },
    {
      '供应商': '东莞钛升半导体材料有限公司',
      '检验时间': '2026Q1',
      '检验批数': 6,
      '退货批数': 0,
    },
    {
      '供应商': '元隆电子股份有限公司',
      '检验时间': '2026Q1',
      '检验批数': 82,
      '退货批数': 0,
    },
    {
      '供应商': '光路新能源科技(江苏)有限公司',
      '检验时间': '2026Q1',
      '检验批数': 64,
      '退货批数': 0,
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  const cols = [
    { wch: 40 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
  ];
  worksheet['!cols'] = cols;

  XLSX.utils.book_append_sheet(workbook, worksheet, '供应商评核数据');

  const fileName = `供应商评核上传模板_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};





