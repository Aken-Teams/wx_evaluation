﻿import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Paper,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import YearSelectionDialog from '../components/YearSelectionDialog';

const SQMVQMHomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [yearDialogMode, setYearDialogMode] = useState<'yearly' | 'quarterly' | null>(null);

  const handleNavigateToYearly = () => {
    setYearDialogMode('yearly');
    setYearDialogOpen(true);
  };

  const handleNavigateToQuarterly = () => {
    setYearDialogMode('quarterly');
    setYearDialogOpen(true);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ color: '#1976d2', mb: 4 }}>
        SQM/VQM 供應商管理系統
      </Typography>
      
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        歡迎使用 SQM/VQM 供應商評核系統
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', backgroundColor: '#f8f9fa' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CalendarIcon sx={{ color: '#1976d2', mr: 1, fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  季度評核報告
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                管理各季度的供應商評核資料，包含品質評鑑、採購評鑑和綜合評價。
              </Typography>
              <CardActions>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleNavigateToQuarterly}
                  sx={{ borderColor: '#1976d2', color: '#1976d2' }}
                >
                  查看季度報告
                </Button>
              </CardActions>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', backgroundColor: '#f8f9fa' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssessmentIcon sx={{ color: '#1976d2', mr: 1, fontSize: 32 }} />
                <Typography variant="h5" component="h2">
                  年度評鑑表
                </Typography>
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                查看和管理 {currentYear} 年度的供應商評鑑資料，包含年度稽核、等級評定等功能。
              </Typography>
              <CardActions>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleNavigateToYearly}
                  sx={{ backgroundColor: '#1976d2' }}
                >
                  進入年度評鑑表
                </Button>
              </CardActions>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, backgroundColor: '#e3f2fd' }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
          系統功能特色
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <BusinessIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="body1">供應商管理</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUpIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="body1">品質評鑑</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AssessmentIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="body1">採購評鑑</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarIcon sx={{ color: '#1976d2', mr: 1 }} />
              <Typography variant="body1">年度彙整</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 年份選擇對話框 */}
      <YearSelectionDialog
        open={yearDialogOpen}
        onClose={() => {
          setYearDialogOpen(false);
          setYearDialogMode(null);
        }}
        onConfirm={(year) => {
          if (yearDialogMode === 'yearly') {
            navigate(`/sqm-vqm/yearly/${year}`);
          } else if (yearDialogMode === 'quarterly') {
            navigate(`/sqm-vqm/quarterly/${year}/01`);
          }
        }}
        systemType="sqm-vqm"
        title={yearDialogMode === 'yearly' ? '選擇年度評鑑表年份' : '選擇季度報告年份'}
        confirmLabel={yearDialogMode === 'yearly' ? '查看年度評鑑表' : '查看季度報告'}
      />
    </Box>
  );
};

export default SQMVQMHomePage;





















