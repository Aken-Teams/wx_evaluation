﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Stack,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  InputAdornment,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Refresh as RefreshIcon, 
  Download as DownloadIcon, 
  Edit as EditIcon, 
  Upload as UploadIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useAuth } from '../contexts/AuthContext';
import { exportVendorListToExcel } from '../utils/excelExport';
import { parseVendorExcelFile } from '../utils/vendorExcelParser';
import api from '../services/api';

interface BatchUploadResult {
  message?: string;
  success: { name: string; id: number }[];
  failed: { name: string; reason: string }[];
  skipped: { name: string; reason: string; id?: number }[];
}

interface Vendor {
  id: number;
  name: string;
  vendorType?: string; // 向后兼容：仍读取数据库中的旧字段
  supplierCode?: string | null;
  materialCategory?: string | null;
  region?: string | null; // 供应商类型：国内 / 国外 / 海外
  isAU?: string | null; // 是否AU（自由文字）
  createdAt: string;
}

type SortKey = 'name' | 'supplierCode' | 'materialCategory' | 'region' | 'createdAt';

const SUPPLIER_TYPE_OPTIONS = ['国内', '国外', '海外'] as const;
type SupplierType = typeof SUPPLIER_TYPE_OPTIONS[number];

// 取得供应商类型：优先使用 region（新规范），否则回落到 vendorType（旧数据）
const getSupplierType = (v: Vendor): string => v.region || v.vendorType || '-';

