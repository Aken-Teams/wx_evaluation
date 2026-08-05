import {
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Home,
  KeyRound,
  LogOut,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  SquarePen,
  Users,
} from 'lucide-react';
import { Avatar, Dropdown, Layout, Menu, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AiAssistant } from './AiAssistant';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ErrorBoundary } from './ErrorBoundary';

const { Sider, Header, Content } = Layout;

const roleLabel: Record<string, string> = {
  admin: '系统管理员',
  quality_yearly_editor: '品质编辑',
  engineer: '工程师',
  purchase_editor: '采购编辑',
  viewer: '主管/检视',
};

export function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'quality_yearly_editor';
  const isViewer = user?.role === 'viewer';
  const [pwOpen, setPwOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem('sidebar-collapsed') === '1');
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      return !c;
    });

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: '/home', icon: <Home size={18} />, label: '首页' },
      { key: '/suppliers', icon: <Building2 size={18} />, label: '供应商情报' },
      { key: '/dashboard', icon: <BarChart3 size={18} />, label: '分析仪表板' },
      // 评比 / 比价：仅评比人员与管理员，看报告的（viewer）不显示
      ...(!isViewer
        ? [
            {
              key: 'eval',
              icon: <ClipboardList size={18} />,
              label: '评比',
              children: [
                { key: '/sqmvqm/quarterly', icon: <SquarePen size={18} />, label: '季度评比' },
                { key: '/sqmvqm/yearly', icon: <CalendarCheck size={18} />, label: '年度评鉴' },
                { key: '/osat', icon: <Network size={18} />, label: 'OSAT 评比' },
              ],
            },
            { key: '/sourcing', icon: <Scale size={18} />, label: '比价寻源' },
          ]
        : []),
      ...(isAdmin
        ? [
            {
              key: 'admin',
              icon: <Settings size={18} />,
              label: '系统管理',
              children: [
                { key: '/admin/users', icon: <Users size={18} />, label: '帐号管理' },
                { key: '/admin/scoring', icon: <SlidersHorizontal size={18} />, label: '评分设定' },
              ],
            },
          ]
        : []),
    ],
    [isAdmin],
  );

  // 依路徑找出選中的葉節點
  const leafKeys = [
    '/home',
    '/dashboard',
    '/suppliers',
    '/sqmvqm/quarterly',
    '/sqmvqm/yearly',
    '/osat',
    '/sourcing',
    '/admin/users',
    '/admin/scoring',
  ];
  const selectedKey = leafKeys.find((k) => loc.pathname.startsWith(k)) ?? '/home';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        width={220}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{ position: 'fixed', insetInlineStart: 0, top: 0, bottom: 0, height: '100vh', overflow: 'hidden', zIndex: 11, display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? 0 : '0 12px 0 18px',
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={19} color="#fff" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>供应商评比</span>
            </div>
          )}
          <Tooltip title={collapsed ? '展开侧栏' : '收合侧栏'} placement="right">
            <div
              onClick={toggleCollapsed}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                color: '#c3ccd9',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={18} />}
            </div>
          </Tooltip>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Menu
            theme="dark"
            mode="inline"
            style={{ marginTop: 10, borderInlineEnd: 'none' }}
            selectedKeys={[selectedKey]}
            defaultOpenKeys={['eval', 'admin']}
            items={menuItems}
            onClick={({ key }) => {
              if (key.startsWith('/')) nav(key);
            }}
          />
        </div>
      </Sider>
      <Layout style={{ marginInlineStart: collapsed ? 72 : 220, transition: 'margin-inline-start 0.2s' }}>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            borderBottom: '1px solid #eef0f3',
          }}
        >
          <Dropdown
            menu={{
              items: [
                { key: 'changepw', icon: <KeyRound size={15} />, label: '修改密码', onClick: () => setPwOpen(true) },
                { type: 'divider' },
                { key: 'logout', icon: <LogOut size={15} />, label: '登出', onClick: logout },
              ],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1a56db' }} size="small">
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong>{user?.username}</Typography.Text>
                <div style={{ fontSize: 12, color: '#8a94a6' }}>
                  {roleLabel[user?.role ?? ''] ?? user?.role}
                </div>
              </div>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24 }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
      <AiAssistant />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Layout>
  );
}
