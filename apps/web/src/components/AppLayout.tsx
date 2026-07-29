import {
  BarChartOutlined,
  FormOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Typography } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

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

  const menuItems = useMemo(
    () => [
      { key: '/dashboard', icon: <BarChartOutlined />, label: '分析仪表板' },
      { key: '/evaluation', icon: <FormOutlined />, label: '季度评比' },
    ],
    [],
  );

  const selectedKey = menuItems.find((m) => loc.pathname.startsWith(m.key))?.key ?? '/dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={216} breakpoint="lg" collapsedWidth={0}>
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
          items={menuItems}
          onClick={({ key }) => nav(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 24px',
            borderBottom: '1px solid #eef0f3',
          }}
        >
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '登出', onClick: logout }],
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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
