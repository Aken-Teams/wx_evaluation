import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import api from '../services/api';

type UnansweredRow = {
  id: number;
  userId: number;
  username: string;
  question: string;
  systemType: string;
  aiResponse: string | null;
  notes: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};

type UsageRow = { userId: number; username: string; count: number };
type QuestionTypeRow = { queryType: string; count: number };
type LlmConfig = { model: string; apiUrl: string; apiUrlFull?: string };

const TAB_KEYS = ['unanswered', 'usage', 'questionTypes', 'llm'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const RobotAdmin = () => {
  const [tab, setTab] = useState<TabKey>('unanswered');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 無法回答 Log
  const [unansweredList, setUnansweredList] = useState<UnansweredRow[]>([]);
  const [unansweredTotal, setUnansweredTotal] = useState(0);
  const [unansweredResolvedFilter, setUnansweredResolvedFilter] = useState<string>('');
  const [editDialog, setEditDialog] = useState<UnansweredRow | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editResolved, setEditResolved] = useState(false);
  const [unansweredLoading, setUnansweredLoading] = useState(false);

  // 使用頻率
  const [usageList, setUsageList] = useState<UsageRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageStart, setUsageStart] = useState('');
  const [usageEnd, setUsageEnd] = useState('');

  // 問題類型
  const [questionTypesList, setQuestionTypesList] = useState<QuestionTypeRow[]>([]);
  const [questionTypesLoading, setQuestionTypesLoading] = useState(false);
  const [qtStart, setQtStart] = useState('');
  const [qtEnd, setQtEnd] = useState('');

  // LLM
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmForm, setLlmForm] = useState({ model: '', apiUrl: '', apiKey: '' });
  const [llmSaveLoading, setLlmSaveLoading] = useState(false);

  const loadUnanswered = async () => {
    setUnansweredLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '200', offset: '0' };
      if (unansweredResolvedFilter !== '') params.resolved = unansweredResolvedFilter;
      const res = await api.get<{ list: UnansweredRow[]; total: number }>('/admin/ai/unanswered', { params });
      setUnansweredList(res.data.list);
      setUnansweredTotal(res.data.total);
    } catch (e) {
      setError('讀取無法回答紀錄失敗');
    } finally {
      setUnansweredLoading(false);
    }
  };

  const loadUsage = async () => {
    setUsageLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (usageStart) params.startDate = usageStart;
      if (usageEnd) params.endDate = usageEnd;
      const res = await api.get<UsageRow[]>('/admin/ai/stats/usage', { params });
      setUsageList(res.data);
    } catch (e) {
      setError('讀取使用頻率失敗');
    } finally {
      setUsageLoading(false);
    }
  };

  const loadQuestionTypes = async () => {
    setQuestionTypesLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (qtStart) params.startDate = qtStart;
      if (qtEnd) params.endDate = qtEnd;
      const res = await api.get<QuestionTypeRow[]>('/admin/ai/stats/question-types', { params });
      setQuestionTypesList(res.data);
    } catch (e) {
      setError('讀取問題類型統計失敗');
    } finally {
      setQuestionTypesLoading(false);
    }
  };

  const loadLlm = async () => {
    setLlmLoading(true);
    setError(null);
    try {
      const res = await api.get<LlmConfig>('/admin/ai/llm');
      setLlmConfig(res.data);
      setLlmForm({ model: res.data.model, apiUrl: res.data.apiUrlFull || '', apiKey: '' });
    } catch (e) {
      setError('讀取 LLM 設定失敗');
    } finally {
      setLlmLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'unanswered') loadUnanswered();
    else if (tab === 'usage') loadUsage();
    else if (tab === 'questionTypes') loadQuestionTypes();
    else if (tab === 'llm') loadLlm();
  }, [tab, unansweredResolvedFilter]);

  const handleUpdateUnanswered = async () => {
    if (!editDialog) return;
    setError(null);
    try {
      await api.put(`/admin/ai/unanswered/${editDialog.id}`, { notes: editNotes, resolved: editResolved });
      setEditDialog(null);
      setSuccess('已更新');
      loadUnanswered();
    } catch (e) {
      setError('更新失敗');
    }
  };

  const handleDeleteUnanswered = async (id: number) => {
    if (!window.confirm('確定刪除此筆紀錄？')) return;
    setError(null);
    try {
      await api.delete(`/admin/ai/unanswered/${id}`);
      setSuccess('已刪除');
      loadUnanswered();
    } catch (e) {
      setError('刪除失敗');
    }
  };

  const handleSaveLlm = async () => {
    setLlmSaveLoading(true);
    setError(null);
    try {
      await api.put('/admin/ai/llm', {
        model: llmForm.model || undefined,
        apiUrl: llmForm.apiUrl || undefined,
        apiKey: llmForm.apiKey || undefined,
      });
      setSuccess('LLM 設定已儲存');
      loadLlm();
    } catch (e) {
      setError('儲存 LLM 設定失敗');
    } finally {
      setLlmSaveLoading(false);
    }
  };

  const openEdit = (row: UnansweredRow) => {
    setEditDialog(row);
    setEditNotes(row.notes || '');
    setEditResolved(row.resolved);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        機器人後台資料統計
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        僅最高權限（admin）可見。用於檢視無法回答的問題 Log、使用頻率、問題類型統計與 LLM 管理。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="無法回答紀錄 (Log)" value="unanswered" />
        <Tab label="各帳戶使用頻率" value="usage" />
        <Tab label="問題類型統計" value="questionTypes" />
        <Tab label="LLM 管理" value="llm" />
      </Tabs>

      {/* 無法回答紀錄 */}
      {tab === 'unanswered' && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>狀態</InputLabel>
              <Select
                value={unansweredResolvedFilter}
                label="狀態"
                onChange={(e) => setUnansweredResolvedFilter(e.target.value)}
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="false">未處理</MenuItem>
                <MenuItem value="true">已處理</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={loadUnanswered} disabled={unansweredLoading}>
              重新載入
            </Button>
            <Typography variant="body2" color="text.secondary">
              共 {unansweredTotal} 筆
            </Typography>
          </Box>
          {unansweredLoading ? (
            <Typography>載入中…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>時間</TableCell>
                  <TableCell>帳號</TableCell>
                  <TableCell>系統</TableCell>
                  <TableCell>問題</TableCell>
                  <TableCell>AI 回覆摘要</TableCell>
                  <TableCell>備註 / 已處理</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unansweredList.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.createdAt).toLocaleString('zh-TW')}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.systemType}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>{row.question}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>{(row.aiResponse || '').slice(0, 80)}…</TableCell>
                    <TableCell>
                      {row.resolved ? <Chip size="small" label="已處理" color="success" /> : <Chip size="small" label="未處理" />}
                      {row.notes && ` ${row.notes.slice(0, 30)}`}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(row)} title="編輯/標記已處理">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteUnanswered(row.id)} title="刪除">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!unansweredLoading && unansweredList.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              尚無無法回答的紀錄
            </Typography>
          )}
        </Paper>
      )}

      {/* 使用頻率 */}
      {tab === 'usage' && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="date"
              label="開始日期"
              value={usageStart}
              onChange={(e) => setUsageStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="結束日期"
              value={usageEnd}
              onChange={(e) => setUsageEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={loadUsage} disabled={usageLoading}>
              查詢
            </Button>
          </Box>
          {usageLoading ? (
            <Typography>載入中…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>帳號</TableCell>
                  <TableCell>userId</TableCell>
                  <TableCell align="right">提問次數</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usageList.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell>{r.username}</TableCell>
                    <TableCell>{r.userId}</TableCell>
                    <TableCell align="right">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!usageLoading && usageList.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              尚無使用紀錄
            </Typography>
          )}
        </Paper>
      )}

      {/* 問題類型 */}
      {tab === 'questionTypes' && (
        <Paper sx={{ p: 2 }}>
          <Accordion variant="outlined" sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="medium">問題類型一覽說明</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                以下為系統依問題內容自動判定的類型 (queryType)，統計即依此分類計次。
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>問題類型</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>說明</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>觸發關鍵詞（部分）</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow><TableCell>ranking</TableCell><TableCell>排名／排序</TableCell><TableCell>排名、排位、排序、依據…排名</TableCell></TableRow>
                  <TableRow><TableCell>trend</TableCell><TableCell>趨勢／比較</TableCell><TableCell>趨勢、變化、走勢、哪一家、最大、最小、最高、最低、變化最大</TableCell></TableRow>
                  <TableRow><TableCell>comparison</TableCell><TableCell>比較／對比</TableCell><TableCell>比較、對比</TableCell></TableRow>
                  <TableRow><TableCell>statistics</TableCell><TableCell>統計／分析</TableCell><TableCell>統計、分析</TableCell></TableRow>
                  <TableRow><TableCell>audit_type</TableCell><TableCell>稽核類型查詢</TableCell><TableCell>稽核類型、稽核計畫、下年度稽核計畫（且指定類型）</TableCell></TableRow>
                  <TableRow><TableCell>audit_type_statistics</TableCell><TableCell>稽核類型統計</TableCell><TableCell>同上 ＋ 統計、各別、分別、有哪些、幾種（各別有幾家等）</TableCell></TableRow>
                  <TableRow><TableCell>query</TableCell><TableCell>一般查詢</TableCell><TableCell>以上皆不符合時的預設</TableCell></TableRow>
                  <TableRow><TableCell>unanswered</TableCell><TableCell>無法回答</TableCell><TableCell>機器人回覆「數據中沒有找到相關信息」「無法回答」「沒有找到匹配的供應商」等時，歸類為此類；詳見「無法回答紀錄」分頁</TableCell></TableRow>
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                若未判定出類型則記為 query；(未分類) 表示 queryType 為空值。
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="date"
              label="開始日期"
              value={qtStart}
              onChange={(e) => setQtStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="結束日期"
              value={qtEnd}
              onChange={(e) => setQtEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={loadQuestionTypes} disabled={questionTypesLoading}>
              查詢
            </Button>
          </Box>
          {questionTypesLoading ? (
            <Typography>載入中…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>問題類型 (queryType)</TableCell>
                  <TableCell align="right">次數</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {questionTypesList.map((r) => (
                  <TableRow key={r.queryType}>
                    <TableCell>{r.queryType}</TableCell>
                    <TableCell align="right">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!questionTypesLoading && questionTypesList.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              尚無問題類型統計
            </Typography>
          )}
        </Paper>
      )}

      {/* LLM 管理 */}
      {tab === 'llm' && (
        <Paper sx={{ p: 2 }}>
          {llmLoading ? (
            <Typography>載入中…</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
              {llmConfig && (
                <Typography variant="body2" color="text.secondary">
                  目前使用：模型 {llmConfig.model}，API {llmConfig.apiUrl}
                </Typography>
              )}
              <TextField
                size="small"
                label="模型名稱 (OLLAMA_MODEL)"
                value={llmForm.model}
                onChange={(e) => setLlmForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="例如 llama3.2"
              />
              <TextField
                size="small"
                label="API URL (OLLAMA_API_URL)"
                value={llmForm.apiUrl}
                onChange={(e) => setLlmForm((f) => ({ ...f, apiUrl: e.target.value }))}
                placeholder="留空則使用 .env 設定"
              />
              <TextField
                size="small"
                type="password"
                label="API Key (選填)"
                value={llmForm.apiKey}
                onChange={(e) => setLlmForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="留空則不更新"
              />
              <Button variant="contained" onClick={handleSaveLlm} disabled={llmSaveLoading}>
                {llmSaveLoading ? '儲存中…' : '儲存 LLM 設定'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                儲存後會覆蓋 .env 的設定，重啟伺服器後若 DB 無設定則仍以 .env 為準。
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* 編輯 / 標記已處理 對話框 */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>編輯紀錄 / 標記已處理</DialogTitle>
        <DialogContent>
          {editDialog && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                問題：{editDialog.question}
              </Typography>
              <TextField
                multiline
                rows={3}
                label="備註"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="訓練或處理備註"
              />
              <FormControl>
                <InputLabel>狀態</InputLabel>
                <Select
                  value={editResolved ? 'true' : 'false'}
                  label="狀態"
                  onChange={(e) => setEditResolved(e.target.value === 'true')}
                >
                  <MenuItem value="false">未處理</MenuItem>
                  <MenuItem value="true">已處理（可刪除）</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>取消</Button>
          <Button variant="contained" onClick={handleUpdateUnanswered}>
            儲存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RobotAdmin;
