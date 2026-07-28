import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import api from '../services/api';

interface YearSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (year: string) => void;
  title?: string;
  confirmLabel?: string;
}

const YearSelectionDialog: React.FC<YearSelectionDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = '選擇年份',
  confirmLabel = '確認',
}) => {
  const currentYear = new Date().getFullYear();
  const [dbYears, setDbYears] = useState<string[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [customYears, setCustomYears] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('customYears');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [newYear, setNewYear] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 合併年份：資料庫年份 + localStorage 自訂年份 + 當前年份
  const years = useMemo(() => {
    const merged = Array.from(new Set([
      ...dbYears,
      ...customYears,
      currentYear.toString(), // 確保當前年份始終顯示
    ]));
    return merged.sort((a, b) => parseInt(b) - parseInt(a)); // 降序排列
  }, [dbYears, customYears, currentYear]);

  // 從資料庫載入可用年份
  useEffect(() => {
    if (!open) return; // 只在對話框打開時載入

    const loadAvailableYears = async () => {
      setLoadingYears(true);
      setError(null);
      try {
        const endpoint = '/available-years/sqm-vqm';
        const response = await api.get(endpoint);
        const years = Array.isArray(response.data) ? response.data.map(String) : [];
        setDbYears(years);
      } catch (error) {
        console.error('載入可用年份失敗:', error);
        setError('載入年份列表失敗，將使用預設年份');
        setDbYears([]);
      } finally {
        setLoadingYears(false);
      }
    };

    loadAvailableYears();
  }, [open]);

  // 當對話框打開時，重置選中年份為當前年份
  useEffect(() => {
    if (open) {
      setSelectedYear(currentYear.toString());
      setNewYear('');
      setError(null);
    }
  }, [open, currentYear]);

  const handleYearChange = (event: SelectChangeEvent<string>) => {
    setSelectedYear(event.target.value as string);
  };

  const handleAddYear = () => {
    const cleaned = (newYear || '').trim();
    if (!/^\d{4}$/.test(cleaned)) {
      setError('年份格式錯誤，請輸入4位數字（例如：2025）');
      return;
    }
    if (years.includes(cleaned)) {
      setError('該年份已存在於列表中');
      return;
    }

    // 添加到自訂年份列表
    const updated = [...customYears, cleaned];
    setCustomYears(updated);
    try {
      localStorage.setItem('customYears', JSON.stringify(updated));
    } catch (e) {
      console.error('儲存自訂年份失敗:', e);
    }

    // 選中新增的年份
    setSelectedYear(cleaned);
    setNewYear('');
    setError(null);

    // 重新載入資料庫年份（因為可能有新資料存入）
    const loadAvailableYears = async () => {
      try {
        const endpoint = '/available-years/sqm-vqm';
        const response = await api.get(endpoint);
        const years = Array.isArray(response.data) ? response.data.map(String) : [];
        setDbYears(years);
      } catch (error) {
        console.error('重新載入可用年份失敗:', error);
      }
    };
    loadAvailableYears();
  };

  const handleConfirm = () => {
    if (!selectedYear) {
      setError('請選擇一個年份');
      return;
    }
    onConfirm(selectedYear);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="year-select-label">年份</InputLabel>
            <Select
              labelId="year-select-label"
              label="年份"
              value={selectedYear}
              onChange={handleYearChange}
              disabled={loadingYears}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year} 年
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label="新增年份"
              placeholder="例如 2028"
              value={newYear}
              onChange={(e) => {
                setNewYear(e.target.value);
                setError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddYear();
                }
              }}
              sx={{ flex: 1 }}
              helperText="輸入4位數字年份"
            />
            <Button
              variant="outlined"
              onClick={handleAddYear}
              disabled={loadingYears}
              sx={{ mt: '4px' }}
            >
              新增
            </Button>
          </Box>

          {loadingYears && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              正在載入年份列表...
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!selectedYear || loadingYears}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default YearSelectionDialog;

