import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useReportContext } from '../contexts/ReportContext';
import UnsavedPrompt from '../components/UnsavedPrompt';
import { exportSQMVQMToExcel } from '../utils/excelExport';
import { SQMVQMData } from '../types';
import api from '../services/api';

const SQMVQMPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const { role } = useAuth();
  const { isSQMVQMDirty, markSQMVQMSaved, setDirtySQMVQM } = useReportContext();
  
  const [sqmVqmData, setSqmVqmData] = useState<SQMVQMData[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEdit = role === 'admin' || role === 'quality_yearly_editor';

  useEffect(() => {
    // 切換年度時清除之前的提示訊息，避免顯示前一個年度的訊息
    setAlert(null);
    
    // 載入SQM/VQM資料
    loadSQMVQMData();
  }, [year]);

  const loadSQMVQMData = async () => {
    try {
      const response = await api.get(`/sqm-vqm/${year}`);
      setSqmVqmData(response.data);
      setIsDirty(false);
      setDirtySQMVQM(year!, false);
    } catch (error) {
      console.error('載入SQM/VQM資料失敗:', error);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/sqm-vqm/${year}`, sqmVqmData);
      setIsDirty(false);
      setDirtySQMVQM(year!, false);
      markSQMVQMSaved(year!);
      setAlert({ type: 'success', message: 'SQM/VQM資料已成功儲存' });
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      setAlert({ type: 'error', message: '儲存失敗，請稍後再試' });
    }
  };

  const handleExport = () => {
    try {
      exportSQMVQMToExcel(sqmVqmData, year!);
      setAlert({ type: 'success', message: 'Excel檔案已成功下載' });
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      setAlert({ type: 'error', message: '下載失敗，請稍後再試' });
    }
  };

  const addVendor = () => {
    const newVendor: SQMVQMData = {
      id: Date.now().toString(),
      vendorName: '',
      supplierCode: '',
      supplierType: '',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      qualificationStatus: '',
      auditDate: '',
      auditScore: 0,
      nextAuditDate: '',
      remarks: '',
    };
    setSqmVqmData([...sqmVqmData, newVendor]);
    setIsDirty(true);
    setDirtySQMVQM(year!, true);
  };

  const removeVendor = (id: string) => {
    setSqmVqmData(sqmVqmData.filter(vendor => vendor.id !== id));
    setIsDirty(true);
    setDirtySQMVQM(year!, true);
  };

  const updateVendor = (id: string, field: keyof SQMVQMData, value: string | number) => {
    setSqmVqmData(sqmVqmData.map(vendor => 
      vendor.id === id ? { ...vendor, [field]: value } : vendor
    ));
    setIsDirty(true);
    setDirtySQMVQM(year!, true);
  };

  // 移除這個函數，因為我們現在使用ReportContext的isSQMVQMDirty

  return (
    <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
      <UnsavedPrompt when={isSQMVQMDirty(year!)} />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          SQM/VQM供應商管理 - {year}年
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={sqmVqmData.length === 0}
          >
            下載Excel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!canEdit || !isDirty}
          >
            儲存至後端
          </Button>
        </Box>
      </Box>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: '70vh' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 60, width: 60 }}>序號</TableCell>
                <TableCell sx={{ minWidth: 150, width: 150 }}>供應商名稱</TableCell>
                <TableCell sx={{ minWidth: 120, width: 120 }}>供應商代碼</TableCell>
                <TableCell sx={{ minWidth: 100, width: 100 }}>供應商類型</TableCell>
                <TableCell sx={{ minWidth: 100, width: 100 }}>聯絡人</TableCell>
                <TableCell sx={{ minWidth: 120, width: 120 }}>聯絡電話</TableCell>
                <TableCell sx={{ minWidth: 150, width: 150 }}>聯絡信箱</TableCell>
                <TableCell sx={{ minWidth: 100, width: 100 }}>資格狀態</TableCell>
                <TableCell sx={{ minWidth: 120, width: 120 }}>稽核日期</TableCell>
                <TableCell sx={{ minWidth: 100, width: 100 }}>稽核分數</TableCell>
                <TableCell sx={{ minWidth: 120, width: 120 }}>下次稽核日期</TableCell>
                <TableCell sx={{ minWidth: 200, width: 200 }}>備註</TableCell>
                {canEdit && (
                  <TableCell sx={{ minWidth: 80, width: 80 }}>操作</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {sqmVqmData.map((vendor, index) => (
                <TableRow key={vendor.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.vendorName}
                      onChange={(e) => updateVendor(vendor.id, 'vendorName', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.supplierCode}
                      onChange={(e) => updateVendor(vendor.id, 'supplierCode', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.supplierType}
                      onChange={(e) => updateVendor(vendor.id, 'supplierType', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.contactPerson}
                      onChange={(e) => updateVendor(vendor.id, 'contactPerson', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.contactPhone}
                      onChange={(e) => updateVendor(vendor.id, 'contactPhone', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.contactEmail}
                      onChange={(e) => updateVendor(vendor.id, 'contactEmail', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.qualificationStatus}
                      onChange={(e) => updateVendor(vendor.id, 'qualificationStatus', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="date"
                      value={vendor.auditDate}
                      onChange={(e) => updateVendor(vendor.id, 'auditDate', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="number"
                      value={vendor.auditScore}
                      onChange={(e) => updateVendor(vendor.id, 'auditScore', parseFloat(e.target.value) || 0)}
                      disabled={!canEdit}
                      inputProps={{ min: 0, max: 100, step: 0.1 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="date"
                      value={vendor.nextAuditDate}
                      onChange={(e) => updateVendor(vendor.id, 'nextAuditDate', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="outlined"
                      size="small"
                      value={vendor.remarks}
                      onChange={(e) => updateVendor(vendor.id, 'remarks', e.target.value)}
                      disabled={!canEdit}
                      fullWidth
                      multiline
                      rows={2}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Tooltip title="刪除供應商">
                        <IconButton
                          color="error"
                          onClick={() => removeVendor(vendor.id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {canEdit && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addVendor}
          >
            新增供應商
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default SQMVQMPage;
