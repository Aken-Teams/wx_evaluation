import { useState } from 'react'
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Alert, 
  Stack, 
  Container,
  Avatar,
  InputAdornment,
  IconButton,
  Divider,
  Fade,
  Slide
} from '@mui/material'
import { 
  Lock as LockIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const LoginPage = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/')
    } catch (err) {
      setError('帳號或密碼錯誤')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 背景裝飾元素 */}
      <Box
        sx={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          animation: 'float 20s ease-in-out infinite'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-30%',
          right: '-30%',
          width: '160%',
          height: '160%',
          background: 'radial-gradient(circle, rgba(255,165,0,0.1) 0%, transparent 70%)',
          animation: 'float 15s ease-in-out infinite reverse'
        }}
      />

      <Container maxWidth="sm">
        <Slide direction="up" in={true} timeout={800}>
          <Paper 
            elevation={24}
            sx={{ 
              p: 6, 
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* 頂部裝飾線 */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: 'linear-gradient(90deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%)'
              }}
            />

            <Fade in={true} timeout={1200}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    mx: 'auto',
                    mb: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  <LockIcon sx={{ fontSize: 40 }} />
                </Avatar>
                
                <Typography 
                  variant="h4" 
                  component="h1" 
                  gutterBottom
                  sx={{ 
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1
                  }}
                >
                  廠商評核系統
                </Typography>
                
                <Typography 
                  variant="body1" 
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  請登入您的帳號以繼續使用系統
                </Typography>

                {/* 系統功能展示 */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <BusinessIcon sx={{ color: '#667eea', fontSize: 32, mb: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      SQM/VQM管理
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <AssessmentIcon sx={{ color: '#764ba2', fontSize: 32, mb: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      OSAT管理
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Fade>

            {error && (
              <Fade in={true} timeout={300}>
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    borderRadius: 2,
                    background: 'rgba(244, 67, 54, 0.1)',
                    border: '1px solid rgba(244, 67, 54, 0.2)'
                  }}
                >
                  {error}
                </Alert>
              </Fade>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  label="帳號"
                  size="medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: '#667eea' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: '#667eea',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea',
                      },
                    },
                  }}
                />
                
                <TextField
                  label="密碼"
                  type={showPassword ? 'text' : 'password'}
                  size="medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: '#667eea' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          sx={{ color: '#667eea' }}
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: '#667eea',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea',
                      },
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  size="large"
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                    boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #e55a2b 0%, #e0851a 100%)',
                      boxShadow: '0 12px 40px rgba(255, 107, 53, 0.4)',
                      transform: 'translateY(-2px)',
                    },
                    '&:disabled': {
                      background: 'linear-gradient(135deg, #ccc 0%, #999 100%)',
                      boxShadow: 'none',
                      transform: 'none',
                    },
                    transition: 'all 0.3s ease',
                    fontWeight: 600,
                    fontSize: '1.1rem'
                  }}
                >
                  {loading ? '登入中...' : '登入系統'}
                </Button>
              </Stack>
            </form>


          </Paper>
        </Slide>
      </Container>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
        `}
      </style>
    </Box>
  )
}

export default LoginPage


