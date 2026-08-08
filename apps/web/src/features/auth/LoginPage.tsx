import { CrownOutlined, EditOutlined, EyeOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Divider, Form, Input, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../lib/api';

const QUICK = [
  { label: '管理者', username: 'admin', password: 'admin123', icon: <CrownOutlined />, color: '#1a56db' },
  { label: '评分者', username: 'evaluator', password: 'eval123', icon: <EditOutlined />, color: '#0e9f6e' },
  { label: '检视者', username: 'P170014', password: 'viewer123', icon: <EyeOutlined />, color: '#e3a008' },
];

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [loading, setLoading] = useState(false);
  const from = (loc.state as { from?: string })?.from ?? '/home';

  const doLogin = async (username: string, password: string) => {
    setLoading(true);
    try {
      await login(username, password);
      nav(from, { replace: true });
    } catch (e) {
      message.error(apiErrorMessage(e, '登入失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }} variant="borderless">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 0 }}>
            供应商评比系统
          </Typography.Title>
          <Typography.Text type="secondary">Supplier Assessment Platform</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={(v) => doLogin(v.username, v.password)} requiredMark={false} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登 入
          </Button>
        </Form>

        <Divider plain style={{ margin: '20px 0 12px', color: '#94a3b8', fontSize: 12 }}>
          快速登入（示范帐号）
        </Divider>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {QUICK.map((q) => (
            <Button
              key={q.username}
              icon={q.icon}
              style={{ flex: 1, color: q.color, borderColor: q.color }}
              disabled={loading}
              onClick={() => doLogin(q.username, q.password)}
            >
              {q.label}
            </Button>
          ))}
        </Space>
      </Card>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
        Powered by 2026 @{' '}
        <a
          href="https://www.zh-aoi.com/"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          智合科技
        </a>
      </div>
    </div>
  );
}
