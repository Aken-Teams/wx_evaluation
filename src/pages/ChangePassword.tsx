import { useState } from 'react'
import { Box, Button, TextField, Typography, Alert } from '@mui/material'
import { changePassword } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const ChangePassword = () => {
  const { token } = useAuth() as any
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword

  const onSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await changePassword(
        { currentPassword, newPassword }
      ).then(() => {})
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      const code = e?.response?.data?.error
      if (code === 'invalid_current_password') setError('目前密碼不正確')
      else if (code === 'password_unchanged') setError('新密碼不可與舊密碼相同')
      else if (code === 'invalid_payload') setError('請確認欄位已正確填寫（新密碼至少 6 碼）')
      else if (code === 'unauthorized') setError('尚未登入或登入已過期，請重新登入')
      else if (!e?.response) setError('無法連線到伺服器，請確認後端是否啟動')
      else setError('變更密碼失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h6" gutterBottom>變更密碼</Typography>
      {success && <Alert severity="success" sx={{ mb: 2 }}>已成功變更密碼</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField
        type="password"
        fullWidth
        label="目前密碼"
        margin="normal"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <TextField
        type="password"
        fullWidth
        label="新密碼（至少 6 碼）"
        margin="normal"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <TextField
        type="password"
        fullWidth
        label="確認新密碼"
        margin="normal"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={confirmPassword.length > 0 && confirmPassword !== newPassword}
        helperText={confirmPassword.length > 0 && confirmPassword !== newPassword ? '兩次輸入的新密碼不一致' : ' '}
      />
      <Button variant="contained" disabled={!canSubmit || loading} onClick={onSubmit} fullWidth sx={{ mt: 1 }}>
        {loading ? '送出中...' : '確認變更'}
      </Button>
    </Box>
  )
}

export default ChangePassword


