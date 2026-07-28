import { useParams, useLocation } from 'react-router-dom';
import {
  Typography,
  Paper,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { YearlyEvaluationData } from '../types';
import { useReportContext } from '../contexts/ReportContext';
import { TextField, Select, MenuItem } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useEffect, useMemo, useState, useRef } from 'react';
import UnsavedPrompt from '../components/UnsavedPrompt';
import { exportYearlyToExcel } from '../utils/excelExport';
import DownloadIcon from '@mui/icons-material/Download';
import { formatLoadingMessage, SuccessMessages, ErrorMessages, translateError, EmptyStateMessages } from '../utils/messageTemplates';

// 物料類別含「包材」「洗模」「蓝膜」且本年度有評鑑資料 → 預設免稽
const EXEMPT_CATEGORY_KEYWORDS = ['包材', '洗模', '蓝膜'];

const getDefaultAuditType = (
  row: YearlyEvaluationData,
  vendorCategoryMap: Record<string, string>,
): string => {
  const cat = (vendorCategoryMap[row.vendorName] || '').toLowerCase();
  const isExemptCategory = EXEMPT_CATEGORY_KEYWORDS.some((kw) => cat.includes(kw));
  const hasEvalData = row.monthlyAssessmentSummary != null;
  if (isExemptCategory && hasEvalData) return '免稽';
  return row.supplierType === '国外' ? '文件审核' : '实地稽核';
};

const COL_WIDTH = {
  seq: 64,
  vendorName: 180,
  quarterScore: 80,
  quarterlySummary: 100,
  audit: 76,
  annualScore: 96,
  grade: 80,
  nextAuditType: 160,
  remarks: 220,
} as const;

const STICKY = {
  seq: {
    position: 'sticky' as const,
    left: 0,
    zIndex: 100,
    backgroundColor: 'background.paper',
    borderRight: 1,
    borderRightColor: 'divider',
    boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.12)',
  },
  vendorName: {
    position: 'sticky' as const,
    left: COL_WIDTH.seq,
    zIndex: 100,
    backgroundColor: 'background.paper',
    borderRight: 1,
    borderRightColor: 'divider',
    boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.12)',
  },
  vendorType: {
    position: 'sticky' as const,
    left: COL_WIDTH.seq + COL_WIDTH.vendorName,
    zIndex: 100,
    backgroundColor: 'background.paper',
    borderRight: 1,
    borderRightColor: 'divider',
    boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.12)',
  },
} as const;

