﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useCallback, useState } from 'react';
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
import { QualityReportData } from '../types';
import DecimalField from './DecimalField';

const calculateLARScore = (larPercent: number | null | undefined): number => {
  if (!larPercent || larPercent < 0) return 0;
  if (larPercent >= 100) return 30;
  if (larPercent >= 99) return 28;
  if (larPercent >= 95) return 26;
  if (larPercent >= 85) return 22;
  if (larPercent >= 80) return 18;
  if (larPercent >= 75) return 14;
  return 0;
};

interface QualityReportRowProps {
  report: QualityReportData;
  index: number;
  canEdit: boolean;
  onUpdate: (field: string, value: string, index: number) => void;
}

const QualityReportRow = React.memo<QualityReportRowProps>(({ report, index, canEdit, onUpdate }) => {
  const handleChange = useCallback((field: string, value: string) => {
    onUpdate(field, value, index);
  }, [onUpdate, index]);

  const handleExternalCARChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(0, value);
    handleChange('externalCAR', clampedValue.toString());
  }, [handleChange]);

  const handleArrChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(0, value);
    handleChange('arr', clampedValue.toString());
  }, [handleChange]);

  const handleUntimelyResponseCCRChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(0, value);
    handleChange('untimelyResponseCCR', clampedValue.toString());
  }, [handleChange]);

  // 檢驗批數為0時 LAR% 預設100
  const larPercent = report.receivedBatches === 0
    ? 100
    : (1 - report.returnedBatches / report.receivedBatches) * 100;

  return (
    <TableRow key={report.vendorName}>
      <TableCell sx={{ borderRight: 1, borderRightColor: 'divider', whiteSpace: 'nowrap' }}>{report.vendorName}</TableCell>
      <TableCell align="center">{report.receivedBatches}</TableCell>
      <TableCell align="center">{report.receivedBatches === 0 ? '-' : report.returnedBatches}</TableCell>
      <TableCell align="center">
        {larPercent.toFixed(2)}
      </TableCell>
      <TableCell align="center">
        <TextField
          variant="outlined"
          size="small"
          type="number"
          value={report.externalCAR}
          onChange={handleExternalCARChange}
          disabled={!canEdit}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'center', width: '80px', padding: '8px' } }}
        />
      </TableCell>
      <TableCell align="center">
        <TextField
          variant="outlined"
          size="small"
          type="number"
          value={report.arr}
          onChange={handleArrChange}
          disabled={!canEdit}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'center', width: '80px', padding: '8px' } }}
        />
      </TableCell>
      <TableCell align="center">
        <TextField
          variant="outlined"
          size="small"
          type="number"
          value={report.untimelyResponseCCR}
          onChange={handleUntimelyResponseCCRChange}
          disabled={!canEdit}
          inputProps={{ min: 0, step: 1, style: { textAlign: 'center', width: '80px', padding: '8px' } }}
        />
      </TableCell>
      <TableCell align="center">
        {calculateLARScore(larPercent)}
      </TableCell>
      <TableCell align="center">{report.totalBaseScoreB == null ? '' : report.totalBaseScoreB.toFixed(2)}</TableCell>
      <TableCell align="center">{report.qualityAssessmentScoreC1 == null ? '' : report.qualityAssessmentScoreC1.toFixed(2)}</TableCell>
      <TableCell align="center">
        <DecimalField
          value={report.service}
          onCommit={(v) => handleChange('service', String(v))}
          min={0}
          max={5}
          snap={0.5}
          emptyDefault={0}
          disabled={!canEdit}
        />
      </TableCell>
    </TableRow>
  );
});

const QualityReport = React.memo(() => {
  const { qualityReportData, updateQualityReport, vendorCategoryMap, materialCategoryFilter } = useReportContext();
  const { canEditQuality } = useAuth();
  const [rulesOpen, setRulesOpen] = useState(false);

  // 按物料類別模糊篩選，保留原始下標以保證內聯編輯寫回正確的供應商行
  const filter = materialCategoryFilter.trim().toLowerCase();
  const visibleRows = qualityReportData
    .map((report, index) => ({ report, index, cat: vendorCategoryMap[report.vendorName] || '' }))
    .filter(({ cat }) => !filter || cat.toLowerCase().includes(filter));

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Accordion expanded={rulesOpen} onChange={(_, v) => setRulesOpen(v)} sx={{ boxShadow: 'none', border: 1, borderColor: 'divider' }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="quality-scoring-rules-content"
            id="quality-scoring-rules-header"
            sx={{
              '& .MuiAccordionSummary-content': { alignItems: 'center' },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              📋 品质评分计算规则说明
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.875rem' }}>
                <li>
                  <strong>LAR评分 (30分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>LAR(%) = (1 − 退貨批數 / 檢驗批數) × 100</li>
                    <li>LAR ≥ 100% → 30分</li>
                    <li>99% ≤ LAR &lt; 100% → 28分</li>
                    <li>95% ≤ LAR &lt; 99% → 26分</li>
                    <li>85% ≤ LAR &lt; 95% → 22分</li>
                    <li>80% ≤ LAR &lt; 85% → 18分</li>
                    <li>75% ≤ LAR &lt; 80% → 14分</li>
                    <li>LAR &lt; 75% → 0分</li>
                  </ul>
                </li>
                <li>
                  <strong>CAR评分 (40分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>CAR評分 = 40 − 外部客訴件數×10 − 產線CAR件數×5 − 延遲回覆件數×3</li>
                    <li>最低分數為 0 分</li>
                  </ul>
                </li>
                <li>
                  <strong>品质评分-QC评分 (70分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '0' }}>
                    <li>QC評分 = LAR評分 + CAR評分</li>
                    <li>滿分為 70 分</li>
                  </ul>
                </li>
                <li>
                  <strong>服务评分-QC评分 (5分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '0' }}>
                    <li>手动输入 0 ~ 5 分（可含 0.5，如 1.5、2.5）</li>
                  </ul>
                </li>
              </Box>
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>
      <TableContainer sx={{ maxHeight: 600, position: 'relative' }}>
      <Table
        size="small"
        stickyHeader
        sx={{
          tableLayout: 'fixed',
          '& thead th': { position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'background.paper' },
          '& thead th:first-of-type': {
            left: 0,
            zIndex: 1000,
            minWidth: 240,
            width: 240,
            boxSizing: 'border-box',
            boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.12)'
          },
          '& tbody td': { position: 'relative', zIndex: 0, backgroundColor: 'background.paper' },
          '& tbody td:first-of-type': {
            position: 'sticky',
            left: 0,
            zIndex: 999,
            minWidth: 240,
            width: 240,
            boxSizing: 'border-box',
            boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.12)'
          },
        }}
      >
        <colgroup>
          <col style={{ width: 320 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-all', borderRight: 1, borderRightColor: 'divider' }}>廠商名稱</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>检验批数</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>退貨批數</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>LAR<br/>(%)</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              外部客诉件数
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              产线<br/>(CAR件数)
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              延迟回复件数
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              LAR评分<br/>(30分)
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              CAR评分<br/>(40分)
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              品质评分-QC评分<br/>(70分)
            </TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              服务评分-QC评分<br/>(5分)
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {EmptyStateMessages.qualityReport('SQM')}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map(({ report, index }) => (
              <QualityReportRow
                key={report.vendorName}
                report={report}
                index={index}
                canEdit={canEditQuality}
                onUpdate={updateQualityReport}
              />
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
    </Box>
  );
});

export default QualityReport;