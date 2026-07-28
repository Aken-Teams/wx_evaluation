﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { QualityAnalysisData, QualityReportData, PurchaseReportData, ComprehensiveReportData, YearlyEvaluationData } from '../types';
import { calculateQualityReport, calculatePurchaseReport, calculateComprehensiveReport, getPrevQuarterKey, applyConsecutiveDowngradeToList, isAUVendor } from '../services/reportService';
import api from '../services/api';
import { roundTo3Decimals } from '../utils/numberUtils';

interface ReportContextType {
  qualityAnalysisData: QualityAnalysisData[];
  qualityReportData: QualityReportData[];
  purchaseReportData: PurchaseReportData[];
  comprehensiveReportData: ComprehensiveReportData[];
  setQualityAnalysisData: (data: QualityAnalysisData[]) => void;
  setQualityReportData: (data: QualityReportData[]) => void;
  setPurchaseReportData: (data: PurchaseReportData[]) => void;
  setComprehensiveReportData: (data: ComprehensiveReportData[]) => void;
  updateQualityReport: (field: string, value: string, index: number) => void;
  updatePurchaseReport: (field: string, value: string, index: number) => void;
  updateComprehensiveReport: (field: string, value: string | null, index: number) => void;
  calculateReports: () => void;
  setActivePeriod: (year: string, month: string) => void;
  getYearlyEvaluationRows: (year: string) => Promise<YearlyEvaluationData[]>;
  setAnnualAuditField: (year: string, vendorName: string, field: keyof NonNullable<YearlyEvaluationData['annualAudit']>, value: number | null) => void;
  setCustomerClaim: (year: string, vendorName: string, value: number | null) => void;
  setOthers: (year: string, vendorName: string, value: number | null) => void;
  setNextYearAuditType: (year: string, vendorName: string, value: string | null) => void;
  setRemarks: (year: string, vendorName: string, value: string | null) => void;
  clearCurrentMonthData: () => void;
  loadMonthlyFromServer: (year: string, month: string) => Promise<void>;
  loadAnnualFromServer: (year: string) => Promise<void>;
  isMonthlyDirty: (year: string, month: string) => boolean;
  isAnnualDirty: (year: string) => boolean;
  isSQMVQMDirty: (year: string) => boolean;
  markMonthlySaved: (year: string, month: string) => void;
  markAnnualSaved: (year: string) => void;
  markSQMVQMSaved: (year: string) => void;
  setAnnualAuditStore: React.Dispatch<React.SetStateAction<Record<string, Record<string, NonNullable<YearlyEvaluationData['annualAudit']>>>>>;
  setYearlyExtraStore: React.Dispatch<React.SetStateAction<Record<string, Record<string, { others: number | null; nextYearAuditType: string | null; remarks: string | null; }>>>>;
  annualAuditStore: Record<string, Record<string, NonNullable<YearlyEvaluationData['annualAudit']>>>;
  yearlyExtraStore: Record<string, Record<string, { others: number | null; nextYearAuditType: string | null; remarks: string | null; }>>;
  setDirtySQMVQM: (year: string, dirty: boolean) => void;
  periodStore: Record<string, PeriodEntry>;
  yearlyEvaluationStore: Record<string, YearlyEvaluationData[]>;
  // 供應商 → 物料類別 對照（供報告頁顯示物料類別欄位與篩選）
  vendorCategoryMap: Record<string, string>;
  // 供應商 → 是否AU 對照（綜合評分等級依 AU/Non-AU 採不同分檔）
  vendorAUMap: Record<string, boolean>;
  materialCategoryFilter: string;
  setMaterialCategoryFilter: (value: string) => void;
  loadVendorCategories: () => Promise<void>;
}

