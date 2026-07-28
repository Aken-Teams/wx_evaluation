﻿﻿﻿﻿import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, IconButton, Typography, Box, Accordion, AccordionSummary, AccordionDetails, Alert
} from '@mui/material';
import { Refresh as RefreshIcon, ExpandMore } from '@mui/icons-material';
import { useReportContext } from '../contexts/ReportContext';
import { ComprehensiveReportData } from '../types';
import { ComprehensiveReportHeaders } from '../config/reportConfig';

interface Props {
  currentReport?: {
    year: number;
    month: number;
    quarter: number;
  };
}

const getGradeColor = (grade: string | null): string => {
  if (!grade) return '#e5e7eb';
  switch (grade) {
    case 'A':
    case 'B':
      return '#86efac'; // 绿色
    case 'C':
    case 'D':
      return '#fde047'; // 黄色
    case 'E':
      return '#fca5a5'; // 红色
    default:
      return '#e5e7eb';
  }
};

const ComprehensiveReport: React.FC<Props> = ({ currentReport }) => {
  const { comprehensiveReportData, updateComprehensiveReport, vendorCategoryMap, materialCategoryFilter } = useReportContext();
  const [rulesOpen, setRulesOpen] = useState(false);

  // 按物料類別模糊篩選，保留原始下標（index 與保存邏輯均以完整陣列下標為鍵）
  const filter = materialCategoryFilter.trim().toLowerCase();
  const visibleRows = comprehensiveReportData
    .map((report: ComprehensiveReportData, index: number) => ({ report, index, cat: vendorCategoryMap[report.vendorName] || '' }))
    .filter(({ cat }) => !filter || cat.toLowerCase().includes(filter));

  const formatScore = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toFixed(2);
  };

  if (!comprehensiveReportData || comprehensiveReportData.length === 0) {
    return (
      <Paper className="mt-4">
        <Typography className="p-4 text-gray-500" align="center">
          暂无数据，请先在"导入/粘贴数据"页填写供应商数据并保存
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper className="mt-4">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" className="p-4">
          季度综合评价表
        </Typography>
        <Box display="flex" gap={1}>
          <IconButton onClick={() => window.location.reload()} title="刷新" style={{ color: '#64748b' }}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ mb: 2, mx: 2 }}>
        <Accordion expanded={rulesOpen} onChange={(_, v) => setRulesOpen(v)} sx={{ boxShadow: 'none', border: 1, borderColor: '#e2e8f0' }}>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls="comprehensive-scoring-rules-content"
            id="comprehensive-scoring-rules-header"
            sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2563eb' }}>
              📋 综合评分计算规则说明
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.875rem' }}>
                <li>
                  <strong>品质总分 (70分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>= 品质评鉴报告「品质评分-QC评分」(LAR评分 + CAR评分)</li>
                  </ul>
                </li>
                <li>
                  <strong>交期分数 (20分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>= 采购评鉴报告「采购评核」(达交率扣分项、断线、特采)</li>
                  </ul>
                </li>
                <li>
                  <strong>服务分数 (10分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>= 品质评鉴的服务评分(5分) + 采购评鉴的服务评分(5分)</li>
                  </ul>
                </li>
                <li>
                  <strong>综合评分 (100分)：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <li>= 品质总分 + 交期分数 + 服务分数</li>
                  </ul>
                </li>
                <li>
                  <strong>等级判断（依供应商是否 AU 分档，「是否AU」栏含 AU 即 AU，空白为 Non-AU）：</strong>
                  <Box sx={{ overflowX: 'auto', mt: 0.5 }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>等级</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>Non-AU 综合评分</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>AU 综合评分</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px', textAlign: 'center' }}><strong>A</strong></td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>&gt; 95</td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>&gt; 98</td></tr>
                        <tr><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px', textAlign: 'center' }}><strong>B</strong></td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>85 ~ 95（含）</td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>90 ~ 98（含）</td></tr>
                        <tr><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px', textAlign: 'center' }}><strong>C</strong></td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>75 ~ 85（含）</td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>80 ~ 90（含）</td></tr>
                        <tr><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px', textAlign: 'center' }}><strong>D</strong></td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>60 ~ 75（含）</td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>70 ~ 80（含）</td></tr>
                        <tr><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px', textAlign: 'center' }}><strong>E</strong></td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>&lt; 60</td><td style={{ border: '1px solid #cbd5e1', padding: '2px 10px' }}>&lt; 70</td></tr>
                      </tbody>
                    </table>
                  </Box>
                </li>
                <li>
                  <strong>降等决策：</strong>
                  <ul style={{ marginTop: '4px', marginBottom: '0' }}>
                    <li>得分等级为 <strong>A</strong>：若品质（&lt;56分）或交期（&lt;15分）任一项低于单元目标，则降等为 B</li>
                    <li>得分等级为 <strong>B</strong>：若品质（&lt;56分）或交期（&lt;15分）任一项低于单元目标，则降等为 C</li>
                    <li>得分等级为 <strong>C</strong>：若品质（&lt;56分）<strong>且</strong>交期（&lt;15分）两项皆低于单元目标，则降等为 D</li>
                    <li>若连续 2 季（含）以上评核等级为 C 或 D 者，则再向下降低 1 个等级（C→D，D→E）</li>
                  </ul>
                </li>
              </Box>
            </Alert>
          </AccordionDetails>
        </Accordion>
      </Box>

      <TableContainer style={{ overflowX: 'auto' }}>
        <Table size="small" style={{ borderCollapse: 'collapse' }}>
          <TableHead style={{ backgroundColor: '#e2e8f0' }}>
            <TableRow>
              {ComprehensiveReportHeaders.map((header) => (
                <TableCell key={header} align="center" style={{ fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid #cbd5e1' }}>
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map(({ report, index }, displayIdx) => (
              <TableRow key={report.vendorName} hover style={{ backgroundColor: report.downgradeDecision ? '#fef2f2' : 'transparent' }}>
                <TableCell style={{ border: '1px solid #cbd5e1' }}>{displayIdx + 1}</TableCell>
                <TableCell style={{ border: '1px solid #cbd5e1' }}>{report.vendorName}</TableCell>
                <TableCell align="center" style={{ border: '1px solid #cbd5e1' }}>{formatScore(report.totalQualityScore)}</TableCell>
                <TableCell align="center" style={{ border: '1px solid #cbd5e1' }}>{formatScore(report.deliveryScore)}</TableCell>
                <TableCell align="center" style={{ border: '1px solid #cbd5e1' }}>{formatScore(report.serviceScore)}</TableCell>
                <TableCell align="center" style={{ fontWeight: 600, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                  {formatScore(report.assessmentScore)}
                </TableCell>
                <TableCell align="center" style={{ border: '1px solid #cbd5e1' }}>
                  {report.noTransaction ? (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  ) : report.downgradeDecision ? (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>是</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>否</span>
                  )}
                </TableCell>
                <TableCell align="center" style={{ border: '1px solid #cbd5e1' }}>
                  {report.noTransaction ? (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  ) : (
                    <Box component="span" style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      fontWeight: 600,
                      backgroundColor: getGradeColor(report.finalAssessmentGrade || report.grade),
                      color: '#1f2937'
                    }}>
                      {report.finalAssessmentGrade || report.grade || '—'}
                    </Box>
                  )}
                </TableCell>
                <TableCell style={{ border: '1px solid #cbd5e1' }}>
                  <TextField
                    size="small"
                    value={report.noTransaction ? '本季无交易' : (report.remarks ?? '')}
                    onChange={(e) => updateComprehensiveReport('remarks', e.target.value || null, index)}
                    disabled={!!report.noTransaction}
                    placeholder="请输入备注"
                    fullWidth
                    style={{ minWidth: 160 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box p={2} fontSize="12px" color="text.secondary" style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        评分说明：品质总分=品质评鉴报告QC评分（LAR评分+CAR评分，满分70），交期分数=采购评鉴报告采购评核（满分20），
        服务分数=品质报告服务评分+采购报告服务评分（满分10），综合评分=品质总分+交期分数+服务分数（满分100）。
        等级分档（依供应商是否AU）：Non-AU——A&gt;95、B 85~95、C 75~85、D 60~75、E&lt;60；AU——A&gt;98、B 90~98、C 80~90、D 70~80、E&lt;70（「是否AU」栏含AU即AU，空白为Non-AU）。
        降等条件：A级/B级——品质总分&lt;56 或 交期分数&lt;15 任一项低于单元目标即降一等；C级——品质总分&lt;56 且 交期分数&lt;15 两项皆低于单元目标才降为D；
        另连续2季（含）以上评核等级为C或D者，再向下降低1个等级（C→D，D→E）。
      </Box>
    </Paper>
  );
};

export default ComprehensiveReport;
