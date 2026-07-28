import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Drawer,
  TextField,
  IconButton,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
} from '@mui/material';
import {
  SmartToy as RobotIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  BarChart as ChartIcon,
  Download as DownloadIcon,
  PictureAsPdf as ImageIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TrendChart from './TrendChart';
import { exportToCSV, exportToExcel, exportMultipleSheetsToExcel } from '../utils/dataExport';
// 靜態導入 html2canvas（確保 Vite 正確處理）
// @ts-ignore - html2canvas 類型定義問題
import html2canvas from 'html2canvas';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  contextData?: any;
}

interface AIChatBotProps {
}

const AIChatBot: React.FC<AIChatBotProps> = () => {
  const [open, setOpen] = useState(false);
  const systemType = 'sqm-vqm';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { token } = useAuth();

  // 滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 如果沒有登入，不顯示機器人（必須在所有 Hooks 之後）
  if (!token) {
    return null;
  }

  // 發送消息
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await api.post('/ai/chat', {
        question: inputValue.trim(),
        systemType: systemType,
        conversationId: conversationId
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date(),
        contextData: response.data.contextData
      };

      setMessages(prev => [...prev, assistantMessage]);
      setConversationId(response.data.conversationId);
    } catch (error: any) {
      console.error('發送消息失敗:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `抱歉，發生錯誤：${error.response?.data?.message || error.message || '無法連接到 AI 服務'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 清除對話歷史
  const handleClearHistory = async () => {
    if (!window.confirm('確定要清除當前對話歷史嗎？')) return;

    try {
      await api.delete('/ai/chat/history', {
        data: { systemType }
      });
      setMessages([]);
      setConversationId(null);
    } catch (error) {
      console.error('清除歷史失敗:', error);
    }
  };

  // 導出數據
  const handleExportData = (data: any[], dataType: string, format: 'csv' | 'excel' = 'excel') => {
    if (!data || data.length === 0) {
      alert('沒有數據可導出');
      return;
    }

    const filename = `${systemType}_${dataType}_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      exportToCSV(data, filename);
    } else {
      exportToExcel(data, filename, dataType);
    }
  };

  // 渲染表格（帶導出功能）
  const renderTable = (data: any[], dataType: string = '數據') => {
    if (!data || data.length === 0) return null;

    const firstItem = data[0];
    const columns = Object.keys(firstItem);

    return (
      <Box sx={{ mt: 1, mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            共 {data.length} 筆數據
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => handleExportData(data, dataType, 'csv')}
              variant="outlined"
            >
              導出 CSV
            </Button>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => handleExportData(data, dataType, 'excel')}
              variant="outlined"
            >
              導出 Excel
            </Button>
          </Box>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map(col => (
                  <TableCell key={col} sx={{ fontWeight: 'bold' }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.slice(0, 10).map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map(col => (
                    <TableCell key={col}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data.length > 10 && (
          <Box sx={{ p: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              顯示前 10 筆，完整數據請使用導出功能
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // 渲染統計圖表（簡單的文本格式）
  const renderStatistics = (stats: any) => {
    if (!stats || Object.keys(stats).length === 0) return null;

    return (
      <Box sx={{ mt: 1, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          📊 統計數據
        </Typography>
        {stats.averageScore !== undefined && (
          <Typography variant="body2">平均分數: {stats.averageScore}</Typography>
        )}
        {stats.maxScore !== undefined && (
          <Typography variant="body2">最高分數: {stats.maxScore}</Typography>
        )}
        {stats.minScore !== undefined && (
          <Typography variant="body2">最低分數: {stats.minScore}</Typography>
        )}
        {stats.totalVendors !== undefined && (
          <Typography variant="body2">供應商總數: {stats.totalVendors}</Typography>
        )}
      </Box>
    );
  };

  return (
    <>
      {/* 左下角懸浮按鈕 */}
      <Fab
        aria-label="AI 助手"
        size="large"
        sx={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: open ? 1100 : 9999, // 當抽屜打開時降低 z-index，避免擋住抽屜
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: open ? 'none' : 'flex', // 當抽屜打開時隱藏按鈕
          bgcolor: '#6a1b9a', // 深紫色
          color: '#fff',
          width: 64,
          height: 64,
          '&:hover': {
            bgcolor: '#7b1fa2',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          },
          '& .MuiSvgIcon-root': {
            fontSize: 36, // 機器人圖示加大
          },
        }}
        onClick={() => setOpen(true)}
      >
        <RobotIcon />
      </Fab>

      {/* 聊天抽屜 */}
      <Drawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 600, md: 700, lg: 800 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10000, // 確保抽屜在最上層
          },
        }}
      >
        {/* 標題欄 */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RobotIcon color="primary" />
            <Typography variant="h6">AI 問答助手</Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* 清除對話歷史 */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          {messages.length > 0 && (
            <Button
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleClearHistory}
              sx={{ mt: 1 }}
            >
              清除對話歷史
            </Button>
          )}
        </Box>

        {/* 消息列表 */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
            bgcolor: 'background.default',
          }}
        >
          {messages.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              請選擇系統類型後開始提問。我可以幫您查詢供應商數據、月評核、年度評核等信息。
            </Alert>
          )}

          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                mb: 2,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '80%',
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                  color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </Typography>

                {/* 如果有上下文數據，顯示表格和統計 */}
                {msg.contextData && msg.role === 'assistant' && (
                  <Box sx={{ mt: 2 }}>
                    {/* 月評核數據 */}
                    {msg.contextData.monthlyReports && msg.contextData.monthlyReports.length > 0 && (
                      <>
                        <Chip
                          icon={<ChartIcon />}
                          label="月評核數據"
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        {renderTable(msg.contextData.monthlyReports, '月評核數據')}
                        
                        {/* 趨勢圖（如果有足夠的數據點） */}
                        {msg.contextData.monthlyReports.length >= 2 && (
                          <Box sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Chip
                                icon={<ChartIcon />}
                                label="趨勢圖"
                                size="small"
                                color="primary"
                              />
                              <Button
                                size="small"
                                startIcon={<ImageIcon />}
                                onClick={async () => {
                                  try {
                                    // 觸發圖表下載
                                    const chartElement = document.querySelector(`[data-chart-id="${msg.timestamp.getTime()}"]`);
                                    if (chartElement) {
                                      const canvas = await html2canvas(chartElement as HTMLElement, {
                                        backgroundColor: '#ffffff',
                                        scale: 2,
                                      });
                                      const imageDataUrl = canvas.toDataURL('image/png');
                                      const link = document.createElement('a');
                                      link.download = `趨勢圖_${new Date().getTime()}.png`;
                                      link.href = imageDataUrl;
                                      link.click();
                                    }
                                  } catch (error) {
                                    console.error('下載圖片失敗:', error);
                                    alert('下載圖片失敗，請重試');
                                  }
                                }}
                                variant="outlined"
                              >
                                下載圖片
                              </Button>
                            </Box>
                            <Box data-chart-id={msg.timestamp.getTime()}>
                              <TrendChart
                                data={msg.contextData.monthlyReports}
                                title="考核分數趨勢"
                                dataKey="assessmentScore"
                              />
                            </Box>
                          </Box>
                        )}
                      </>
                    )}

                    {/* 年度評核數據 */}
                    {msg.contextData.yearlyReports && msg.contextData.yearlyReports.length > 0 && (
                      <>
                        <Chip
                          icon={<ChartIcon />}
                          label="年度評核數據"
                          size="small"
                          sx={{ mb: 1, mt: 1 }}
                        />
                        {renderTable(msg.contextData.yearlyReports, '年度評核數據')}
                      </>
                    )}

                    {/* 統計數據 */}
                    {msg.contextData.statistics && Object.keys(msg.contextData.statistics).length > 0 && (
                      <>
                        {renderStatistics(msg.contextData.statistics)}
                        <Box sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={() => {
                              // 將統計數據轉換為數組格式以便導出
                              const statsData = [msg.contextData.statistics];
                              handleExportData(statsData, '統計數據', 'excel');
                            }}
                            variant="outlined"
                          >
                            導出統計數據
                          </Button>
                        </Box>
                      </>
                    )}

                    {/* 批量導出所有數據 */}
                    {(msg.contextData.monthlyReports?.length > 0 || msg.contextData.yearlyReports?.length > 0) && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => {
                            const sheets = [];
                            if (msg.contextData.monthlyReports?.length > 0) {
                              sheets.push({
                                name: '月評核數據',
                                data: msg.contextData.monthlyReports,
                              });
                            }
                            if (msg.contextData.yearlyReports?.length > 0) {
                              sheets.push({
                                name: '年度評核數據',
                                data: msg.contextData.yearlyReports,
                              });
                            }
                            if (sheets.length > 0) {
                              exportMultipleSheetsToExcel(sheets, `${systemType}_完整數據`);
                            }
                          }}
                          variant="contained"
                          color="primary"
                        >
                          導出所有數據 (Excel)
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}

                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 1,
                    opacity: 0.7,
                  }}
                >
                  {msg.timestamp.toLocaleTimeString()}
                </Typography>
              </Paper>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Paper sx={{ p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ ml: 1, display: 'inline' }}>
                  思考中...
                </Typography>
              </Paper>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* 輸入框 */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="輸入您的問題..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
            >
              <SendIcon />
            </IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            提示：可以詢問供應商數據、月評核、年度評核等問題
          </Typography>
        </Box>
      </Drawer>
    </>
  );
};

export default AIChatBot;