// 從伺服器原始項目計算各供應商的最終評核等級（用於降等規則4的上季等級查詢）
const computePrevQuarterGrades = (
  items: any[],
  auMap: Record<string, boolean> = {},
): Record<string, 'A' | 'B' | 'C' | 'D' | 'E' | null> => {
  const grades: Record<string, 'A' | 'B' | 'C' | 'D' | 'E' | null> = {};
  for (const m of items) {
    if (!m?.vendorName) continue;
    const base = {
      vendorName: m.vendorName,
      receivedQuantity: m.receivedQuantity ?? '0',
      receivedBatches: Number(m.receivedBatches ?? 0),
      returnedQuantity: m.returnedQuantity ?? '0',
      returnedBatches: Number(m.returnedBatches ?? 0),
      arr: Number(m.arr ?? 0),
      lrr: Number(m.lrr ?? 0),
      externalCAR: Number(m.externalCAR ?? 0),
      untimelyResponseCCR: Number(m.untimelyResponseCCR ?? 0),
      others: Number(m.others ?? 0),
      lateDelivery: Number(m.lateDelivery ?? 0),
      deliveryRate: m.deliveryRate != null ? Number(m.deliveryRate) : null,
      deliveryDeduction: 0,
      specialApproval: Number(m.specialApproval ?? 0),
      productionLineStop: Number(m.productionLineStop ?? 0),
      excessFreight: Number(m.excessFreight ?? 0),
      inspectionTime: m.inspectionTime ?? '',
    };
    const qr = calculateQualityReport({ ...base, service: Number(m.serviceQuality ?? 0) });
    const pr = calculatePurchaseReport({ ...base, service: Number(m.servicePurchase ?? m.serviceQuality ?? 0) });
    const comp = calculateComprehensiveReport(qr, pr, undefined, auMap[m.vendorName] ?? false);
    grades[m.vendorName] = comp.finalAssessmentGrade ?? comp.grade ?? null;
  }
  return grades;
};

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const useReportContext = () => {
  const context = useContext(ReportContext);
  if (!context) throw new Error('useReportContext must be used within a ReportProvider');
  return context;
};

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [qualityAnalysisData, setQualityAnalysisData] = useState<QualityAnalysisData[]>([]);
  const [qualityReportData, setQualityReportData] = useState<QualityReportData[]>([]);
  const [purchaseReportData, setPurchaseReportData] = useState<PurchaseReportData[]>([]);
  const [comprehensiveReportData, setComprehensiveReportData] = useState<ComprehensiveReportData[]>([]);

  const [activeYear, setActiveYear] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  type PeriodEntry = {
    qualityAnalysisData: QualityAnalysisData[];
    qualityReportData: QualityReportData[];
    purchaseReportData: PurchaseReportData[];
    comprehensiveReportData: ComprehensiveReportData[];
  };
  const [periodStore, setPeriodStore] = useState<Record<string, PeriodEntry>>({});
  const [dirtyMonthly, setDirtyMonthly] = useState<Record<string, boolean>>({});
  // 存放年度評鑑資料：year -> YearlyEvaluationData[]（類似 periodStore）
  const [yearlyEvaluationStore, setYearlyEvaluationStore] = useState<Record<string, YearlyEvaluationData[]>>({});
  // 存放年度稽核（使用者可輸入）資料：year -> vendorName -> audit fields
  const [annualAuditStore, setAnnualAuditStore] = useState<Record<string, Record<string, NonNullable<YearlyEvaluationData['annualAudit']>>>>({});
  const [yearlyExtraStore, setYearlyExtraStore] = useState<Record<string, Record<string, {
    others: number | null;
    nextYearAuditType: string | null;
    remarks: string | null;
  }>>>({});
  // 供應商 → 物料類別 對照表與篩選詞（季度三報表共用）
  const [vendorCategoryMap, setVendorCategoryMap] = useState<Record<string, string>>({});
  // 供應商 → 是否AU 對照（state 供顯示/依賴觸發重算；ref 供 async 內同步讀取最新值）
  const [vendorAUMap, setVendorAUMap] = useState<Record<string, boolean>>({});
  const vendorAUMapRef = useRef<Record<string, boolean>>({});
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState('');
  // 用於作廢清空前仍在飛行中的 loadMonthlyFromServer 請求
  const loadMonthlyVersionRef = useRef(0);
  // 上一季各供應商的最終評核等級（降等規則4：連續2季C/D再降一等）
  const prevQuarterGradesRef = useRef<Record<string, 'A' | 'B' | 'C' | 'D' | 'E' | null>>({});

  const loadVendorCategories = useCallback(async () => {
    try {
      const res = await api.get('/sqm-vqm/vendor-categories');
      const items = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, string> = {};
      const auMap: Record<string, boolean> = {};
      items.forEach((v: { name?: string; materialCategory?: string | null; isAU?: string | null }) => {
        if (v?.name) {
          map[v.name] = v.materialCategory ?? '';
          auMap[v.name] = isAUVendor(v.isAU);
        }
      });
      setVendorCategoryMap(map);
      vendorAUMapRef.current = auMap;
      setVendorAUMap(auMap);
    } catch (e) {
      console.warn('載入供應商物料類別對照失敗', e);
    }
  }, []);

  const getActiveKey = useCallback(() => (activeYear && activeMonth ? `${activeYear}-${activeMonth}` : null), [activeYear, activeMonth]);

  const setActivePeriod = (year: string, month: string) => {
    const currentKey = getActiveKey();
    const nextKey = `${year}-${month}`;

    if (currentKey) {
      setPeriodStore((prev) => ({
        ...prev,
        [currentKey]: {
          qualityAnalysisData,
          qualityReportData,
          purchaseReportData,
          comprehensiveReportData,
        },
      }));
    }

    if (!currentKey && !periodStore[nextKey]) {
      setPeriodStore((prev) => ({
        ...prev,
        [nextKey]: {
          qualityAnalysisData,
          qualityReportData,
          purchaseReportData,
          comprehensiveReportData,
        },
      }));
    }

    setActiveYear(year);
    setActiveMonth(month);

    const entry = periodStore[nextKey];
    if (entry) {
      setQualityAnalysisData(entry.qualityAnalysisData);
      setQualityReportData(entry.qualityReportData);
      setPurchaseReportData(entry.purchaseReportData);
      setComprehensiveReportData(entry.comprehensiveReportData);
    } else if (currentKey) {
      setQualityAnalysisData([]);
      setQualityReportData([]);
      setPurchaseReportData([]);
      setComprehensiveReportData([]);
    }
  };

  useEffect(() => {
    const key = getActiveKey();
    if (!key) return;
    
    const year = key.split('-')[0];
    
    setPeriodStore((prev) => ({
      ...prev,
      [key]: {
        qualityAnalysisData,
        qualityReportData,
        purchaseReportData,
        comprehensiveReportData,
      },
    }));
    
    setYearlyEvaluationStore((prev) => {
      const newStore = { ...prev };
      delete newStore[year];
      return newStore;
    });
  }, [qualityAnalysisData, qualityReportData, purchaseReportData, comprehensiveReportData, activeYear, activeMonth]);

  const getYearlyEvaluationRows = async (year: string): Promise<YearlyEvaluationData[]> => {
    // 優化：先檢查Context緩存
    if (yearlyEvaluationStore[year] && yearlyEvaluationStore[year].length > 0) {
      console.log(`📦 使用Context緩存資料: ${year}年度評鑑（${yearlyEvaluationStore[year].length} 筆）`);
      return yearlyEvaluationStore[year];
    }
    
    try {
      // 根據當前路徑決定使用哪個 API
      const endpoint = `/sqm-vqm/yearly-evaluation/${year}`;
      
      console.log(`🔍 調用年度評鑑API: ${endpoint}`);
      const res = await api.get(endpoint);
      const data = Array.isArray(res.data) ? res.data : [];
      
      console.log(`📊 獲取到 ${data.length} 筆年度評鑑資料`);
      
      // 保存到Context緩存
      setYearlyEvaluationStore((prev) => ({ ...prev, [year]: data }));
      
      return data;
    } catch (error) {
      console.error('❌ 調用年度評鑑API失敗，使用fallback:', error);
      // 如果API調用失敗，使用fallback函數
      const fallbackData = getYearlyEvaluationRowsFallback(year);
      // 保存fallback數據到Context緩存
      setYearlyEvaluationStore((prev) => ({ ...prev, [year]: fallbackData }));
      return fallbackData;
    }
  };

  // Fallback函數：保留原有的前端計算邏輯
  const getYearlyEvaluationRowsFallback = (year: string): YearlyEvaluationData[] => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterMonths: Record<string, string[]> = {
      'Q1': ['01', '02', '03'],
      'Q2': ['04', '05', '06'],
      'Q3': ['07', '08', '09'],
      'Q4': ['10', '11', '12'],
    };
    const vendorNames = new Set<string>();
    
    for (const q of quarters) {
      for (const mm of quarterMonths[q]) {
        const key = `${year}-${mm}`;
        const entry = periodStore[key];
        if (!entry || !Array.isArray(entry.comprehensiveReportData)) continue;
        for (const comp of entry.comprehensiveReportData) {
          if (comp && comp.vendorName) vendorNames.add(comp.vendorName);
        }
      }
    }
    
    const annualAuditVendors = Object.keys(annualAuditStore[year] || {});
    for (const v of annualAuditVendors) vendorNames.add(v);
    const yearlyExtraVendors = Object.keys(yearlyExtraStore[year] || {});
    for (const v of yearlyExtraVendors) vendorNames.add(v);

    const vendors = Array.from(vendorNames);
    const rows: YearlyEvaluationData[] = vendors.map((vendorName) => {
      const monthlyAssessmentScores: Record<string, number | null> = {};
      const monthlyPurchaseQuantities: Record<string, number | null> = {};
      
      for (const q of quarters) {
        const quarterScores: number[] = [];
        for (const mm of quarterMonths[q]) {
          const key = `${year}-${mm}`;
          const entry = periodStore[key];
          if (entry) {
            const foundComp = entry.comprehensiveReportData.find((r) => r.vendorName === vendorName);
            if (foundComp && foundComp.assessmentScore !== null && foundComp.assessmentScore !== undefined) {
              quarterScores.push(foundComp.assessmentScore);
            }
          }
        }
        
        if (quarterScores.length > 0) {
          monthlyAssessmentScores[q] = roundTo3Decimals(quarterScores.reduce((a, b) => a + b, 0) / quarterScores.length);
        } else {
          monthlyAssessmentScores[q] = 0;
        }
      }
      
      const quarterScoreValues = Object.values(monthlyAssessmentScores).filter((v) => typeof v === 'number' && v > 0) as number[];
      const monthlyAssessmentSummary = quarterScoreValues.length > 0 
        ? roundTo3Decimals(quarterScoreValues.reduce((a, b) => a + b, 0) / quarterScoreValues.length)
        : null;
      const monthQtyValues = Object.values(monthlyPurchaseQuantities).filter((v) => typeof v === 'number') as number[];
      const purchaseTradingMonths = monthQtyValues.filter((v) => (v ?? 0) > 0).length || null;
      const purchaseTotalQuantity = monthQtyValues.length > 0 ? monthQtyValues.reduce((a, b) => a + (b ?? 0), 0) : null;

      const auditOfVendor = annualAuditStore[year]?.[vendorName] || {};
      const extraOfVendor = yearlyExtraStore[year]?.[vendorName] || {
        others: null,
        nextYearAuditType: null,
        remarks: null,
      };

      // 計算年度分數
      const monthScore = monthlyAssessmentSummary
      let auditTenPctComponent: number = 0
      const vda = (annualAuditStore[year]?.[vendorName]?.VDA ?? null)
      const qsa = (annualAuditStore[year]?.[vendorName]?.QSA ?? null)
      const hsf = (annualAuditStore[year]?.[vendorName]?.HSF ?? null)
      // 年度稽核組件：有 VDA 分數時取「VDA 與 HSF」平均，無 VDA 時取「QSA 與 HSF」平均（僅計入已填寫的分項）
      // VDA = 0 視為 null（VDA 不可能為 0，雙重保護）
      const auditArr: number[] = []
      if (typeof vda === 'number' && vda > 0) {
        auditArr.push(vda)
      } else if (typeof qsa === 'number') {
        auditArr.push(qsa)
      }
      if (typeof hsf === 'number') auditArr.push(hsf)
      if (auditArr.length > 0) {
        auditTenPctComponent = auditArr.reduce((a, b) => a + b, 0) / auditArr.length
      }
      const annualScore = (monthScore == null)
        ? null
        : (() => {
            // 如果沒有年度稽核分數，只根據季考核分數計算
            // 精度：小數點後 3 位，與後端一致
            if (auditTenPctComponent === 0) {
              return Math.round(monthScore * 1000) / 1000;
            }
            
            return Math.round(((monthScore * 0.9) + (auditTenPctComponent * 0.1)) * 1000) / 1000;
          })()

      let grade: 'A' | 'B' | 'C' | 'D' | 'E' | null = null
      if (annualScore !== null) {
        if (annualScore >= 95) grade = 'A'
        else if (annualScore >= 85) grade = 'B'
        else if (annualScore >= 75) grade = 'C'
        else if (annualScore >= 60) grade = 'D'
        else grade = 'E'
      }

      const row: YearlyEvaluationData = {
        vendorName,
        vendorType: '國內廠商', // 預設值，實際應該從數據庫獲取
        monthlyAssessmentScores,
        monthlyAssessmentSummary,
        monthlyPurchaseQuantities,
        purchaseTradingMonths,
        purchaseTotalQuantity,
        annualAudit: auditOfVendor,
        others: extraOfVendor.others,
        annualScore,
        grade,
        nextYearAuditType: extraOfVendor.nextYearAuditType,
        remarks: extraOfVendor.remarks,
      };
      return row;
    });
    return rows;
  };


  const setAnnualAuditField = (
    year: string,
    vendorName: string,
    field: keyof NonNullable<YearlyEvaluationData['annualAudit']>,
    value: number | null,
  ) => {
    setAnnualAuditStore((prev) => {
      const yearMap = { ...(prev[year] || {}) };
      const vendorAudit = { ...(yearMap[vendorName] || {}) } as NonNullable<YearlyEvaluationData['annualAudit']>;
      vendorAudit[field] = value ?? null;
      yearMap[vendorName] = vendorAudit;
      return { ...prev, [year]: yearMap };
    });
    setDirtyAnnual((prev) => ({ ...prev, [year]: true }));
    
    // 觸發年度分數重新計算
    setTimeout(() => {
      const event = new CustomEvent('recalculateAnnualScore', { 
        detail: { year, vendorName, field, value } 
      });
      window.dispatchEvent(event);
    }, 0);
  };

  const clearCurrentMonthData = () => {
    // 使任何仍在飛行中的 loadMonthlyFromServer 結果失效
    loadMonthlyVersionRef.current += 1;
    setQualityAnalysisData([]);
    setQualityReportData([]);
    setPurchaseReportData([]);
    setComprehensiveReportData([]);
    const key = getActiveKey();
    if (key) {
      setPeriodStore((prev) => ({
        ...prev,
        [key]: {
          qualityAnalysisData: [],
          qualityReportData: [],
          purchaseReportData: [],
          comprehensiveReportData: [],
        },
      }));
    }
  };

  const upsertExtra = (year: string, vendorName: string, patch: Partial<{ others: number | null; nextYearAuditType: string | null; remarks: string | null; }>) => {
    setYearlyExtraStore((prev) => {
      const yearMap = { ...(prev[year] || {}) };
      const vendor = {
        ...(yearMap[vendorName] || {
          others: null,
          nextYearAuditType: null,
          remarks: null,
        }),
        ...patch,
      };
      yearMap[vendorName] = vendor;
      return { ...prev, [year]: yearMap };
    });
  };
  const setOthers = (year: string, vendorName: string, value: number | null) => { 
    upsertExtra(year, vendorName, { others: value }); 
    setDirtyAnnual((prev) => ({ ...prev, [year]: true })); 
    
    // 觸發年度分數重新計算
    setTimeout(() => {
      const event = new CustomEvent('recalculateAnnualScore', { 
        detail: { year, vendorName, field: 'others', value } 
      });
      window.dispatchEvent(event);
    }, 0);
  };
  const setNextYearAuditType = (year: string, vendorName: string, value: string | null) => { upsertExtra(year, vendorName, { nextYearAuditType: value }); setDirtyAnnual((prev) => ({ ...prev, [year]: true })); };
  const setRemarks = (year: string, vendorName: string, value: string | null) => { upsertExtra(year, vendorName, { remarks: value }); setDirtyAnnual((prev) => ({ ...prev, [year]: true })); };
  const setCustomerClaim = (year: string, vendorName: string, value: number | null) => { /* 暫時留空，因為這個功能可能不需要 */ };

  const updateQualityReport = useCallback((field: string, value: string, index: number) => {
    setQualityReportData((prev) => {
      const newData = [...prev];
      const numericValue = parseFloat(value) || 0;
      (newData[index] as any)[field] = numericValue;
      const currentReport = newData[index];
      
      const analysisData = {
        ...qualityAnalysisData[index],
        arr: currentReport.arr || 0,
        lrr: currentReport.lrr || 0,
        externalCAR: currentReport.externalCAR || 0,
        untimelyResponseCCR: currentReport.untimelyResponseCCR || 0,
        others: currentReport.others || 0,
        service: currentReport.service || 0,
        [field]: numericValue,
      };
      
      const updatedReport = calculateQualityReport(analysisData);
      newData[index] = { ...newData[index], ...updatedReport };
      const key = getActiveKey();
      if (key) setDirtyMonthly((prevDirty) => ({ ...prevDirty, [key]: true }));
      return newData;
    });
  }, [qualityAnalysisData, getActiveKey]);

  const updatePurchaseReport = useCallback((field: string, value: string, index: number) => {
    setPurchaseReportData((prev) => {
      const newData = [...prev];
      // 達交率為手動輸入的小數（0-100，保留1位小數）；服務評分允許 0.5（0-5）；其餘欄位為非負整數
      let parsedValue: number | null;
      if (field === 'deliveryRate') {
        const f = parseFloat(value);
        parsedValue = (value === '' || isNaN(f)) ? null : Math.round(Math.max(0, Math.min(100, f)) * 10) / 10;
      } else if (field === 'service') {
        const f = parseFloat(value);
        parsedValue = isNaN(f) ? 0 : Math.max(0, Math.min(5, f));
      } else {
        parsedValue = Math.max(0, Math.floor(Number(value)) || 0);
      }
      (newData[index] as any)[field] = parsedValue;
      const currentReport = newData[index];
      const updatedReport = calculatePurchaseReport({
        ...qualityAnalysisData[index],
        lateDelivery: currentReport.lateDelivery || 0,
        deliveryRate: currentReport.deliveryRate ?? null,
        deliveryDeduction: currentReport.deliveryDeduction || 0,
        specialApproval: currentReport.specialApproval,
        productionLineStop: currentReport.productionLineStop,
        service: currentReport.service,
        [field]: parsedValue,
      });
      newData[index] = { ...newData[index], ...updatedReport };
      const key = getActiveKey();
      if (key) setDirtyMonthly((prevDirty) => ({ ...prevDirty, [key]: true }));
      return newData;
    });
  }, [qualityAnalysisData, getActiveKey]);

  const updateComprehensiveReport = useCallback((field: string, value: string | null, index: number) => {
    setComprehensiveReportData((prev) => {
      const newData = [...prev];
      let processedValue: string | null | boolean = value;
      
      if (field === 'downgradeLevelA' || field === 'downgradeLevelB' || field === 'downgradeLevelC') {
        processedValue = value === 'true';
      } else if (field === 'finalAssessmentGrade') {
        processedValue = value === '' ? null : value;
      }
      
      (newData[index] as any)[field] = processedValue;
      return newData;
    });
    
    const key = getActiveKey();
    if (key) setDirtyMonthly((prevDirty) => ({ ...prevDirty, [key]: true }));
  }, [getActiveKey]);

  const calculateReports = () => {
    const newQualityReports = qualityAnalysisData.map(calculateQualityReport);
    setQualityReportData(newQualityReports);
    const newPurchaseReports = qualityAnalysisData.map(calculatePurchaseReport);
    setPurchaseReportData(newPurchaseReports);
    const basics = newQualityReports.map((q, i) => {
      const existing = comprehensiveReportData.find(c => c.vendorName === q.vendorName);
      return calculateComprehensiveReport(q, newPurchaseReports[i], existing, vendorAUMapRef.current[q.vendorName] ?? false);
    });
    // 降等規則4：連續2季C/D再降一等
    const newComprehensiveReports = applyConsecutiveDowngradeToList(basics, prevQuarterGradesRef.current);
    setComprehensiveReportData(newComprehensiveReports);
  };

  useEffect(() => {
    if (qualityReportData.length === 0 || purchaseReportData.length === 0) {
      setComprehensiveReportData([]);
      return;
    }
    if (qualityReportData.length !== purchaseReportData.length) return;
    const basics = qualityReportData.map((q, i) => {
      const existing = comprehensiveReportData.find(c => c.vendorName === q.vendorName);
      return calculateComprehensiveReport(q, purchaseReportData[i], existing, vendorAUMapRef.current[q.vendorName] ?? false);
    });
    // 降等規則4：連續2季C/D再降一等
    const newComprehensive = applyConsecutiveDowngradeToList(basics, prevQuarterGradesRef.current);
    setComprehensiveReportData(newComprehensive);
  }, [qualityReportData, purchaseReportData, vendorAUMap]);

  const loadMonthlyFromServer = async (year: string, period: string) => {
    const endpoint = `/sqm-vqm/quarterly/${year}/${period}`;
    // 記錄本次請求的版本號，若清空後版本號已變則丟棄結果
    loadMonthlyVersionRef.current += 1;
    const myVersion = loadMonthlyVersionRef.current;

    console.log(`🔍 正在載入 SQM/VQM ${year}年${period}季數據...`);
    console.log(`🔗 API端點: ${endpoint}`);

    const res = await api.get(endpoint);
    // 若在請求期間使用者清空了資料，丟棄此結果
    if (myVersion !== loadMonthlyVersionRef.current) {
      console.log(`⚠️ 載入結果已作廢（版本 ${myVersion} vs 當前 ${loadMonthlyVersionRef.current}），略過`);
      return;
    }
    const items = Array.isArray(res.data) ? res.data : [];
    
    console.log(`📊 從後端載入的數據條數: ${items.length}`);
    console.log(`📋 載入的數據:`, items);
    const qa: QualityAnalysisData[] = items.map((m: any) => ({
      vendorName: m.vendorName,
      receivedQuantity: m.receivedQuantity ?? '0',
      receivedBatches: Number(m.receivedBatches ?? 0),
      returnedQuantity: m.returnedQuantity ?? '0',
      returnedBatches: Number(m.returnedBatches ?? 0),
      arr: Number(m.arr ?? 0),
      lrr: Number(m.lrr ?? 0),
      externalCAR: Number(m.externalCAR ?? 0),
      untimelyResponseCCR: Number(m.untimelyResponseCCR ?? 0),
      others: Number(m.others ?? 0),
      service: Number(m.serviceQuality ?? 0),
      lateDelivery: Number(m.lateDelivery ?? 0),
      specialApproval: Number(m.specialApproval ?? 0),
      productionLineStop: Number(m.productionLineStop ?? 0),
      excessFreight: Number(m.excessFreight ?? 0),
    }));
    const qr: QualityReportData[] = items.map((m: any) => {
      const analysisData: QualityAnalysisData = {
        vendorName: m.vendorName,
        receivedQuantity: m.receivedQuantity ?? '0',
        receivedBatches: Number(m.receivedBatches ?? 0),
        returnedQuantity: m.returnedQuantity ?? '0',
        returnedBatches: Number(m.returnedBatches ?? 0),
        arr: Number(m.arr ?? 0),
        lrr: Number(m.lrr ?? 0),
        externalCAR: Number(m.externalCAR ?? 0),
        untimelyResponseCCR: Number(m.untimelyResponseCCR ?? 0),
        others: Number(m.others ?? 0),
        service: Number(m.serviceQuality ?? 0),
        lateDelivery: Number(m.lateDelivery ?? 0),
        specialApproval: Number(m.specialApproval ?? 0),
        productionLineStop: Number(m.productionLineStop ?? 0),
        excessFreight: Number(m.excessFreight ?? 0),
      };
      return calculateQualityReport(analysisData);
    });
    const pr: PurchaseReportData[] = items.map((m: any) => {
      const receivedBatches = Number(m.receivedBatches ?? 0);
      const lateDelivery = Number(m.lateDelivery ?? 0);
      const service = Number(m.servicePurchase ?? m.serviceQuality ?? 0);
      // 使用 calculatePurchaseReport 统一计算达交率、扣分值与采购评核
      const computed = calculatePurchaseReport({
        vendorName: m.vendorName,
        receivedQuantity: m.receivedQuantity ?? '',
        returnedQuantity: m.returnedQuantity ?? '',
        returnedBatches: m.returnedBatches ?? 0,
        arr: Number(m.arr ?? 0),
        lrr: Number(m.lrr ?? 0),
        externalCAR: Number(m.externalCAR ?? 0),
        untimelyResponseCCR: Number(m.untimelyResponseCCR ?? 0),
        others: Number(m.others ?? 0),
        service: Number(m.serviceQuality ?? 0),
        receivedBatches,
        lateDelivery,
        deliveryRate: (m.deliveryRate === null || m.deliveryRate === undefined) ? null : Number(m.deliveryRate),
        deliveryDeduction: 0,
        specialApproval: Number(m.specialApproval ?? 0),
        productionLineStop: Number(m.productionLineStop ?? 0),
        excessFreight: Number(m.excessFreight ?? 0),
        inspectionTime: m.inspectionTime ?? '',
      });
      return {
        ...computed,
        service, // 用采购的服务评分
        assessmentScore: m.assessmentScore ?? null,
      };
    });
    const comp: ComprehensiveReportData[] = qr.map((q, i) => {
      const existing = comprehensiveReportData.find(c => c.vendorName === q.vendorName);
      const calculated = calculateComprehensiveReport(q, pr[i], existing, vendorAUMapRef.current[q.vendorName] ?? false);
      // 本季无交易：备注固定为「本季无交易」（忽略后端旧备注）；否则后端已保存的 remarks 优先，无则沿用计算结果
      return {
        ...calculated,
        remarks: calculated.noTransaction ? calculated.remarks : (items[i]?.remarks ?? calculated.remarks),
      };
    });

    // 降等規則4：連續2季（含）以上評核等級為C或D者，再向下降低1個等級
    // 優先從 periodStore 取上季資料，否則向伺服器請求
    const prevKey = getPrevQuarterKey(year, period);
    let prevGrades: Record<string, 'A' | 'B' | 'C' | 'D' | 'E' | null> = {};
    if (prevKey) {
      const prevEntry = periodStore[prevKey];
      if (prevEntry?.comprehensiveReportData?.length) {
        for (const c of prevEntry.comprehensiveReportData) {
          if (c?.vendorName) prevGrades[c.vendorName] = c.finalAssessmentGrade ?? c.grade ?? null;
        }
      } else {
        try {
          const [prevYear, prevPeriod] = prevKey.split('-');
          const prevRes = await api.get(`/sqm-vqm/quarterly/${prevYear}/${prevPeriod}`);
          const prevItems = Array.isArray(prevRes.data) ? prevRes.data : [];
          if (prevItems.length > 0) prevGrades = computePrevQuarterGrades(prevItems, vendorAUMapRef.current);
        } catch {
          // 上季資料不存在或載入失敗，跳過規則4
        }
      }
    }
    prevQuarterGradesRef.current = prevGrades;
    const finalComp = applyConsecutiveDowngradeToList(comp, prevGrades);

    console.log(`✅ 設置數據到state:`);
    console.log(`  - qualityAnalysisData: ${qa.length}條`);
    console.log(`  - qualityReportData: ${qr.length}條`);
    console.log(`  - purchaseReportData: ${pr.length}條`);
    console.log(`  - comprehensiveReportData: ${finalComp.length}條`);

    setQualityAnalysisData(qa);
    setQualityReportData(qr);
    setPurchaseReportData(pr);
    setComprehensiveReportData(finalComp);
    const key = `${year}-${period}`;
    setDirtyMonthly((prev) => ({ ...prev, [key]: false }));

    console.log(`✅ 數據載入完成，已設置到state中`);
  };

  const loadAnnualFromServer = async (year: string) => {
    const endpoint = `/sqm-vqm/annual/${year}`;
    const res = await api.get(endpoint);
    const items = Array.isArray(res.data) ? res.data : [];
    setAnnualAuditStore((prev) => {
      const yearMap: Record<string, NonNullable<YearlyEvaluationData['annualAudit']>> = {};
      for (const a of items) {
        yearMap[a.vendorName] = {
          VDA: a.VDA ?? null,
          QSA: a.QSA ?? null,
          QPA: a.QPA ?? null,
          HSF: a.HSF ?? null,
          CSR: a.CSR ?? null,
        };
      }
      return { ...prev, [year]: yearMap };
    });
    setYearlyExtraStore((prev) => {
      const yearMap: Record<string, { others: number | null; nextYearAuditType: string | null; remarks: string | null; }> = {};
      for (const a of items) {
        yearMap[a.vendorName] = {
          others: a.others ?? null,
          nextYearAuditType: a.nextYearAuditType ?? null,
          remarks: a.remarks ?? null,
        };
      }
      return { ...prev, [year]: yearMap };
    });
    setDirtyAnnual((prev) => ({ ...prev, [year]: false }));
  };

  const isMonthlyDirty = (year: string, month: string) => {
    const key = `${year}-${month}`;
    return !!dirtyMonthly[key];
  };

  const [dirtyAnnual, setDirtyAnnual] = useState<Record<string, boolean>>({});
  const [dirtySQMVQM, setDirtySQMVQMState] = useState<Record<string, boolean>>({});
  
  const isAnnualDirty = (year: string) => !!dirtyAnnual[year];
  const isSQMVQMDirty = (year: string) => !!dirtySQMVQM[year];

  const markMonthlySaved = (year: string, month: string) => {
    const key = `${year}-${month}`;
    setDirtyMonthly((prev) => ({ ...prev, [key]: false }));
  };
  const markAnnualSaved = (year: string) => {
    setDirtyAnnual((prev) => ({ ...prev, [year]: false }));
  };
  const markSQMVQMSaved = (year: string) => {
    setDirtySQMVQMState((prev) => ({ ...prev, [year]: false }));
  };
  
  const setDirtySQMVQM = (year: string, dirty: boolean) => {
    setDirtySQMVQMState((prev) => ({ ...prev, [year]: dirty }));
  };

  return (
    <ReportContext.Provider
      value={{
        qualityAnalysisData,
        qualityReportData,
        purchaseReportData,
        comprehensiveReportData,
        setQualityAnalysisData,
        setQualityReportData,
        setPurchaseReportData,
        setComprehensiveReportData,
        updateQualityReport,
        updatePurchaseReport,
        updateComprehensiveReport,
        calculateReports,
        setActivePeriod,
        getYearlyEvaluationRows,
        setAnnualAuditField,
        setOthers,
        setNextYearAuditType,
        setRemarks,
        clearCurrentMonthData,
        loadMonthlyFromServer,
        loadAnnualFromServer,
        isMonthlyDirty,
        isAnnualDirty,
        isSQMVQMDirty,
        markMonthlySaved,
        markAnnualSaved,
        markSQMVQMSaved,
        setAnnualAuditStore,
        setYearlyExtraStore,
        annualAuditStore,
        yearlyExtraStore,
        setDirtySQMVQM,
        periodStore,
        yearlyEvaluationStore,
        vendorCategoryMap,
        vendorAUMap,
        materialCategoryFilter,
        setMaterialCategoryFilter,
        loadVendorCategories,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
};



