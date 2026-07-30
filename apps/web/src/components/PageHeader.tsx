import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';

/** 统一的页面标题列（图标 + 标题 + 副标题 + 右侧动作） */
export function PageHeader({
  icon,
  title,
  subtitle,
  extra,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <Space align="center" size={12}>
        {icon && <span style={{ fontSize: 22, color: '#1a56db', display: 'flex' }}>{icon}</span>}
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {subtitle}
            </Typography.Text>
          )}
        </div>
      </Space>
      {extra && <Space wrap>{extra}</Space>}
    </div>
  );
}
