import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { ScoringConfigPage } from './features/admin/ScoringConfigPage';
import { UserManagement } from './features/admin/UserManagement';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AnnualEvaluation } from './features/evaluation/AnnualEvaluation';
import { QuarterlyPage } from './features/evaluation/QuarterlyPage';
import { HomePage } from './features/home/HomePage';
import { OsatPage } from './features/osat/OsatPage';
import { SourcingPage } from './features/sourcing/SourcingPage';
import { SupplierDirectory } from './features/suppliers/SupplierDirectory';
import { SupplierProfile } from './features/suppliers/SupplierProfile';

const ADMIN = ['admin', 'quality_yearly_editor'];
// 评比人员（可录入）：viewer 看报告者除外
const WORKERS = ['admin', 'quality_yearly_editor', 'engineer', 'purchase_editor'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* 供应商情报（目录 + 360 档案） */}
        <Route path="/suppliers" element={<SupplierDirectory />} />
        <Route path="/suppliers/:id" element={<SupplierProfile />} />

        {/* 评比模組（viewer 看报告者不可进入） */}
        <Route path="/sqmvqm/quarterly" element={<RequireRole roles={WORKERS}><QuarterlyPage /></RequireRole>} />
        <Route path="/sqmvqm/yearly" element={<RequireRole roles={WORKERS}><AnnualEvaluation /></RequireRole>} />
        <Route path="/osat" element={<RequireRole roles={WORKERS}><OsatPage /></RequireRole>} />
        <Route path="/sourcing" element={<RequireRole roles={WORKERS}><SourcingPage /></RequireRole>} />

        {/* 系统管理 */}
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={['admin']}>
              <UserManagement />
            </RequireRole>
          }
        />
        <Route
          path="/admin/scoring"
          element={
            <RequireRole roles={ADMIN}>
              <ScoringConfigPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
