﻿import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemText,
  ListItemButton,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useReportContext } from '../contexts/ReportContext';
import api from '../services/api';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  useEffect(() => {
    const loadAvailableYears = async () => {
      setLoadingYears(true);
      try {
        const endpoint = '/available-years/sqm-vqm';
        const response = await api.get(endpoint);
        const years = Array.isArray(response.data) ? response.data.map(String) : [];
        setDbYears(years);
      } catch (error) {
        console.error('載入可用年份失敗:', error);
        setDbYears([]);
      } finally {
        setLoadingYears(false);
      }
    };
    loadAvailableYears();
  }, []);
  
  const years = useMemo(() => {
    const merged = Array.from(new Set([
      ...dbYears,
      ...customYears,
      currentYear.toString()
    ]));
    return merged.sort((a, b) => parseInt(b) - parseInt(a));
  }, [dbYears, customYears, currentYear]);
  
  const quarters = useMemo(() => ['Q1', 'Q2', 'Q3', 'Q4'], []);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [newYear, setNewYear] = useState<string>('');
  const { isMonthlyDirty, isAnnualDirty } = useReportContext();

  const persistCustomYears = useCallback((list: string[]) => {
    setCustomYears(list);
    try { localStorage.setItem('customYears', JSON.stringify(list)); } catch {}
  }, []);

  const confirmNavigate = (to: string) => {
    // 检查当前页面（而非目标页面）是否有未保存的变更
    const currentParts = location.pathname.split('/').filter(Boolean);
    let dirty = false;

    if (currentParts[0] === 'sqm-vqm' && currentParts[1] === 'quarterly' && currentParts[2] && currentParts[3]) {
      dirty = isMonthlyDirty(currentParts[2], currentParts[3]);
    } else if (currentParts[0] === 'sqm-vqm' && currentParts[1] === 'yearly' && currentParts[2]) {
      dirty = isAnnualDirty(currentParts[2]);
    }

    if (dirty) {
      const ok = window.confirm('目前有未儲存的變更，是否要離開頁面？');
      if (!ok) return;
    }
    navigate(to);
  };

  const handleYearChange = (event: SelectChangeEvent<string>) => {
    const year = event.target.value as string;
    setSelectedYear(year);
    confirmNavigate(`/sqm-vqm/yearly/${year}`);
  };

  const handlePeriodClick = (period: string) => {
    const year = selectedYear || currentYear.toString();
    confirmNavigate(`/sqm-vqm/quarterly/${year}/${period}`);
  };

  const handleAddYear = () => {
    const cleaned = (newYear || '').trim();
    if (!/^\d{4}$/.test(cleaned)) return;
    if (years.includes(cleaned)) return;
    const updated = [...customYears, cleaned];
    persistCustomYears(updated);
    setSelectedYear(cleaned);
    setNewYear('');
    navigate(`/sqm-vqm/yearly/${cleaned}`);
    
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

  const handleYearlyReportClick = () => {
    confirmNavigate(`/sqm-vqm/yearly/${selectedYear || currentYear.toString()}`);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
          position: 'relative',
          backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #F9FBFF 100%)',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', p: 2 }}>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="year-select-label">年份</InputLabel>
          <Select
            labelId="year-select-label"
            label="年份"
            value={selectedYear}
            onChange={handleYearChange}
          >
            {years.map((year) => (
              <MenuItem key={year} value={year}>{year} 年</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="新增年份"
            placeholder="例如 2028"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            inputProps={{ inputMode: 'numeric', pattern: '\\d{4}' }}
            fullWidth
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleAddYear}
            disabled={!/^\d{4}$/.test((newYear || '').trim()) || years.includes((newYear || '').trim())}
          >
            新增
          </Button>
        </Box>

        <Button
          variant="contained"
          size="small"
          fullWidth
          sx={{ 
            mb: 2, 
            borderRadius: 2, 
            backgroundColor: '#1976d2',
            '&:hover': { backgroundColor: '#1565c0' }
          }}
          onClick={handleYearlyReportClick}
        >
          年度評鑑表
        </Button>

        <List
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 1,
            rowGap: 0,
            p: 0,
          }}
        >
          {quarters.map((quarter) => (
            <ListItemButton
              key={quarter}
              onClick={() => handlePeriodClick(quarter)}
              sx={{
                m: 0,
                px: 1,
                borderRadius: 1,
                '&:hover': { backgroundColor: 'action.hover' },
                '& .MuiListItemText-primary': { textAlign: 'left' },
              }}
            >
              <ListItemText primary={quarter} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default Navigation;