﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import { ReportProvider } from './contexts/ReportContext';
import SQMVQMHomePage from './pages/SQMVQMHomePage';
import YearlyReport from './pages/YearlyReport';
import LoginPage from './pages/Login';
import RequireAuth from './components/RequireAuth';
import RequireRole from './components/RequireRole';
import AdminUsers from './pages/AdminUsers';
import MonthlyReport from './pages/MonthlyReport';
import ChangePassword from './pages/ChangePassword';
import VendorManagementPage from './pages/VendorManagementPage';
import RobotAdmin from './pages/RobotAdmin';
import AIChatBot from './components/AIChatBot';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ReportProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={
                <Layout>
                  <Routes>
                    <Route
                      path="/"
                      element={(
                        <RequireAuth>
                          <SQMVQMHomePage />
                        </RequireAuth>
                      )}
                    />
                    <Route
                      path="/sqm-vqm"
                      element={(
                        <RequireAuth>
                          <SQMVQMHomePage />
                        </RequireAuth>
                      )}
                    />
                    <Route
                      path="/sqm-vqm/yearly/:year"
                      element={(
                        <RequireAuth>
                          <YearlyReport />
                        </RequireAuth>
                      )}
                    />
                    <Route
                      path="/sqm-vqm/quarterly/:year/:quarter"
                      element={(
                        <RequireAuth>
                          <MonthlyReport />
                        </RequireAuth>
                      )}
                    />
                    <Route
                      path="/admin/users"
                      element={(
                        <RequireRole roles={['admin']}>
                          <AdminUsers />
                        </RequireRole>
                      )}
                    />
                    <Route
                      path="/admin/robot"
                      element={(
                        <RequireRole roles={['admin']}>
                          <RobotAdmin />
                        </RequireRole>
                      )}
                    />
                    <Route
                      path="/admin/vendors"
                      element={(
                        <RequireRole roles={['admin', 'quality_yearly_editor']}>
                          <VendorManagementPage />
                        </RequireRole>
                      )}
                    />
                    <Route
                      path="/account/change-password"
                      element={(
                        <RequireAuth>
                          <ChangePassword />
                        </RequireAuth>
                      )}
                    />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </Router>
        </ReportProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