const YearlyReport = () => {
  const { year } = useParams<{ year: string }>();
  const location = useLocation();
  const isOSAT = location.pathname.startsWith('/osat/');

  const { getYearlyEvaluationRows, setAnnualAuditField, setOthers, setNextYearAuditType, setRemarks, loadAnnualFromServer, isAnnualDirty, markAnnualSaved, setAnnualAuditStore, setYearlyExtraStore, annualAuditStore, yearlyExtraStore, yearlyEvaluationStore, vendorCategoryMap, loadVendorCategories } = useReportContext();
  const { canEditYearly } = useAuth();
  const [rows, setRows] = useState<YearlyEvaluationData[]>([]);
  // 物料類別模糊篩選（僅 SQM/VQM；OSAT 無此欄位）
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [savingProgress, setSavingProgress] = useState(0);
  const [savingMessage, setSavingMessage] = useState('');
  const justSavedRef = useRef(false); // 追蹤是否剛剛完成儲存操作

  const canSave = useMemo(() => !!year && canEditYearly && rows.length > 0, [year, canEditYearly, rows.length]);

  // 載入供應商 → 物料類別 對照（OSAT 無此欄位，故略過）
  useEffect(() => {
    if (!isOSAT) loadVendorCategories();
  }, [isOSAT, loadVendorCategories]);

  // 按物料類別模糊篩選顯示的供應商列（年度編輯以 vendorName 為鍵，過濾安全）
  const filteredRows = useMemo(() => {
    const f = categoryFilter.trim().toLowerCase();
    if (isOSAT || !f) return rows;
    return rows.filter((r) => (vendorCategoryMap[r.vendorName] || '').toLowerCase().includes(f));
  }, [rows, categoryFilter, isOSAT, vendorCategoryMap]);

  useEffect(() => {
    if (year) {
      // 切換年度時清除之前的儲存訊息，避免顯示前一個年度的訊息
      setSaveMsg(null);
      
      // 清除儲存標記（初始載入時）
      justSavedRef.current = false;
      
      // 優化：檢查是否已有資料，避免重複載入
      // 優先檢查 Context 緩存（即使組件卸載，Context 數據仍保留）
      if (yearlyEvaluationStore[year] && yearlyEvaluationStore[year].length > 0) {
        console.log(`📦 使用Context緩存資料: ${year}年度評鑑（${yearlyEvaluationStore[year].length} 筆），跳過API調用`);
        
        // 即使使用緩存，也顯示快速載入提示，讓用戶知道系統在工作
        setLoading(true);
        setLoadingProgress(0);
        setLoadingMessage(formatLoadingMessage(isOSAT ? 'OSAT' : 'SQM', 'yearly', year));
        
        // 使用 setTimeout 異步處理，避免阻塞渲染，同時提供視覺反饋
        setTimeout(() => {
          setRows(yearlyEvaluationStore[year]);
          
          // 異步同步年度稽核數據，避免阻塞渲染
          setTimeout(() => {
            const cachedData = yearlyEvaluationStore[year];
            const auditStore: Record<string, NonNullable<YearlyEvaluationData['annualAudit']>> = {};
            const extraStore: Record<string, { others: number | null; nextYearAuditType: string | null; remarks: string | null; }> = {};
            
            cachedData.forEach(row => {
              if (row.annualAudit) {
                auditStore[row.vendorName] = {
                  VDA: row.annualAudit.VDA ?? null,
                  QSA: row.annualAudit.QSA ?? null,
                  QPA: row.annualAudit.QPA ?? null,
                  HSF: row.annualAudit.HSF ?? null,
                  CSR: row.annualAudit.CSR ?? null,
                };
              } else {
                auditStore[row.vendorName] = {
                  VDA: null,
                  QSA: null,
                  QPA: null,
                  HSF: null,
                  CSR: null,
                };
              }
              extraStore[row.vendorName] = {
                others: row.others ?? null,
                nextYearAuditType: row.nextYearAuditType ?? null,
                remarks: row.remarks ?? null,
              };
            });
            
            setAnnualAuditStore((prev: any) => ({ ...prev, [year]: auditStore }));
            setYearlyExtraStore((prev: any) => ({ ...prev, [year]: extraStore }));
          }, 0);
          
          // 快速完成進度條，提供視覺反饋
          setLoadingProgress(100);
          setLoadingMessage(''); // 載入完成時清除訊息
          
          setTimeout(() => {
            setLoading(false);
            setLoadingProgress(0);
            setLoadingMessage('');
          }, 200); // 短暫顯示完成狀態，讓用戶知道已載入
        }, 50); // 短暫延遲，確保 UI 有時間顯示載入狀態
        
        return; // 已有資料，不需要重新載入
      }
      
      // 其次檢查組件內狀態（如果組件未卸載）
      if (rows.length > 0 && rows[0]?.year?.toString() === year) {
        console.log(`📦 使用組件緩存資料: ${year}年度評鑑（${rows.length} 筆），跳過API調用`);
        
        // 即使使用緩存，也顯示快速載入提示
        setLoading(true);
        setLoadingProgress(50);
        setLoadingMessage(formatLoadingMessage(isOSAT ? 'OSAT' : 'SQM', 'yearly', year));
        
        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingMessage(''); // 載入完成時清除訊息
          setTimeout(() => {
            setLoading(false);
            setLoadingProgress(0);
            setLoadingMessage('');
          }, 200);
        }, 100);
        
        return; // 已有資料，不需要重新載入
      }
      
      setLoading(true);
      setLoadingProgress(0);
      setLoadingMessage(formatLoadingMessage(isOSAT ? 'OSAT' : 'SQM', 'yearly', year));
      
      // 模擬進度更新（減少更新頻率以提升性能）
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 90) return prev + Math.random() * 10;
          return prev;
        });
      }, 500);
      
      // 載入年度評鑑彙整資料（後端會使用緩存加速）
      getYearlyEvaluationRows(year)
        .then((data) => {
          console.log(`📊 年度評鑑資料載入完成: ${data.length} 筆資料`);
          console.log('📋 前3筆資料範例:', data.slice(0, 3));
          setLoadingProgress(100);
          setLoadingMessage(''); // 載入完成時清除訊息
          
          // 先設置 rows，讓用戶立即看到資料（優化渲染性能）
          setRows(data);
          
          // 異步同步年度稽核數據，避免阻塞渲染
          setTimeout(() => {
            const auditStore: Record<string, NonNullable<YearlyEvaluationData['annualAudit']>> = {};
            const extraStore: Record<string, { others: number | null; nextYearAuditType: string | null; remarks: string | null; }> = {};
            
            data.forEach(row => {
              // 確保即使 VDA 為 null，也會正確同步（使用明確的鍵檢查）
              if (row.annualAudit) {
                auditStore[row.vendorName] = {
                  VDA: row.annualAudit.VDA ?? null,
                  QSA: row.annualAudit.QSA ?? null,
                  QPA: row.annualAudit.QPA ?? null,
                  HSF: row.annualAudit.HSF ?? null,
                  CSR: row.annualAudit.CSR ?? null,
                };
              } else {
                // 如果 annualAudit 不存在，設置為空對象（所有值為 null）
                auditStore[row.vendorName] = {
                  VDA: null,
                  QSA: null,
                  QPA: null,
                  HSF: null,
                  CSR: null,
                };
              }
              extraStore[row.vendorName] = {
                others: row.others ?? null,
                nextYearAuditType: row.nextYearAuditType ?? null,
                remarks: row.remarks ?? null,
              };
            });
            
            // 更新context中的store
            setAnnualAuditStore((prev: any) => ({ ...prev, [year]: auditStore }));
            setYearlyExtraStore((prev: any) => ({ ...prev, [year]: extraStore }));
          }, 0);
          
          setTimeout(() => {
            setLoading(false);
            setLoadingProgress(0);
            setLoadingMessage('');
          }, 300); // 稍微縮短顯示時間，但保持足夠的視覺反饋
        })
        .catch((error) => {
          console.error('載入年度評鑑資料失敗:', error);
          console.error('錯誤詳情:', error.response?.data || error.message);
          setLoading(false);
          setLoadingProgress(0);
          setLoadingMessage('');
        })
        .finally(() => {
          clearInterval(progressInterval);
        });
    }
  }, [year]);

  // 監聽年度分數重新計算事件
  useEffect(() => {
    const handleRecalculateAnnualScore = (event: CustomEvent) => {
      const { year: eventYear, vendorName, field, value } = event.detail;
      if (eventYear !== year) return;
      
      console.log(`🔄 重新計算年度分數: ${vendorName} - ${field} = ${value}`);
      
      // 重新計算年度分數
      setRows(prevRows => {
        return prevRows.map(row => {
          if (row.vendorName !== vendorName) return row;
          
          // 獲取最新的年度稽核數據
          const currentAudit = annualAuditStore[year!]?.[vendorName] || row.annualAudit;
          const currentOthers = yearlyExtraStore[year!]?.[vendorName]?.others ?? row.others;
          
          // 計算年度稽核組件
          let auditTenPctComponent = 0;
          // 年度稽核組件：有 VDA 分數時取「VDA 與 HSF」平均，無 VDA 時取「QSA 與 HSF」平均（僅計入已填寫的分項）
          // VDA = 0 視為 null（VDA 不可能為 0，雙重保護）
          const auditArr: number[] = [];
          if (typeof currentAudit?.VDA === 'number' && currentAudit.VDA > 0) {
            auditArr.push(currentAudit.VDA);
          } else if (typeof currentAudit?.QSA === 'number') {
            auditArr.push(currentAudit.QSA);
          }
          if (typeof currentAudit?.HSF === 'number') auditArr.push(currentAudit.HSF);
          if (auditArr.length > 0) {
            auditTenPctComponent = auditArr.reduce((a, b) => a + b, 0) / auditArr.length;
          }
          
          // 計算年度分數 - 與OSAT邏輯一致（精度：小數點後 3 位，與後端一致）
          const othersVal = currentOthers ?? 0;
          const annualScore = (row.monthlyAssessmentSummary == null)
            ? null
            : (() => {
                // 如果沒有年度稽核分數，只根據月考核分數計算（不扣分）
                if (auditTenPctComponent === 0) {
                  return Math.round((row.monthlyAssessmentSummary - othersVal) * 1000) / 1000;
                }
                
                return Math.round(((row.monthlyAssessmentSummary * 0.9) + (auditTenPctComponent * 0.1) - othersVal) * 1000) / 1000;
              })();
          
          // 計算年度等級
          let grade: 'A' | 'B' | 'C' | 'D' | 'E' | null = null;
          if (annualScore !== null) {
            if (annualScore >= 95) grade = 'A';
            else if (annualScore >= 85) grade = 'B';
            else if (annualScore >= 75) grade = 'C';
            else if (annualScore >= 60) grade = 'D';
            else grade = 'E';
          }
          
          return {
            ...row,
            annualScore,
            grade,
          };
        });
      });
    };
    
    window.addEventListener('recalculateAnnualScore', handleRecalculateAnnualScore as EventListener);
    
    return () => {
      window.removeEventListener('recalculateAnnualScore', handleRecalculateAnnualScore as EventListener);
    };
  }, [year, annualAuditStore, yearlyExtraStore]);

  // 離開頁面前提醒（瀏覽器關閉/重新整理）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (year && isAnnualDirty(year)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [year, isAnnualDirty]);

  // 移除自定義 popstate 邏輯，統一用 UnsavedPrompt

  const buildAnnualPayload = () => {
    return rows.map((r) => {
      // 優先使用 annualAuditStore 中的值（即使為 null），只有在鍵不存在時才 fallback 到 row.annualAudit
      const vendorAudit = annualAuditStore[year!]?.[r.vendorName];
      const vendorExtra = yearlyExtraStore[year!]?.[r.vendorName];
      
      return {
        vendorName: r.vendorName,
        VDA: vendorAudit && 'VDA' in vendorAudit ? vendorAudit.VDA : (r.annualAudit?.VDA ?? null),
        QSA: vendorAudit && 'QSA' in vendorAudit ? vendorAudit.QSA : (r.annualAudit?.QSA ?? null),
        QPA: vendorAudit && 'QPA' in vendorAudit ? vendorAudit.QPA : (r.annualAudit?.QPA ?? null),
        HSF: vendorAudit && 'HSF' in vendorAudit ? vendorAudit.HSF : (r.annualAudit?.HSF ?? null),
        nextYearAuditType: vendorExtra && 'nextYearAuditType' in vendorExtra ? vendorExtra.nextYearAuditType : getDefaultAuditType(r, vendorCategoryMap),
        remarks: vendorExtra && 'remarks' in vendorExtra ? vendorExtra.remarks : (r.remarks ?? null),
      };
    });
  }

  const handleSaveAnnual = async () => {
    if (!year) return;
    setSaving(true);
    setSaveMsg(null);
    setSavingProgress(0);
    setSavingMessage('正在準備資料...');
    
      // 模擬進度更新（減少更新頻率以提升性能）
      const progressInterval = setInterval(() => {
        setSavingProgress(prev => {
          if (prev < 90) return prev + Math.random() * 15;
          return prev;
        });
      }, 500);
    
    try {
      setSavingMessage('正在儲存資料至後端...');
      setSavingProgress(30);
      
      const payload = buildAnnualPayload();
      const endpoint = isOSAT ? `/osat/annual/${year}` : `/sqm-vqm/annual/${year}`;
      await api.put(endpoint, payload);
      
      setSavingMessage('');
      setSavingProgress(100);
      setSaveMsg(SuccessMessages.saveYearly(isOSAT ? 'OSAT' : 'SQM', year));
      markAnnualSaved(year);
      
      // 設置標記，表示剛剛完成儲存操作
      justSavedRef.current = true;
      
      // 優化：不重新載入整個年度評鑑資料，因為：
      // 1. 年度評鑑資料主要來自月評核資料，保存年度稽核字段不會改變月評核資料
      // 2. 年度分數和等級已經在前端即時計算並更新
      // 3. 重新載入會清除緩存，導致下次訪問變慢
      // 4. 前端狀態已經是最新的（因為是從前端狀態保存的）
      
      // 只在背景非同步重新載入，不阻塞用戶操作（利用緩存加速）
      getYearlyEvaluationRows(year).then((data) => {
        // 更新緩存（如果後端有新的計算結果）
        // 注意：這裡不更新 rows，因為前端狀態已經是最新的
        // 只在後台更新，確保緩存是最新的
      }).catch((error) => {
        console.error('背景同步資料失敗（不影響用戶操作）:', error);
      });
      
      // 在下一輪渲染後清除標記（使用 setTimeout 確保在渲染完成後清除）
      setTimeout(() => {
        justSavedRef.current = false;
      }, 100);
      
      // 清除進度提示（保留成功訊息 3 秒）
      setTimeout(() => {
        setSavingProgress(0);
        setSavingMessage('');
      }, 3000); // 延長到 3 秒，讓使用者有足夠時間看到成功訊息
    } catch (e: any) {
      // 嘗試解析錯誤訊息
      let errorMessage = translateError(e, '儲存', isOSAT ? 'OSAT' : 'SQM', year);
      if (e?.response?.data) {
        const errorData = e.response.data;
        if (errorData.error === 'vendor_validation_failed' || errorData.error === 'vendor_not_found') {
          const invalidVendors = errorData.invalidVendors || [];
          errorMessage = ErrorMessages.saveYearly(
            isOSAT ? 'OSAT' : 'SQM',
            year,
            `以下供應商不存在於供應商管理清單中：${invalidVendors.join(', ')}。請先到供應商管理頁面添加這些供應商，或確認供應商名稱是否正確`
          );
        } else if (errorData.message) {
          errorMessage = translateError(e, '儲存', isOSAT ? 'OSAT' : 'SQM', year);
        }
      }
      setSaveMsg(errorMessage);
      setSavingProgress(0);
      setSavingMessage('');
    } finally {
      clearInterval(progressInterval);
      setSaving(false);
    }
  }

  const handleDownloadExcel = () => {
    if (!year) return;
    // 匯出時合併使用者當前在頁面上的即時編輯（年度稽核分項、稽核類型、備註），使 Excel 與畫面一致
    const exportRows = rows.map((row) => {
      const audit = annualAuditStore[year]?.[row.vendorName];
      const extra = yearlyExtraStore[year]?.[row.vendorName];
      return {
        ...row,
        annualAudit: audit ? { ...(row.annualAudit || {}), ...audit } : row.annualAudit,
        nextYearAuditType: extra?.nextYearAuditType ?? row.nextYearAuditType,
        remarks: extra?.remarks ?? row.remarks,
      };
    });
    exportYearlyToExcel(exportRows, year, vendorCategoryMap);
  };

  return (
    <Box>
      {year && (
        <UnsavedPrompt when={isAnnualDirty(year)} />
      )}
      <Typography variant="h5" gutterBottom>
        {isOSAT ? 'OSAT' : 'SQM/VQM'} - {year}年度供應商評鑑表
      </Typography>
      
      {/* 載入進度條 */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {loadingMessage}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={loadingProgress} 
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {Math.round(loadingProgress)}%
          </Typography>
        </Box>
      )}
      
      {/* 儲存進度條 */}
      {saving && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {savingMessage || '正在儲存...'}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={savingProgress} 
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {Math.round(savingProgress)}%
          </Typography>
        </Box>
      )}
      
      {/* SQM/VQM 計算說明（僅在非 OSAT 時顯示） */}
      {!isOSAT && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Accordion>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="sqm-rules-content"
              id="sqm-rules-header"
              sx={{
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.875rem' }}>
                📋 計算說明
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.875rem' }}>
                {/* 年度分數計算說明 */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.875rem' }}>
                    年度分數計算說明
                  </Typography>
                  <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.875rem' }}>
                      <li>年度分數 = (季考核平均分數 × 90%) + (年度稽核分數 × 10%)</li>
                      <li>如果沒有年度稽核分數（VDA、QSA、HSF 都為空），則：年度分數 = 季考核平均分數</li>
                      <li>年度稽核分數計算方式：
                        <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                          <li>如果有 VDA 分數，則使用 VDA 和 HSF 的平均值</li>
                          <li>如果沒有 VDA 分數，則使用 QSA 和 HSF 的平均值</li>
                          <li>（僅計入已填寫的分項；若 HSF 為空，則僅取 VDA 或 QSA）</li>
                        </ul>
                      </li>
                      <li>計算結果四捨五入至小數點後 3 位</li>
                    </Box>
                  </Alert>
                </Box>
                
                {/* 年度等級判定標準 */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.875rem' }}>
                    年度等級判定標準
                  </Typography>
                  <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.875rem' }}>
                      <li><strong>A級</strong>：年度分數 ≥ 95</li>
                      <li><strong>B級</strong>：年度分數 ≥ 85 且 &lt; 95</li>
                      <li><strong>C級</strong>：年度分數 ≥ 75 且 &lt; 85</li>
                      <li><strong>D級</strong>：年度分數 ≥ 60 且 &lt; 75</li>
                      <li><strong>E級</strong>：年度分數 &lt; 60</li>
                    </Box>
                  </Alert>
                </Box>
                
                {/* 下年度稽核計畫-稽核類型判定說明 */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontSize: '0.875rem' }}>
                    下年度稽核計畫-稽核類型判定說明
                  </Typography>
                  <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                    <Box sx={{ fontSize: '0.875rem' }}>
                      <Typography variant="body2" sx={{ mb: 1, fontSize: '0.875rem' }}>
                        依供應商地區判定稽核類型（與供應商管理清單的「類型」一致）。以下為系統預設值，可於表格中手動改選（实地稽核 / 文件审核 / 免稽）：
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>供應商地區</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>稽核類型</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>国内</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>实地稽核</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>海外</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>实地稽核</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>国外</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>文件审核</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Alert>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
      
      <Paper sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2 }}>
          <Button 
            variant="contained" 
            disabled={!canSave || saving} 
            onClick={handleSaveAnnual}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? '儲存中...' : '儲存至後端'}
          </Button>
          <Button 
            variant="contained" 
            color="success" 
            disabled={rows.length === 0} 
            onClick={handleDownloadExcel}
            startIcon={<DownloadIcon />}
          >
            下載 Excel 報表
          </Button>
          {!isOSAT && (
            <TextField
              size="small"
              placeholder="按物料類別篩選"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            />
          )}
          {saveMsg && (
            <Typography variant="body2" color={saveMsg.includes('失敗') ? 'error' : 'success.main'}>
              {saveMsg}
            </Typography>
          )}
        </Box>
        
        <TableContainer sx={{ maxHeight: '85vh', position: 'relative', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Table size="small" stickyHeader sx={{ '& tbody tr:hover': { backgroundColor: 'action.hover' } }}>
            <TableHead>
              <TableRow sx={{ '& th': { zIndex: 8, backgroundColor: 'background.paper', position: 'sticky', top: 0 } }}>
                <TableCell align="center" rowSpan={2} sx={{ minWidth: COL_WIDTH.seq, width: COL_WIDTH.seq, boxSizing: 'border-box', ...STICKY.seq }}>序號</TableCell>
                <TableCell rowSpan={2} sx={{ minWidth: COL_WIDTH.vendorName, width: COL_WIDTH.vendorName, boxSizing: 'border-box', ...STICKY.vendorName }}>供應商名稱</TableCell>
                <TableCell align="center" colSpan={4}>季考核得分</TableCell>
                <TableCell align="center" rowSpan={2} sx={{ minWidth: COL_WIDTH.quarterlySummary }}>季平均得分</TableCell>
                <TableCell align="center" colSpan={4}>年度稽核</TableCell>
                <TableCell align="center" rowSpan={2} sx={{ minWidth: COL_WIDTH.annualScore }}>年度分數</TableCell>
                <TableCell align="center" rowSpan={2} sx={{ minWidth: COL_WIDTH.grade }}>年度等級</TableCell>
                <TableCell rowSpan={2} sx={{ minWidth: COL_WIDTH.nextAuditType }}>下年度稽核計畫-稽核類型</TableCell>
                <TableCell rowSpan={2} sx={{ minWidth: COL_WIDTH.remarks }}>備註</TableCell>
              </TableRow>
              <TableRow sx={{ '& th': { top: 40, zIndex: 5, backgroundColor: 'background.paper', position: 'sticky' } }}>
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                  <TableCell key={`qScoreH-${i+1}`} align="center" sx={{ minWidth: COL_WIDTH.quarterScore }}>{q}</TableCell>
                ))}
                <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>VDA</TableCell>
                <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>QSA</TableCell>
                <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>QPA</TableCell>
                <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>HSF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={40} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      {EmptyStateMessages.yearlyEvaluation(isOSAT ? 'OSAT' : 'SQM', year)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, index) => (
                  <TableRow key={row.vendorName}>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.seq, width: COL_WIDTH.seq, boxSizing: 'border-box', ...STICKY.seq, zIndex: 4 }}>{index + 1}</TableCell>
                    <TableCell sx={{ minWidth: COL_WIDTH.vendorName, width: COL_WIDTH.vendorName, boxSizing: 'border-box', whiteSpace: 'nowrap', ...STICKY.vendorName, zIndex: 4 }}>{row.vendorName}</TableCell>
                    {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                      <TableCell key={`qScoreV-${q}`} align="center" sx={{ minWidth: COL_WIDTH.quarterScore }}>{row.monthlyAssessmentScores?.[q] ?? '-'}</TableCell>
                    ))}
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.quarterlySummary }}>{row.monthlyAssessmentSummary != null ? row.monthlyAssessmentSummary.toFixed(2) : '-'}</TableCell>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>
                      <TextField
                        size="small"
                        type="text"
                        value={
                          (() => {
                            const vendorAudit = annualAuditStore[year!]?.[row.vendorName];
                            const vdaValue = vendorAudit && 'VDA' in vendorAudit 
                              ? vendorAudit.VDA 
                              : (row.annualAudit?.VDA ?? null);
                            return vdaValue !== null && vdaValue !== undefined ? String(vdaValue) : '';
                          })()
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            setAnnualAuditField(year!, row.vendorName, 'VDA', null);
                            return;
                          }
                          if (!/^\d*\.?\d*$/.test(value)) {
                            return;
                          }
                          const n = Number(value);
                          if (isNaN(n) && value !== '.') {
                            return;
                          }
                          if (!isNaN(n)) {
                            const clamped = Math.min(100, Math.max(0, n));
                            const rounded = Math.round(clamped * 10) / 10;
                            setAnnualAuditField(year!, row.vendorName, 'VDA', rounded);
                          }
                        }}
                        onBlur={(e) => {
                          const value = annualAuditStore[year!]?.[row.vendorName]?.VDA;
                          if (value === 0) {
                            setAnnualAuditField(year!, row.vendorName, 'VDA', null);
                          }
                        }}
                        disabled={!canEditYearly}
                        inputProps={{ 
                          inputMode: 'decimal',
                          pattern: '[0-9.]*',
                          style: { textAlign: 'center' } 
                        }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>
                      <TextField
                        size="small"
                        type="number"
                        value={annualAuditStore[year!]?.[row.vendorName]?.QSA ?? row.annualAudit?.QSA ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '') { setAnnualAuditField(year!, row.vendorName, 'QSA', null); return; }
                          const n = Number(e.target.value);
                          const clamped = Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
                          const rounded = Math.round(clamped * 10) / 10;
                          setAnnualAuditField(year!, row.vendorName, 'QSA', rounded);
                        }}
                        disabled={!canEditYearly}
                        inputProps={{ min: 0, max: 100, step: 0.1, style: { textAlign: 'center' } }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>
                      <TextField
                        size="small"
                        type="number"
                        value={annualAuditStore[year!]?.[row.vendorName]?.QPA ?? row.annualAudit?.QPA ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '') { setAnnualAuditField(year!, row.vendorName, 'QPA', null); return; }
                          const n = Number(e.target.value);
                          const clamped = Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
                          const rounded = Math.round(clamped * 10) / 10;
                          setAnnualAuditField(year!, row.vendorName, 'QPA', rounded);
                        }}
                        disabled={!canEditYearly}
                        inputProps={{ min: 0, max: 100, step: 0.1, style: { textAlign: 'center' } }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.audit }}>
                      <TextField
                        size="small"
                        type="number"
                        value={annualAuditStore[year!]?.[row.vendorName]?.HSF ?? row.annualAudit?.HSF ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '') { setAnnualAuditField(year!, row.vendorName, 'HSF', null); return; }
                          const n = Number(e.target.value);
                          const clamped = Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
                          const rounded = Math.round(clamped * 10) / 10;
                          setAnnualAuditField(year!, row.vendorName, 'HSF', rounded);
                        }}
                        disabled={!canEditYearly}
                        inputProps={{ min: 0, max: 100, step: 0.1, style: { textAlign: 'center' } }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>

                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.annualScore }}>{row.annualScore != null ? row.annualScore.toFixed(2) : '-'}</TableCell>
                    <TableCell align="center" sx={{ minWidth: COL_WIDTH.grade }}>{row.grade ?? '-'}</TableCell>
                    <TableCell sx={{ minWidth: COL_WIDTH.nextAuditType, whiteSpace: 'nowrap' }}>
                      {(() => {
                        // 稽核類型預設：
                        //   1. 物料類別含「包材」「洗模」「蓝膜」且本年度有評鑑資料 → 免稽
                        //   2. 其餘依供應商地區：国外 → 文件审核；国内/海外 → 实地稽核
                        // 使用者可手動改選，手動值優先並隨年度資料一起儲存。
                        const computedDefault = getDefaultAuditType(row, vendorCategoryMap);
                        const auditType = yearlyExtraStore[year!]?.[row.vendorName]?.nextYearAuditType ?? computedDefault;
                        const bgColor = auditType === '文件审核' ? '#e3f2fd' : auditType === '免稽' ? '#f5f5f5' : '#fff3e0';

                        return (
                          <Select
                            size="small"
                            value={auditType}
                            onChange={(e) => setNextYearAuditType(year!, row.vendorName, e.target.value)}
                            disabled={!canEditYearly}
                            sx={{
                              minWidth: 110,
                              backgroundColor: bgColor,
                              fontWeight: 'medium',
                              '& .MuiSelect-select': { textAlign: 'center', py: 1 },
                            }}
                          >
                            <MenuItem value="实地稽核">实地稽核</MenuItem>
                            <MenuItem value="文件审核">文件审核</MenuItem>
                            <MenuItem value="免稽">免稽</MenuItem>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell sx={{ minWidth: COL_WIDTH.remarks }}>
                      <TextField
                        size="small"
                        value={yearlyExtraStore[year!]?.[row.vendorName]?.remarks ?? row.remarks ?? ''}
                        onChange={(e) => setRemarks(year!, row.vendorName, e.target.value || null)}
                        disabled={!canEditYearly}
                        sx={{ width: '100%' }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default YearlyReport;

