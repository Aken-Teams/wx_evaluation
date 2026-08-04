import { Card } from 'antd';
import type { ReactNode } from 'react';

/** 统一的 KPI 统计卡：图标色块 + 大数字 + 标题 + 可选页脚。 */
export function StatCard({
  title,
  value,
  icon,
  color = '#2563eb',
  suffix,
  footer,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  color?: string;
  suffix?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card variant="borderless" styles={{ body: { padding: 18 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {value}
            {suffix && <span style={{ fontSize: 14, color: '#94a3b8', marginLeft: 4, fontWeight: 500 }}>{suffix}</span>}
          </div>
          {footer && <div style={{ marginTop: 8 }}>{footer}</div>}
        </div>
        {icon && (
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${color}15`,
              color,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
