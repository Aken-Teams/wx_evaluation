import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { Placeholder } from './components/Placeholder';
import { ScoringConfigPage } from './features/admin/ScoringConfigPage';
import { SupplierManagement } from './features/admin/SupplierManagement';
import { UserManagement } from './features/admin/UserManagement';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EvaluationWorkbench } from './features/evaluation/EvaluationWorkbench';

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
        <Route
          path="/sqmvqm/yearly"
          element={<Placeholder title="SQM/VQM · 年度评鉴" description="年度稽核输入（VDA/QSA/QPA/HSF）、年度分数与下年度稽核类型。重建中。" />}
        />

        {/* OSAT 模組（结构先露出） */}
        <Route
          path="/osat"
          element={
            <Placeholder
              title="OSAT 评比（岡山 / 苏州）"
              status="未启用"
              description="原系统的 OSAT 月度评比模块。目前数据库中 OSAT 资料为空、无锡端是否需要待确认；结构先保留于系统中。"
            />
          }
        />

        {/* 擴充模組 */}
        <Route
          path="/background"
          element={<Placeholder title="背调分析" description="供应商背景调查（拖欠货款 / 客诉频次 / 8D 品质异常 / 配合度）。重建路线中的核心扩充。" />}
        />
        <Route
          path="/sourcing"
          element={<Placeholder title="比价寻源" description="多供应商报价 / 议价 / 账期 / 级距单价 并排比较与综合评估（依比价信息表）。" />}
        />
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
