﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useState } from 'react';
import { useReportContext } from '../contexts/ReportContext';
import { parseExcelFile } from '../utils/excelParser';
import {
  calculateQualityReport,
  calculatePurchaseReport,
  calculateComprehensiveReport,
} from '../services/reportService';

export const useFileUpload = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedYear, setParsedYear] = useState<number | null>(null);
  const [parsedQuarter, setParsedQuarter] = useState<string | null>(null);

  const {
    qualityAnalysisData,
    setQualityAnalysisData,
    setQualityReportData,
    setPurchaseReportData,
    setComprehensiveReportData,
  } = useReportContext();

  const handleFileUpload = async (file: File) => {
    // 若已有實際批次資料則禁止重覆上傳（名冊空行不計入）
    const hasActualBatchData = qualityAnalysisData.some(qa => {
      const b = typeof qa.receivedBatches === 'string' ? parseInt(qa.receivedBatches) || 0 : (qa.receivedBatches as number);
      return b > 0;
    });
    if (hasActualBatchData) {
      setError('本季度已有上傳資料，已禁止再次上傳。請於表格直接修改，或清空季度資料後再上傳。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedYear(null);
    setParsedQuarter(null);

    try {
      const result = await parseExcelFile(file);
      const analysisData = result.data;
      
      if (!Array.isArray(analysisData) || analysisData.length === 0) {
        throw new Error('未能從檔案解析到任何資料，請確認檔案格式與「合計」列標識。');
      }
      
      if (result.parsedYear !== null) {
        setParsedYear(result.parsedYear);
        console.log(`📅 從Excel解析出年份: ${result.parsedYear}`);
      }
      if (result.parsedQuarter !== null) {
        setParsedQuarter(result.parsedQuarter);
        console.log(`📅 從Excel解析出季度: ${result.parsedQuarter}`);
      }
      
      // 供應商名稱驗證（必須全部通過，不允許部分失敗）
      const vendorNames = analysisData.map(item => item.vendorName).filter(name => name);
      
      if (vendorNames.length > 0) {
        const validationResponse = await fetch('/api/validate/vendors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vendorNames,
            systemType: 'sqm-vqm'
          }),
        });
        
        const validation = await validationResponse.json();
        
        if (!validation.valid) {
          // 驗證失敗，阻止上傳並顯示錯誤訊息
          const unmatchedVendors = validation.invalidVendors || [];
          throw new Error(`供應商驗證失敗：以下供應商不存在於供應商管理清單中：\n${unmatchedVendors.join(', ')}\n\n請先到供應商管理頁面添加這些供應商，或確認供應商名稱是否正確。`);
        }
      }
      
      // 所有供應商都通過驗證，繼續處理
      console.log(`📊 所有供應商驗證通過，載入 ${analysisData.length} 筆資料`);
      console.log(`📋 供應商列表:`, analysisData.map(item => item.vendorName));

      // 將上傳資料與現有名冊資料合併：
      // - 上傳檔案中的供應商：取上傳批次資料（receivedBatches/returnedBatches），保留現有手填欄位
      // - 名冊中有但上傳檔案中沒有的供應商：保持現有資料不變（receivedBatches 維持 0）
      const currentByName = new Map(qualityAnalysisData.map(qa => [qa.vendorName, qa]));
      const uploadByName = new Map(analysisData.map(d => [d.vendorName, d]));

      const mergedQA = [
        // 上傳的供應商：批次資料來自 Excel，手填欄位優先保留現有值（若 Excel 為 0 且現有有值）
        ...analysisData.map(uploadItem => {
          const existing = currentByName.get(uploadItem.vendorName);
          if (!existing) return uploadItem;
          return {
            ...uploadItem,
            externalCAR: uploadItem.externalCAR || existing.externalCAR || 0,
            arr: uploadItem.arr || existing.arr || 0,
            untimelyResponseCCR: uploadItem.untimelyResponseCCR || existing.untimelyResponseCCR || 0,
            service: uploadItem.service || existing.service || 0,
            lateDelivery: uploadItem.lateDelivery || existing.lateDelivery || 0,
            specialApproval: uploadItem.specialApproval || existing.specialApproval || 0,
            productionLineStop: uploadItem.productionLineStop || existing.productionLineStop || 0,
            excessFreight: uploadItem.excessFreight || existing.excessFreight || 0,
          };
        }),
        // 名冊中有但上傳檔案中沒有的供應商：保持現有資料
        ...qualityAnalysisData.filter(qa => !uploadByName.has(qa.vendorName)),
      ];

      setQualityAnalysisData(mergedQA);

      const qualityReports = mergedQA.map(calculateQualityReport);
      setQualityReportData(qualityReports);

      const purchaseReports = mergedQA.map(calculatePurchaseReport);
      setPurchaseReportData(purchaseReports);

      const comprehensiveReports = qualityReports.map((qualityReport, index) =>
        calculateComprehensiveReport(qualityReport, purchaseReports[index])
      );
      setComprehensiveReportData(comprehensiveReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : '處理檔案時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleFileUpload,
    isLoading,
    error,
    parsedYear,
    parsedQuarter,
  };
};