﻿import React, { ReactNode } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, IconButton, Menu, MenuItem, Divider } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import { useAuth } from '../contexts/AuthContext';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AIChatBot from './AIChatBot';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const isSQMVQM = location.pathname.startsWith('/sqm-vqm/') || location.pathname === '/sqm-vqm';
  const isHome = location.pathname === '/';

  const getAppBarColor = () => {
    if (isSQMVQM) return '#1976d2';
    if (isHome) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" sx={{ background: getAppBarColor() }}>
        <Toolbar>
          <Typography sx={{ mr: 2, opacity: 0.8, fontSize: 14 }}>
            {isSQMVQM ? 'SQM/VQM供應商管理' : '供應商管理'}
          </Typography>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', cursor: 'pointer', letterSpacing: 0.2 }}
          >
            廠商評核系統
          </Typography>
          
          <HeaderUser />
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'flex', flex: 1 }}>
        {isSQMVQM && <Navigation />}
        <Container component="main" maxWidth={false} sx={{ flex: 1, width: 'auto', minWidth: 0, overflowX: 'auto', py: 3 }}>
          {children}
        </Container>
      </Box>
      <AIChatBot />
    </Box>
  );
};

export default Layout;

const HeaderUser = () => {
  const { username, role, logout } = useAuth() as any
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)

  const go = (path: string) => { handleClose(); navigate(path) }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ opacity: 0.9, mr: 1 }}>
        {username ? `${username}（${role}）` : '未登入'}
      </Typography>
      {username ? (
        <>
          <IconButton color="inherit" onClick={handleOpen} aria-controls={open ? 'account-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined}>
            <AccountCircle />
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => go('/account/change-password')}>變更密碼</MenuItem>
            {role === 'admin' && (
              <MenuItem onClick={() => go('/admin/users')}>使用者管理</MenuItem>
            )}
            {role === 'admin' && (
              <MenuItem onClick={() => go('/admin/robot')}>機器人後台</MenuItem>
            )}
            {(role === 'admin' || role === 'quality_yearly_editor') && (
              <MenuItem onClick={() => go('/admin/vendors')}>供應商管理</MenuItem>
            )}
            <Divider />
            <MenuItem onClick={() => { handleClose(); logout(); }}>登出</MenuItem>
          </Menu>
        </>
      ) : (
        <MenuItem component={RouterLink} to="/login" sx={{ color: 'inherit' }}>登入</MenuItem>
      )}
    </Box>
  )
}


