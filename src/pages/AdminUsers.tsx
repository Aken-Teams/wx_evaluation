import { useEffect, useState } from 'react'
import { Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Alert } from '@mui/material'
import { Key as KeyIcon } from '@mui/icons-material'
import api, { resetUserPassword } from '../services/api'

type UserRow = { id: number; username: string; role: string; enabled: boolean }

const AdminUsers = () => {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null)
  const [form, setForm] = useState({ username: '', password: '', role: '' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<UserRow[]>('/admin/users')
      setRows(res.data)
    } catch (e) {
      setError('讀取使用者清單失敗')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // 確保對話框打開時表單是空的
  useEffect(() => {
    if (open) {
      setForm({ username: '', password: '', role: '' });
      setError(null);
    }
  }, [open])

  const isValid = form.username.trim().length > 0 && form.password.length >= 6 && form.role && ['viewer','quality_yearly_editor','purchase_editor','admin'].includes(form.role)

  const handleCreate = async () => {
    if (!isValid) { setError('請填寫帳號，密碼至少 6 碼，並選擇角色'); return }
    try {
      await api.post('/admin/users', form)
      setOpen(false)
      setForm({ username: '', password: '', role: '' })
      load()
    } catch (e: any) {
      const code = e?.response?.data?.error
      if (code === 'username_taken') setError('帳號已存在，請使用其他帳號')
      else if (code === 'invalid_payload') setError('欄位格式不正確，請確認密碼至少 6 碼且角色有效')
      else setError('建立使用者失敗')
    }
  }

  const handleResetPassword = async (userId: number, username: string) => {
    try {
      console.log(`開始重置密碼: 用戶ID=${userId}, 用戶名=${username}`)
      console.log(`API URL: /admin/users/${userId}/reset-password`)
      
      const res = await resetUserPassword(userId)
      console.log('重置密碼成功:', res.data)
      
      setResetResult({
        username: username,
        tempPassword: res.data.tempPassword
      })
      setResetDialogOpen(true)
    } catch (e: any) {
      console.error('重置密碼錯誤:', e)
      console.error('錯誤詳情:', {
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
        message: e?.message
      })
      
      const code = e?.response?.data?.error
      if (code === 'forbidden') setError('權限不足，只有管理員可以重置密碼')
      else if (code === 'unauthorized') setError('登入已過期，請重新登入')
      else if (code === 'user_not_found') setError('用戶不存在')
      else if (!e?.response) setError('無法連線到伺服器，請確認後端是否啟動')
      else setError(`重置密碼失敗: ${e?.response?.status} ${e?.response?.statusText} - ${e?.response?.data?.error || e?.response?.data?.details || '未知錯誤'}`)
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>使用者管理</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Button 
        variant="contained" 
        onClick={() => {
          setForm({ username: '', password: '', role: '' });
          setError(null);
          setOpen(true);
        }} 
        sx={{ mb: 2 }}
      >
        新增使用者
      </Button>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>帳號</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>啟用</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.username}</TableCell>
                <TableCell>{r.role}</TableCell>
                <TableCell>{r.enabled ? '是' : '否'}</TableCell>
                <TableCell>
                  <IconButton 
                    size="small" 
                    onClick={() => handleResetPassword(r.id, r.username)}
                    title="重置密碼"
                  >
                    <KeyIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog 
        key={open ? 'open' : 'closed'}
        open={open} 
        onClose={() => {
          setOpen(false);
          setForm({ username: '', password: '', role: '' });
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            fontSize: '1.5rem',
            fontWeight: 'bold',
            pb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          新增使用者
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 帳號欄位 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.primary' }}>
                帳號 *
              </Typography>
              <TextField 
                value={form.username} 
                onChange={(e) => setForm({ ...form, username: e.target.value })} 
                fullWidth 
                variant="outlined"
                size="medium"
                error={form.username.trim().length === 0}
                autoComplete="off"
                autoFocus
                inputProps={{
                  autoComplete: 'off',
                  spellCheck: false
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1rem'
                  }
                }}
              />
              {form.username.trim().length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  請輸入使用者帳號
                </Typography>
              )}
              {form.username.trim().length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  帳號將用於登入系統
                </Typography>
              )}
            </Box>

            {/* 密碼欄位 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.primary' }}>
                密碼 *
              </Typography>
              <TextField 
                type="password" 
                value={form.password} 
                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                fullWidth 
                variant="outlined"
                size="medium"
                error={form.password.length > 0 && form.password.length < 6}
                autoComplete="new-password"
                inputProps={{
                  autoComplete: 'new-password',
                  spellCheck: false
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '1rem'
                  }
                }}
              />
              {form.password.length === 0 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  請輸入密碼
                </Typography>
              )}
              {form.password.length > 0 && form.password.length < 6 && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  密碼至少需要6個字元
                </Typography>
              )}
              {form.password.length >= 6 && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                  密碼強度良好
                </Typography>
              )}
            </Box>

            {/* 角色選擇 */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.primary' }}>
                角色 *
              </Typography>
              <FormControl fullWidth size="medium" variant="outlined">
                <Select 
                  value={form.role} 
                  onChange={(e) => setForm({ ...form, role: e.target.value as string })}
                  displayEmpty
                  sx={{
                    fontSize: '1rem',
                    '& .MuiSelect-select': {
                      fontSize: '1rem',
                      padding: '16.5px 14px'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: form.role ? 'rgba(0, 0, 0, 0.23)' : 'rgba(0, 0, 0, 0.23)'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(0, 0, 0, 0.87)'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      borderWidth: 2
                    }
                  }}
                >
                  <MenuItem value="" disabled>
                    <Typography variant="body2" color="text.secondary">
                      請選擇使用者角色
                    </Typography>
                  </MenuItem>
                  <MenuItem value="viewer">
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '0.95rem' }}>
                        一般使用者
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        僅可查看報表，無法編輯
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="quality_yearly_editor">
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '0.95rem' }}>
                        品質年度編輯者
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        可編輯品質報表和年度評核
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="purchase_editor">
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '0.95rem' }}>
                        採購編輯者
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        可編輯採購相關報表
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="admin">
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'primary.main', fontSize: '0.95rem' }}>
                        系統管理員
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        擁有所有權限，可管理使用者
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              {!form.role && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  請選擇使用者角色
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions 
          sx={{ 
            px: 3, 
            py: 2, 
            borderTop: '1px solid',
            borderColor: 'divider',
            gap: 1
          }}
        >
          <Button 
            onClick={() => {
              setOpen(false);
              setForm({ username: '', password: '', role: '' });
              setError(null);
            }}
            variant="outlined"
            size="large"
            sx={{ minWidth: 100 }}
          >
            取消
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreate} 
            disabled={!isValid}
            size="large"
            sx={{ minWidth: 100 }}
          >
            建立使用者
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>密碼重置成功</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {resetResult && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                用戶 <strong>{resetResult.username}</strong> 的密碼已重置
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                臨時密碼：
              </Typography>
              <TextField
                value={resetResult.tempPassword}
                fullWidth
                variant="outlined"
                size="small"
                InputProps={{
                  readOnly: true,
                  sx: { 
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    backgroundColor: '#f5f5f5'
                  }
                }}
                sx={{ mb: 2 }}
              />
              <Alert severity="warning">
                請將此臨時密碼告知用戶，並要求用戶立即登入後修改密碼
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>確定</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AdminUsers


