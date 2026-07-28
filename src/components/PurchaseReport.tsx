﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useCallback, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useReportContext } from '../contexts/ReportContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyStateMessages } from '../utils/messageTemplates';
import { PurchaseReportData } from '../types';
import DecimalField from './DecimalField';

interface PurchaseReportRowProps {
  report: PurchaseReportData;
  index: number;
  canEdit: boolean;
  onUpdate: (field: string, value: string, index: number) => void;
}

const PurchaseReportRow = React.memo<PurchaseReportRowProps>(({ report, index, canEdit, onUpdate }) => {
  const handleChange = useCallback((field: string, value: string) => {
    onUpdate(field, value, index);
  }, [onUpdate, index]);

  const handleSpecialApprovalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Math.max(0, Math.floor(Number(e.target.value)) || 0);
    handleChange('specialApproval', String(n));
  }, [handleChange]);

  const handleProductionLineStopChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Math.max(0, Math.floor(Number(e.target.value)) || 0);
    handleChange('productionLineStop', String(n));
  }, [handleChange]);

  // 檢驗批數為0（無上傳資料）時，該行採購評鑑欄位為只讀
  const receivedBatchesNum = typeof report.receivedBatches === 'string'
    ? parseInt(report.receivedBatches) || 0
    : (report.receivedBatches || 0);
  const rowEditable = canEdit && receivedBatchesNum > 0;

  return (
    <TableRow key={report.vendorName}>
      <TableCell>{report.vendorName}</TableCell>
      <TableCell align="center">{report.receivedBatches}</TableCell>
      <TableCell align="center">
        <Typography variant="body2">
          {report.returnedBatches || 0}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <DecimalField
          value={report.deliveryRate}
          onCommit={(v) => handleChange('deliveryRate', String(v))}
          min={0}
          max={100}
          decimals={1}
          emptyDefault={100}
          disabled={!rowEditable}
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
          {report.deliveryDeduction ?? 0}
        </Typography>
      </TableCell>
      <TableCell align="center">
        <TextField
          variant="outlined"
          size="small"
          type="number"
          value={report.specialApproval}
          onChange={handleSpecialApprovalChange}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'center' } }}
          disabled={!rowEditable}
        />
      </TableCell>
      <TableCell align="center">
        <TextField
          variant="outlined"
          size="small"
          type="number"
          value={report.productionLineStop}
          onChange={handleProductionLineStopChange}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'center' } }}
          disabled={!rowEditable}
        />
      </TableCell>
      <TableCell align="center">{report.totalPurchaseAssessmentScoreA !== null ? report.totalPurchaseAssessmentScoreA.toFixed(2) : ''}</TableCell>
      <TableCell align="center">
        <DecimalField
          value={report.service}
          onCommit={(v) => handleChange('service', String(v))}
          min={0}
          max={5}
          snap={0.5}
          emptyDefault={0}
          disabled={!rowEditable}
        />
      </TableCell>
    </TableRow>
  );
});

const PurchaseReport = React.memo(() => {
  const { purchaseReportData, updatePurchaseReport, vendorCategoryMap, materialCategoryFilter } = useReportContext();
  const { canEditPurchase } = useAuth();
  const [rulesOpen, setRulesOpen] = useState(false);

  // 按物料類別模糊篩選，保留原始下標以保證內聯編輯寫回正確的供應商行
  const filter = materialCategoryFilter.trim().toLowerCase();
  const visibleRows = purchaseReportData
    .map((report, index) => ({ report, index, cat: vendorCategoryMap[report.vendorName] || '' }))
    .filter(({ cat }) => !filter || cat.toLowerCase().includes(filter));

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Accordion expanded={rulesOpen} onChange={(_, v) => setRulesOpen(v)} sx={{ boxShadow: 'none', border: 1, borderColor: 'divider' }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="purchase-scoring-rules-content"
            id="purchase-scoring-rules-header"
            sx={{
              '& .MuiAccordionSummary-content': { alignItems: 'center' },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              📋 采购评分计算规则说明
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.875rem' }}>
                <li>
                  <strong>迟交批数：</strong>从上传的Excel文件中获取，不可手动修改。
                </li>
                <li>
                  <strong>达交率 (%)：</strong>预设 100.0，后续依实际达交率手动更新（范围 0-100，保留 1 位小数）。
                </li>
                <li>
                  <strong>达交率扣分项：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>达交率 ≥ 99.5% → 扣 0 分</li>
                    <li>95% ≤ 达交率 &lt; 99.5% → 扣 5 分</li>
                    <li>90% ≤ 达交率 &lt; 95% → 扣 10 分</li>
                    <li>85% ≤ 达交率 &lt; 90% → 扣 15 分</li>
                    <li>达交率 &lt; 85% → 扣 20 分</li>
                  </ul>
                </li>
                <li>
                  <strong>特采 (扣1分/次)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>每发生一次特采，采购评核扣 1 分</li>
                  </ul>
                </li>
                <li>
                  <strong>断线次数 (扣20分/次)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>每发生一次断线，采购评核扣 20 分</li>
                  </ul>
                </li>
                <li>
                  <strong>采购评核 (20分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>采购评核 = max(0, 20 − 达交率扣分项 − 断线次数×20 − 特采)</li>
                  </ul>
                </li>
                <li>
                  <strong>服务评分-采购评分 (5分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '0' }}>
                    <li>手动输入 0 ~ 5 分（可含 0.5，如 1.5、2.5）</li>
                  </ul>
                </li>
              </Box>
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>
    <TableContainer sx={{ maxHeight: 600 }}>
      <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 160 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 140 }} />
        </colgroup>
        <TableHead sx={{
          '& th': {
            backgroundColor: 'background.paper',
            top: 0,
            zIndex: 1,
          }
        }}>
          <TableRow>
            <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>廠商名稱</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>進貨批數</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">退貨批數</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">达交率</Typography>
              <Typography variant="caption" color="text.secondary">(%)</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">达交率扣分项</Typography>
              <Typography variant="caption" color="text.secondary">自动计算</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">特採</Typography>
              <Typography variant="caption" color="text.secondary">(扣1分/次)</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">断线次数</Typography>
              <Typography variant="caption" color="text.secondary">(扣20分/次)</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">采购评核</Typography>
              <Typography variant="caption" color="text.secondary">(20分)</Typography>
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>
              <Typography variant="body2">服务评分-采购评分</Typography>
              <Typography variant="caption" color="text.secondary">(5分)</Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {purchaseReportData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {EmptyStateMessages.purchaseReport('SQM')}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map(({ report, index }) => (
              <PurchaseReportRow
                key={report.vendorName}
                report={report}
                index={index}
                canEdit={canEditPurchase}
                onUpdate={updatePurchaseReport}
              />
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
  );
});

export default PurchaseReport;
