import { ToolOutlined } from '@ant-design/icons';
import { Card, Result, Tag } from 'antd';
import type { ReactNode } from 'react';

/** 尚未建置 / 未啟用模組的佔位頁 —— 讓模組結構在系統中可見。 */
export function Placeholder({
  title,
  status = '建置中',
  description,
}: {
  title: string;
  status?: string;
  description?: ReactNode;
}) {
  return (
    <Card variant="borderless">
      <Result
        icon={<ToolOutlined style={{ color: '#1a56db' }} />}
        title={
          <span>
            {title} <Tag color="processing">{status}</Tag>
          </span>
        }
        subTitle={description ?? '此模块已纳入重建路线，功能开发中。'}
      />
    </Card>
  );
}
