import {
  ApartmentOutlined,
  AuditOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DollarOutlined,
  FormOutlined,
  HomeOutlined,
  IdcardOutlined,
  KeyOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SlidersOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Typography } from 'antd';
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

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: '/home', icon: <HomeOutlined />, label: '首页' },
      { key: '/suppliers', icon: <IdcardOutlined />, label: '供应商情报' },
      { key: '/dashboard', icon: <DashboardOutlined />, label: '分析仪表板' },
      // 评比 / 比价：仅评比人员与管理员，看报告的（viewer）不显示
      ...(!isViewer
        ? [
            {
              key: 'eval',
              icon: <AuditOutlined />,
              label: '评比',
              children: [
                { key: '/sqmvqm/quarterly', icon: <FormOutlined />, label: '季度评比' },
                { key: '/sqmvqm/yearly', icon: <CalendarOutlined />, label: '年度评鉴' },
                { key: '/osat', icon: <ApartmentOutlined />, label: 'OSAT 评比' },
              ],
            },
            { key: '/sourcing', icon: <DollarOutlined />, label: '比价寻源' },
          ]
        : []),
      ...(isAdmin
        ? [
            {
              key: 'admin',
              icon: <SettingOutlined />,
              label: '系统管理',
              children: [
                { key: '/admin/users', icon: <TeamOutlined />, label: '帐号管理' },
                { key: '/admin/scoring', icon: <SlidersOutlined />, label: '评分设定' },
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
        style={{ position: 'fixed', insetInlineStart: 0, top: 0, bottom: 0, height: '100vh', overflow: 'auto', zIndex: 11 }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            color: '#fff',
          }}
        >
          <SafetyCertificateOutlined style={{ fontSize: 22, color: '#60a5fa' }} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>供应商评比</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['eval', 'admin']}
          items={menuItems}
          onClick={({ key }) => {
            if (key.startsWith('/')) nav(key);
          }}
        />
      </Sider>
      <Layout style={{ marginInlineStart: 220 }}>
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
                { key: 'changepw', icon: <KeyOutlined />, label: '修改密码', onClick: () => setPwOpen(true) },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: logout },
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