const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  
  // 编辑状态
  const [editSupplierCode, setEditSupplierCode] = useState('');
  const [editMaterialCategory, setEditMaterialCategory] = useState('');
  const [editRegion, setEditRegion] = useState<SupplierType | ''>('国内');
  const [editIsAU, setEditIsAU] = useState('');

  // 新增供应商状态
  const [newVendorName, setNewVendorName] = useState('');
  const [newSupplierCode, setNewSupplierCode] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newRegion, setNewRegion] = useState<SupplierType | ''>('国内');
  const [newIsAU, setNewIsAU] = useState('');
  
  // 批量上传状态
  const [openBatchUploadDialog, setOpenBatchUploadDialog] = useState(false);
  const [batchUploadLoading, setBatchUploadLoading] = useState(false);
  const [batchUploadResult, setBatchUploadResult] = useState<BatchUploadResult | null>(null);
  const [batchUploadError, setBatchUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 清空供应商确认对话框
  const [openClearConfirm, setOpenClearConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
  // 筛选与排序状态
  const [filterName, setFilterName] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'quality_yearly_editor';
  // 移除供應商僅限管理員
  const isSuperAdmin = role === 'admin';
  // 移除供應商確認對話框
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  // OSAT 模組已移除，本頁僅服務 SQM/VQM
  const systemType = 'sqm-vqm';

  // 筛选和排序后的数据
  const filteredVendors = useMemo(() => {
    let result = [...vendors];
    
    // 筛选
    if (filterName) {
      result = result.filter(v => 
        v.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }
    if (filterCode) {
      result = result.filter(v => 
        (v.supplierCode || '').toLowerCase().includes(filterCode.toLowerCase())
      );
    }
    if (filterCategory) {
      result = result.filter(v => 
        (v.materialCategory || '').toLowerCase().includes(filterCategory.toLowerCase())
      );
    }
    if (filterRegion) {
      result = result.filter(v =>
        getSupplierType(v).toLowerCase().includes(filterRegion.toLowerCase())
      );
    }

    // 排序
    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortKey) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'supplierCode':
          aVal = a.supplierCode || '';
          bVal = b.supplierCode || '';
          break;
        case 'materialCategory':
          aVal = a.materialCategory || '';
          bVal = b.materialCategory || '';
          break;
        case 'region':
          aVal = getSupplierType(a);
          bVal = getSupplierType(b);
          break;
        case 'createdAt':
          return sortOrder === 'asc'
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      const cmp = aVal.localeCompare(bVal, 'zh-TW');
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [vendors, filterName, filterCode, filterCategory, filterRegion, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const fetchVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = '/admin/sqm-vqm-vendors';
      const response = await api.get(endpoint);
      setVendors(response.data);
    } catch (err: any) {
      let errorMessage = '獲取供應商列表失敗';
      if (err?.response) {
        const status = err.response.status;
        const errorData = err.response.data;
        if (status === 403) {
          errorMessage = '權限不足，無法獲取供應商列表。';
        } else if (status === 401) {
          errorMessage = '認證失敗，請重新登入';
        } else if (errorData?.message || errorData?.error) {
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addVendor = async () => {
    if (!newVendorName.trim()) {
      setError('請輸入供應商名稱');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = '/admin/sqm-vqm-vendors';
      const payload = {
        name: newVendorName.trim(),
        supplierCode: newSupplierCode.trim(),
        materialCategory: newMaterialCategory.trim(),
        region: newRegion || '国内',
        isAU: newIsAU.trim(),
      };

      await api.post(endpoint, payload);

      setSuccess('供應商添加成功');
      setNewVendorName('');
      setNewSupplierCode('');
      setNewMaterialCategory('');
      setNewRegion('国内');
      setNewIsAU('');
      setOpenDialog(false);
      fetchVendors();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || '添加供應商失敗';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (vendors.length === 0) {
      setError('沒有供應商資料可供下載');
      return;
    }
    try {
      exportVendorListToExcel(vendors, systemType);
      setSuccess('供應商列表已成功下載');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下載失敗，請稍後再試');
    }
  };

  const handleEditClick = (vendor: Vendor) => {
    if (systemType !== 'sqm-vqm') {
      return;
    }
    setEditingVendor(vendor);
    setEditSupplierCode(vendor.supplierCode || '');
    setEditMaterialCategory(vendor.materialCategory || '');
    // 优先取 region，否则回落 vendorType，确保旧数据也能正确显示
    setEditRegion((SUPPLIER_TYPE_OPTIONS.includes(vendor.region as SupplierType) ? vendor.region : (SUPPLIER_TYPE_OPTIONS.includes(vendor.vendorType as SupplierType) ? vendor.vendorType : '国内')) as SupplierType);
    setEditIsAU(vendor.isAU || '');
    setOpenEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editingVendor) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.put(`/admin/sqm-vqm-vendors/${editingVendor.id}`, {
        supplierCode: editSupplierCode.trim(),
        materialCategory: editMaterialCategory.trim(),
        region: editRegion || '国内',
        isAU: editIsAU.trim(),
      });

      setSuccess('供應商資料更新成功');
      setOpenEditDialog(false);
      setEditingVendor(null);
      fetchVendors();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || '更新供應商資料失敗';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setOpenEditDialog(false);
    setEditingVendor(null);
    setEditSupplierCode('');
    setEditMaterialCategory('');
    setEditRegion('国内');
    setEditIsAU('');
  };

  // 移除供應商（僅限管理員）
  const handleDeleteVendor = async () => {
    if (!editingVendor) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/admin/sqm-vqm-vendors/${editingVendor.id}`);
      setSuccess(`供應商「${editingVendor.name}」已移除`);
      setOpenDeleteConfirm(false);
      setOpenEditDialog(false);
      setEditingVendor(null);
      fetchVendors();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || '移除供應商失敗';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBatchUploadLoading(true);
    setBatchUploadError(null);
    setBatchUploadResult(null);

    try {
      const vendors = await parseVendorExcelFile(file);
      
      const response = await api.post('/admin/sqm-vqm-vendors/batch', { vendors });
      setBatchUploadResult(response.data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || '批量導入失敗';
      setBatchUploadError(errorMessage);
    } finally {
      setBatchUploadLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBatchUploadDialogClose = () => {
    setOpenBatchUploadDialog(false);
    setBatchUploadResult(null);
    setBatchUploadError(null);
  };

  const handleBatchUploadSuccess = () => {
    fetchVendors();
    handleBatchUploadDialogClose();
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterCode('');
    setFilterCategory('');
    setFilterRegion('');
  };

  const handleClearAll = async () => {
    if (confirmText !== '確認清空') {
      setError('請輸入「確認清空」以繼續');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.delete('/admin/sqm-vqm-vendors/all');
      setSuccess('所有供應商資料已清空');
      setOpenClearConfirm(false);
      setConfirmText('');
      fetchVendors();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || '清空供應商失敗';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchVendors();
    }
  }, [isAdmin, systemType]);

  if (!isAdmin) {
    return (
      <Alert severity="warning">
        只有管理員和年度評鑑編輯者可以查看和管理供應商列表
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          SQM/VQM 供應商管理
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchVendors}
            disabled={loading}
          >
            刷新
          </Button>
          <Button
            variant="outlined"
            color="success"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={loading || vendors.length === 0}
          >
            下載
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            disabled={loading}
          >
            添加供應商
          </Button>
          {systemType === 'sqm-vqm' && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<UploadIcon />}
              onClick={() => setOpenBatchUploadDialog(true)}
              disabled={loading}
            >
              批量導入
            </Button>
          )}
          {systemType === 'sqm-vqm' && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setOpenClearConfirm(true)}
              disabled={loading || vendors.length === 0}
            >
              清空供應商
            </Button>
          )}
        </Stack>
      </Box>

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

      {/* 筛选栏 */}
      {systemType === 'sqm-vqm' && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="搜索供應商名稱"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 180 }}
            />
            <TextField
              size="small"
              placeholder="供應商編號"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              sx={{ minWidth: 140 }}
            />
            <TextField
              size="small"
              placeholder="物料類別"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              sx={{ minWidth: 140 }}
            />
            <TextField
              size="small"
              placeholder="供應商類型"
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              sx={{ minWidth: 140 }}
            />
            {(filterName || filterCode || filterCategory || filterRegion) && (
              <Button
                size="small"
                onClick={clearFilters}
              >
                清除篩選
              </Button>
            )}
            <Typography variant="body2" color="textSecondary" sx={{ ml: 'auto' }}>
              顯示 {filteredVendors.length} / {vendors.length} 筆
            </Typography>
          </Stack>
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'name'}
                  direction={sortKey === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  供應商名稱
                </TableSortLabel>
              </TableCell>
              {systemType === 'sqm-vqm' && (
                <>
                  <TableCell>是否AU</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'supplierCode'}
                      direction={sortKey === 'supplierCode' ? sortOrder : 'asc'}
                      onClick={() => handleSort('supplierCode')}
                    >
                      供應商編號
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'materialCategory'}
                      direction={sortKey === 'materialCategory' ? sortOrder : 'asc'}
                      onClick={() => handleSort('materialCategory')}
                    >
                      物料類別
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'region'}
                      direction={sortKey === 'region' ? sortOrder : 'asc'}
                      onClick={() => handleSort('region')}
                    >
                      供應商類型
                    </TableSortLabel>
                  </TableCell>
                </>
              )}
              <TableCell>
                <TableSortLabel
                  active={sortKey === 'createdAt'}
                  direction={sortKey === 'createdAt' ? sortOrder : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  創建時間
                </TableSortLabel>
              </TableCell>
              {systemType === 'sqm-vqm' && <TableCell>操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVendors.map((vendor) => (
              <TableRow key={vendor.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {vendor.name}
                  </Typography>
                </TableCell>
                {systemType === 'sqm-vqm' && (
                  <>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.isAU || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.supplierCode || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.materialCategory || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getSupplierType(vendor)}
                        color={
                          getSupplierType(vendor) === '国内' ? 'primary' :
                          getSupplierType(vendor) === '国外' ? 'secondary' : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                  </>
                )}
                <TableCell>
                  {new Date(vendor.createdAt).toLocaleDateString('zh-TW')}
                </TableCell>
                {systemType === 'sqm-vqm' && (
                  <TableCell>
                    <Tooltip title="編輯供應商資料">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(vendor)}
                        disabled={loading}
                        color="primary"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 添加供应商对话框 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>添加新供應商</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="供應商名稱 *"
            fullWidth
            variant="outlined"
            value={newVendorName}
            onChange={(e) => setNewVendorName(e.target.value)}
            sx={{ mb: 2 }}
          />
          {systemType === 'sqm-vqm' && (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  margin="dense"
                  label="供應商編號"
                  fullWidth
                  variant="outlined"
                  value={newSupplierCode}
                  onChange={(e) => setNewSupplierCode(e.target.value)}
                />
                <TextField
                  select
                  margin="dense"
                  label="供應商類型"
                  fullWidth
                  variant="outlined"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value as SupplierType)}
                  SelectProps={{ native: true }}
                >
                  {SUPPLIER_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  margin="dense"
                  label="物料類別"
                  fullWidth
                  variant="outlined"
                  value={newMaterialCategory}
                  onChange={(e) => setNewMaterialCategory(e.target.value)}
                  placeholder="例如：直接物料-晶片"
                />
                <TextField
                  margin="dense"
                  label="是否AU"
                  fullWidth
                  variant="outlined"
                  value={newIsAU}
                  onChange={(e) => setNewIsAU(e.target.value)}
                />
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button onClick={addVendor} variant="contained" disabled={loading}>
            {loading ? '添加中...' : '添加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑供应商对话框 */}
      {systemType === 'sqm-vqm' && (
        <Dialog open={openEditDialog} onClose={handleEditCancel} maxWidth="md" fullWidth>
          <DialogTitle>編輯供應商資料</DialogTitle>
          <DialogContent>
            <TextField
              margin="dense"
              label="供應商名稱"
              fullWidth
              variant="outlined"
              value={editingVendor?.name || ''}
              disabled
              sx={{ mb: 2 }}
            />
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                margin="dense"
                label="供應商編號"
                fullWidth
                variant="outlined"
                value={editSupplierCode}
                onChange={(e) => setEditSupplierCode(e.target.value)}
              />
              <TextField
                select
                margin="dense"
                label="供應商類型"
                fullWidth
                variant="outlined"
                value={editRegion}
                onChange={(e) => setEditRegion(e.target.value as SupplierType)}
                SelectProps={{ native: true }}
              >
                {SUPPLIER_TYPE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                margin="dense"
                label="物料類別"
                fullWidth
                variant="outlined"
                value={editMaterialCategory}
                onChange={(e) => setEditMaterialCategory(e.target.value)}
              />
              <TextField
                margin="dense"
                label="是否AU"
                fullWidth
                variant="outlined"
                value={editIsAU}
                onChange={(e) => setEditIsAU(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between' }}>
            <Box>
              {isSuperAdmin && (
                <Button color="error" onClick={() => setOpenDeleteConfirm(true)} disabled={loading}>
                  移除供應商
                </Button>
              )}
            </Box>
            <Box>
              <Button onClick={handleEditCancel}>取消</Button>
              <Button onClick={handleEditSave} variant="contained" disabled={loading} sx={{ ml: 1 }}>
                {loading ? '更新中...' : '更新'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      )}

      {/* 移除供應商確認對話框（僅限管理員） */}
      <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>移除供應商</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>此操作將永久移除供應商「{editingVendor?.name}」及其所有季度/年度評鑑資料，無法復原。</strong>
          </Alert>
          <Typography variant="body2">確定要移除嗎？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleDeleteVendor} disabled={loading}>
            {loading ? '移除中...' : '確認移除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 批量上传对话框 */}
      <Dialog open={openBatchUploadDialog} onClose={handleBatchUploadDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>批量導入供應商</DialogTitle>
        <DialogContent>
          {!batchUploadResult && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <strong>Excel 模板格式要求：</strong>
                <br />
                <ul>
                  <li>第一行為標題行</li>
                  <li>必填列：<strong>供應商名稱</strong>（支持中文：供應商/供应商，英文：vendor/name）</li>
                  <li>可選列：<strong>供應商編號、物料類別、供應商類型、是否AU</strong></li>
                  <li>供應商類型可選值：<strong>国内 / 国外 / 海外</strong></li>
                  <li>若 Excel 中未填寫供應商類型，系統預設為「国内」</li>
                  <li><strong>是否AU</strong> 為文字欄位，原样匯入所填內容，未填則留空</li>
                </ul>
              </Alert>
              
              <Box sx={{ border: '1px dashed #ccc', borderRadius: 2, p: 6, textAlign: 'center' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBatchUpload}
                  style={{ display: 'none' }}
                  id="vendor-upload-file"
                />
                <label htmlFor="vendor-upload-file">
                  <Button
                    variant="contained"
                    component="span"
                    disabled={batchUploadLoading}
                    startIcon={<UploadIcon />}
                    size="large"
                  >
                    {batchUploadLoading ? (
                      <><CircularProgress size={20} sx={{ mr: 1 }} /> 上傳中...</>
                    ) : (
                      '選擇Excel檔案'
                    )}
                  </Button>
                </label>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                  支援 .xlsx 或 .xls 格式
                </Typography>
              </Box>
            </>
          )}

          {batchUploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {batchUploadError}
            </Alert>
          )}

          {batchUploadResult && (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                {batchUploadResult.message || '批量導入完成'}
              </Alert>
              
              {batchUploadResult.success.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                    ✓ 成功導入 ({batchUploadResult.success.length} 筆)
                  </Typography>
                  <List dense>
                    {batchUploadResult.success.slice(0, 10).map((item, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={item.name} />
                      </ListItem>
                    ))}
                    {batchUploadResult.success.length > 10 && (
                      <ListItem>
                        <ListItemText primary={`... 還有 ${batchUploadResult.success.length - 10} 筆`} />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {batchUploadResult.skipped.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                    ⚠️ 跳過/已更新 ({batchUploadResult.skipped.length} 筆)
                  </Typography>
                  <List dense>
                    {batchUploadResult.skipped.slice(0, 10).map((item, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={`${item.name} - ${item.reason}`} />
                      </ListItem>
                    ))}
                    {batchUploadResult.skipped.length > 10 && (
                      <ListItem>
                        <ListItemText primary={`... 還有 ${batchUploadResult.skipped.length - 10} 筆`} />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {batchUploadResult.failed.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                    ✗ 失敗 ({batchUploadResult.failed.length} 筆)
                  </Typography>
                  <List dense>
                    {batchUploadResult.failed.slice(0, 10).map((item, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={`${item.name} - ${item.reason}`} />
                      </ListItem>
                    ))}
                    {batchUploadResult.failed.length > 10 && (
                      <ListItem>
                        <ListItemText primary={`... 還有 ${batchUploadResult.failed.length - 10} 筆`} />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!batchUploadResult && (
            <Button onClick={handleBatchUploadDialogClose}>取消</Button>
          )}
          {batchUploadResult && (
            <>
              <Button onClick={handleBatchUploadDialogClose}>關閉</Button>
              <Button onClick={handleBatchUploadSuccess} variant="contained">
                確認並刷新列表
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* 清空供应商确认对话框 */}
      <Dialog open={openClearConfirm} onClose={() => setOpenClearConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>⚠️ 確認清空所有供應商資料</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>此操作將永久刪除所有供應商資料，無法復原。</strong>
            <br />
            請確認您已備份相關資料後再繼續。
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            目前共 <strong>{vendors.length}</strong> 筆供應商資料將被刪除。
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label='請輸入「確認清空」以繼續'
            fullWidth
            variant="outlined"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenClearConfirm(false); setConfirmText(''); }}>
            取消
          </Button>
          <Button
            onClick={handleClearAll}
            variant="contained"
            color="error"
            disabled={confirmText !== '確認清空' || loading}
          >
            {loading ? '清空中...' : '確認清空'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorManagement;
