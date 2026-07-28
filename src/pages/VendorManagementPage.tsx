﻿import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
} from '@mui/material';
import VendorManagement from '../components/VendorManagement';

const VendorManagementPage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          供應商管理
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          管理系統中的供應商資料。
        </Typography>

        <Box sx={{ p: 3 }}>
          <VendorManagement systemType="sqm-vqm" />
        </Box>
      </Paper>
    </Container>
  );
};

export default VendorManagementPage;