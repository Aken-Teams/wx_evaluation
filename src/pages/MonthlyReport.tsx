﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Tab,
  Tabs,
  Button,
  CircularProgress,
  Alert,
  Typography,
  LinearProgress,
} from '@mui/material';
import { TabPanel, TabContext } from '@mui/lab';
import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useParams, useLocation } from 'react-router-dom';
import QualityReport from '../components/QualityReport';
import PurchaseReport from '../components/PurchaseReport';
import ComprehensiveReport from '../components/ComprehensiveReport';
import { useFileUpload } from '../hooks/useFileUpload';
import { useReportContext } from '../contexts/ReportContext';
import { useAuth } from '../contexts/AuthContext';
import { Stack } from '@mui/material';
import UnsavedPrompt from '../components/UnsavedPrompt';
import api from '../services/api';
import { exportMonthlyToExcel, exportUploadTemplate } from '../utils/excelExport';
import DownloadIcon from '@mui/icons-material/Download';
import { formatLoadingMessage, SuccessMessages, ErrorMessages, translateError } from '../utils/messageTemplates';
import { calculateQualityReport, calculatePurchaseReport, calculateComprehensiveReport } from '../services/reportService';
import { QualityAnalysisData } from '../types';

const MonthlyReport = () => {
  const [tabValue, setTabValue] = useState('1');
  const { handleFileUpload, isLoading, error } = useFileUpload();
  const {
    setActivePeriod, clearCurrentMonthData,
    qualityAnalysisData, setQualityAnalysisData,
    qualityReportData, setQualityReportData,
    purchaseReportData, setPurchaseReportData,
    comprehensiveReportData, setComprehensiveReportData,
    loadMonthlyFromServer, isMonthlyDirty, markMonthlySaved, periodStore,
    materialCategoryFilter, setMaterialCategoryFilter,
    loadVendorCategories, vendorCategoryMap, vendorAUMap,
  } = useReportContext();
  const { canEditQuality, canEditPurchase } = useAuth();
  // 有实际上传批数的供应商才算"已上传"（名册空行不算）
  const hasUploadedBatchData = qualityAnalysisData.some(qa => {
    const b = typeof qa.receivedBatches === 'string' ? parseInt(qa.receivedBatches) || 0 : (qa.receivedBatches as number);
    return b > 0;
  });
  const hasUploaded = hasUploadedBatchData;
  const params = useParams<{ year: string; month: string; quarter: string }>();
  const year = params.year;
  const period = params.quarter || params.month;
  const isQuarterly = true;
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  // 載入供應商 → 物料類別 對照（供物料類別欄位顯示與篩選）
  useEffect(() => {
    loadVendorCategories();
  }, [loadVendorCategories]);

  // 將供應商名冊中所有供應商合併入當前季度資料（保証所有名冊供應商都可輸入並存儲）
  const lastMergeKeyRef = useRef('');
  useEffect(() => {
    const rosterNames = Object.keys(vendorCategoryMap);
    if (rosterNames.length === 0) return;

    // 只在有上传资料（任意供应商 receivedBatches > 0）后才合并名册
    const hasBatchData = qualityAnalysisData.some(qa => {
      const b = typeof qa.receivedBatches === 'string' ? parseInt(qa.receivedBatches) || 0 : (qa.receivedBatches as number);
      return b > 0;
    });
    if (!hasBatchData) return;

    const existingNames = new Set(qualityReportData.map(r => r.vendorName));
    const missingNames = rosterNames.filter(n => !existingNames.has(n));

    // 用 mergeKey 避免重複執行（rosterNames 和 existingNames 都未變則跳過）
    const mergeKey = `${rosterNames.sort().join(',')}|${qualityReportData.map(r => r.vendorName).sort().join(',')}`;
    if (lastMergeKeyRef.current === mergeKey) return;
    lastMergeKeyRef.current = mergeKey;

    if (missingNames.length === 0) return;

    const emptyQA = (name: string): QualityAnalysisData => ({
      vendorName: name, receivedQuantity: '0', receivedBatches: 0,
      returnedQuantity: '0', returnedBatches: 0, arr: 0, lrr: 0,
      externalCAR: 0, untimelyResponseCCR: 0, others: 0, service: 0,
      lateDelivery: 0, deliveryDeduction: 0, specialApproval: 0,
      productionLineStop: 0, excessFreight: 0,
    });

    const newQA = missingNames.map(emptyQA);
    const newQR = newQA.map(calculateQualityReport);
    const newPR = newQA.map(calculatePurchaseReport);
    const newCR = newQR.map((qr, i) => calculateComprehensiveReport(qr, newPR[i], undefined, vendorAUMap[qr.vendorName] ?? false));

    setQualityAnalysisData([...qualityAnalysisData, ...newQA.filter(qa => !existingNames.has(qa.vendorName))]);
    setQualityReportData([...qualityReportData, ...newQR.filter(qr => !existingNames.has(qr.vendorName))]);
    setPurchaseReportData([...purchaseReportData, ...newPR.filter(pr => !existingNames.has(pr.vendorName))]);
    setComprehensiveReportData([...comprehensiveReportData, ...newCR.filter(cr => !existingNames.has(cr.vendorName))]);
  }, [vendorCategoryMap, qualityReportData.length]);

  useEffect(() => {
    if (year && period) {
      setSaveMsg(null);
      
      console.log(`🔄 切換到${year}年${period}季`);
      console.log(`📊 當前hasUploaded狀態: ${hasUploaded}`);
      console.log(`📊 當前qualityAnalysisData長度: ${qualityAnalysisData?.length || 0}`);
      
      setActivePeriod(year, period);
      
      const cacheKey = `${year}-${period}`;
      const cachedData = periodStore?.[cacheKey];
      
      if (cachedData && cachedData.qualityAnalysisData?.length > 0) {
        console.log(`📦 已使用緩存資料，正在背景載入最新資料以確保同步...`);
      } else {
        console.log(`🔄 正在從後端載入${year}年${period}季數據...`);
      }
      
      setLoadingProgress(0);
      setLoadingMessage(formatLoadingMessage('SQM', 'quarterly', year, period));

        // 模擬進度更新（不影響實際載入，只提供視覺反饋）
        const progressInterval = setInterval(() => {
          setLoadingProgress((prev) => {
            if (prev < 90) return prev + Math.random() * 15;
            return prev;
          });
        }, 300);

        // 總是載入最新資料，確保資料同步（如果有緩存，用戶已看到緩存資料，此為背景更新）
        loadMonthlyFromServer(year, period)
          .then(() => {
            setLoadingProgress(100);
            setLoadingMessage(''); // 載入完成時清除訊息
            setTimeout(() => {
              setLoadingProgress(0);
              setLoadingMessage('');
            }, 400);
          })
          .catch((error) => {
            console.error('❌ 載入數據失敗:', error);
            setLoadingProgress(0);
            setLoadingMessage('');
          })
          .finally(() => {
            clearInterval(progressInterval);
          });
      } else {
        loadMonthlyFromServer(year, period).catch((error) => {
          console.error('❌ 載入數據失敗:', error);
        });
    }
  }, [year, period]);

  // 移除嘗試攔截 Router 內部 API 的程式，統一用 UnsavedPrompt

  // 離開頁面前提醒（瀏覽器關閉/重新整理）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (year && period && isMonthlyDirty(year, period)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [year, period, isMonthlyDirty]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const canSaveMonthly = useMemo(() => !!year && !!period && (canEditQuality || canEditPurchase), [year, period, canEditQuality, canEditPurchase]);

  const buildMonthlyPayload = () => {
    const len = qualityAnalysisData.length;
    const list = [] as any[];
    for (let i = 0; i < len; i += 1) {
      const qa = qualityAnalysisData[i] as any;
      const qr = (qualityReportData[i] as any) || {};
      const pr = (purchaseReportData[i] as any) || {};
      const cr = (comprehensiveReportData[i] as any) || {};
      list.push({
        vendorName: qa.vendorName,
        // quality/raw
        receivedQuantity: qa.receivedQuantity,
        returnedQuantity: qa.returnedQuantity,
        receivedBatches: qa.receivedBatches,
        returnedBatches: qa.returnedBatches,
        arr: qr.arr ?? qa.arr,
        lrr: qr.lrr ?? qa.lrr,
        externalCAR: qr.externalCAR ?? qa.externalCAR,
        untimelyResponseCCR: qr.untimelyResponseCCR ?? qa.untimelyResponseCCR,
        others: qr.others ?? qa.others,
        serviceQuality: qr.service ?? qa.service,
        // quality computed
        totalBaseScoreB: qr.totalBaseScoreB ?? null,
        qualityAssessmentScoreC1: qr.qualityAssessmentScoreC1 ?? null,
        qualityAssessmentScoreC: qr.qualityAssessmentScoreC ?? null,
        // purchase/raw
        lateDelivery: pr.lateDelivery ?? qa.lateDelivery,
        deliveryRate: pr.deliveryRate ?? null,
        specialApproval: pr.specialApproval ?? qa.specialApproval,
        productionLineStop: pr.productionLineStop ?? qa.productionLineStop,
        excessFreight: pr.excessFreight ?? qa.excessFreight,
        // purchase computed
        purchaseAssessmentScoreA: pr.purchaseAssessmentScoreA ?? null,
        totalPurchaseAssessmentScoreA: pr.totalPurchaseAssessmentScoreA ?? null,
        servicePurchase: pr.service ?? qa.service,
        // comprehensive
        assessmentScore: cr.assessmentScore ?? null,
        remarks: cr.remarks ?? null,
      })
    }
    return list;
  }

  const handleSaveMonthly = async () => {
    if (!year || !period) {
      console.log('❌ 保存失败：year或period为空', { year, period });
      return;
    }
    console.log('✅ 开始保存季度数据', { year, period, isQuarterly });
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = buildMonthlyPayload();
      console.log('📦 构建的payload:', payload.length, '条记录');
      const endpoint = `/sqm-vqm/quarterly/${year}/${period}`;
      console.log('🔗 请求端点:', endpoint);
      const response = await api.put(endpoint, payload);
      console.log('✅ 保存成功:', response.data);
      setSaveMsg(SuccessMessages.saveMonthly('SQM', year, period));
      markMonthlySaved(year, period);
    } catch (e: any) {
      console.error('❌ 保存失败:', e);
      // 嘗試解析錯誤訊息
      let errorMessage = translateError(e, '儲存', 'SQM', year, period);
      if (e?.response?.data) {
        const errorData = e.response.data;
        if (errorData.error === 'vendor_validation_failed' || errorData.error === 'vendor_not_found') {
          const invalidVendors = errorData.invalidVendors || [];
          errorMessage = ErrorMessages.saveMonthly(
            'SQM',
            year,
            period,
            `以下供應商不存在於供應商管理清單中：${invalidVendors.join(', ')}。請先到供應商管理頁面添加這些供應商，或確認供應商名稱是否正確`
          );
        } else if (errorData.message) {
          errorMessage = translateError(e, '儲存', 'SQM', year, period);
        }
      }
      setSaveMsg(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  const handleDownloadExcel = () => {
    if (!year || !period) return;
    exportMonthlyToExcel(qualityReportData, purchaseReportData, comprehensiveReportData, year, period, isQuarterly, vendorCategoryMap);
  };

  return (
    <Box sx={{ width: '100%', typography: 'body1' }}>
      {year && period && (
        <UnsavedPrompt when={isMonthlyDirty(year, period)} />
      )}
      {/* SQM 月評核載入進度條（僅在有訊息時顯示） */}
      {loadingMessage && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {loadingMessage}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={loadingProgress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}
      
      {/* 年份和季度显示 */}
      {year && period && (
        <Box sx={{ mb: 3, p: 3, backgroundColor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
          <Typography variant="h5" fontWeight="bold" color="primary">
            📅 {year}年 {isQuarterly ? `${period}季` : `${period}月`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            SQM/VQM 品質評鑑報告
          </Typography>
        </Box>
      )}
      
      {/* 各 Tab 内已有独立的計算規則說明，此處不再重複顯示頁面總覽 */}

      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button variant="contained" component="label" disabled={hasUploaded || isLoading || !canEditQuality}>
          上傳品質評價分析表
          <input
            type="file"
            hidden
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={hasUploaded || isLoading || !canEditQuality}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
              }
            }}
          />
          </Button>
          <Button
            variant="outlined"
            onClick={exportUploadTemplate}
          >
            下載上傳模板
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSaveMonthly || saving}
            onClick={handleSaveMonthly}
          >
            儲存至後端
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!canEditQuality}
            onClick={() => {
              if (window.confirm(`確定要清空${isQuarterly ? '本季度' : '本月份'}所有已上傳與計算資料嗎？此操作無法還原。`)) {
                clearCurrentMonthData();
                // 同步清空至後端，防止重新載入時舊資料重現
                if (year && period && (canEditQuality || canEditPurchase)) {
                  api.put(`/sqm-vqm/quarterly/${year}/${period}`, [])
                    .then(() => {
                      markMonthlySaved(year, period);
                      setSaveMsg('季度資料已清空並同步至後端');
                    })
                    .catch(() => {
                      setSaveMsg('清空成功，但後端同步失敗，請手動點擊「儲存至後端」');
                    });
                }
              }
            }}
          >
            清空{isQuarterly ? '季度' : '本月'}資料
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={!hasUploaded}
            onClick={handleDownloadExcel}
            startIcon={<DownloadIcon />}
          >
            下載 Excel 報表
          </Button>
          <TextField
            size="small"
            placeholder="按物料類別篩選"
            value={materialCategoryFilter}
            onChange={(e) => setMaterialCategoryFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />
          {isLoading && <CircularProgress size={24} />}
          {saving && <CircularProgress size={24} />}
          {hasUploaded && !isLoading && (
            <Typography variant="body2" color="text.secondary">
              已上傳{isQuarterly ? '季度' : '本月'}資料，如需重上傳請先點「清空{isQuarterly ? '季度' : '本月'}資料」。
            </Typography>
          )}
          {saveMsg && (
            <Typography variant="body2" color={saveMsg.includes('失敗') ? 'error' : 'success.main'}>
              {saveMsg}
            </Typography>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {year && period && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" component="div">
            SQM/VQM - {year} 年 {isQuarterly ? period : `${period.padStart(2, '0')}月`}
          </Typography>
        </Box>
      )}

      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="report tabs"
          >
            <Tab label="品質評鑑報告" value="1" />
            <Tab label="採購評鑑報告" value="2" />
            <Tab label="綜合評價表" value="3" />
          </Tabs>
        </Box>
        <TabPanel value="1">
          <QualityReport />
        </TabPanel>
        <TabPanel value="2">
          <PurchaseReport />
        </TabPanel>
        <TabPanel value="3">
          <ComprehensiveReport />
        </TabPanel>
      </TabContext>
    </Box>
  );
};

export default MonthlyReport;