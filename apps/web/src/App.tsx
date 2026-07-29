import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { Placeholder } from './components/Placeholder';
import { ScoringConfigPage } from './features/admin/ScoringConfigPage';
import { SupplierManagement } from './features/admin/SupplierManagement';
import { UserManagement } from './features/admin/UserManagement';
import { LoginPage } from './features/auth/LoginPage';
import { BackgroundPage } from './features/background/BackgroundPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AnnualEvaluation } from './features/evaluation/AnnualEvaluation';
import { EvaluationWorkbench } from './features/evaluation/EvaluationWorkbench';
import { OsatPage } from './features/osat/OsatPage';
import { SourcingPage } from './features/sourcing/SourcingPage';

const ADMIN = ['admin', 'quality_yearly_editor'];

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
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* SQM/VQM 模組 */}
        <Route path="/sqmvqm/quarterly" element={<EvaluationWorkbench />} />
        <Route path="/sqmvqm/yearly" element={<AnnualEvaluation />} />

        {/* OSAT 模組（读现有表，资料空则优雅显示） */}
        <Route path="/osat" element={<OsatPage />} />

        {/* 擴充模組 */}
        <Route path="/background" element={<BackgroundPage />} />
        <Route path="/sourcing" element={<SourcingPage />} />
        <Route path="/ai" element={<Placeholder title="AI 问答助手" description="自然语言查询评比数据；未来支援 AI 供应商推荐排名。" />} />

        {/* 系统管理 */}
        <Route
          path="/admin/suppliers"
          element={
            <RequireRole roles={ADMIN}>
              <SupplierManagement />
            </RequireRole>
          }
        />
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

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
