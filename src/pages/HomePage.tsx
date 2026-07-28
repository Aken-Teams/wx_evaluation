import { useNavigate } from 'react-router-dom';
import { Typography, Paper, Box, Button, Grid, Card, CardContent, CardActions, Container, Fade, Slide } from '@mui/material';
import { Business as BusinessIcon, Assessment as AssessmentIcon } from '@mui/icons-material';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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

      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Fade in={true} timeout={1000}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography 
              variant="h2" 
              component="h1" 
              gutterBottom 
              sx={{ 
                color: 'white',
                fontWeight: 700,
                mb: 3,
                textShadow: '0 4px 8px rgba(0,0,0,0.3)'
              }}
            >
              廠商評核系統
            </Typography>
            
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                mb: 6, 
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 300
              }}
            >
              請選擇要使用的供應商管理模組
            </Typography>
          </Box>
        </Fade>

        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} md={5}>
            <Slide direction="left" in={true} timeout={1200}>
              <Card 
                sx={{ 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 4,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
                  }
                }}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <BusinessIcon sx={{ color: '#1976d2', fontSize: 80, mb: 3 }} />
                  <Typography 
                    variant="h4" 
                    component="h2" 
                    sx={{ 
                      color: '#1976d2', 
                      mb: 3,
                      fontWeight: 600
                    }}
                  >
                    SQM/VQM 供應商管理
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 4,
                      lineHeight: 1.6,
                      fontSize: '1.1rem'
                    }}
                  >
                    適用於原物料供應商評核，包含品質評鑑、採購評鑑、年度彙整等功能。
                  </Typography>
                  <CardActions sx={{ justifyContent: 'center' }}>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => navigate('/sqm-vqm')}
                      sx={{ 
                        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                        px: 6, 
                        py: 2,
                        borderRadius: 3,
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                          boxShadow: '0 12px 40px rgba(25, 118, 210, 0.4)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      進入 SQM/VQM 系統
                    </Button>
                  </CardActions>
                </CardContent>
              </Card>
            </Slide>
          </Grid>

          <Grid item xs={12} md={5}>
            <Slide direction="right" in={true} timeout={1400}>
              <Card 
                sx={{ 
                  height: '100%', 
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 4,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
                  }
                }}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <AssessmentIcon sx={{ color: '#388e3c', fontSize: 80, mb: 3 }} />
                  <Typography 
                    variant="h4" 
                    component="h2" 
                    sx={{ 
                      color: '#388e3c', 
                      mb: 3,
                      fontWeight: 600
                    }}
                  >
                    OSAT 供應商管理
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 4,
                      lineHeight: 1.6,
                      fontSize: '1.1rem'
                    }}
                  >
                    適用於外包外購封裝供應商評核，，包含品質評鑑、採購評鑑、年度彙整等功能。
                  </Typography>
                  <CardActions sx={{ justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => navigate('/osat')}
                      fullWidth
                      sx={{ 
                        background: 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
                        py: 1.5,
                        borderRadius: 3,
                        fontSize: '1rem',
                        fontWeight: 600,
                        boxShadow: '0 8px 32px rgba(56, 142, 60, 0.3)',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
                          boxShadow: '0 12px 40px rgba(56, 142, 60, 0.4)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      進入 OSAT 系統
                    </Button>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => navigate('/osat/arrival-consolidation')}
                      fullWidth
                      sx={{ 
                        background: 'linear-gradient(135deg, #388e3c 0%, #2e7d32 100%)',
                        py: 1.5,
                        borderRadius: 3,
                        fontSize: '1rem',
                        fontWeight: 600,
                        boxShadow: '0 8px 32px rgba(56, 142, 60, 0.3)',
                        whiteSpace: 'nowrap',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
                          boxShadow: '0 12px 40px rgba(56, 142, 60, 0.4)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      OSAT 到貨明細合併
                    </Button>
                  </CardActions>
                </CardContent>
              </Card>
            </Slide>
          </Grid>
        </Grid>
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
  );
};

export default HomePage;












