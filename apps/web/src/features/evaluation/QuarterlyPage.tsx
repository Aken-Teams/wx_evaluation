import { Space, Tabs } from 'antd';
import { FileSearch, LayoutGrid, SquarePen, UserRound } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { BackgroundPage } from '../background/BackgroundPage';
import { EvaluationWorkbench } from './EvaluationWorkbench';
import { SingleEvaluation } from './SingleEvaluation';

const tabLabel = (icon: React.ReactNode, text: string) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    {icon}
    {text}
  </span>
);

export function QuarterlyPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader icon={<SquarePen size={22} />} title="季度评比" subtitle="单家专业评比 / 批量录入 / 批量背调" />
      <Tabs
        defaultActiveKey="single"
        items={[
          { key: 'single', label: tabLabel(<UserRound size={15} />, '单家评比'), children: <SingleEvaluation /> },
          { key: 'batch', label: tabLabel(<LayoutGrid size={15} />, '批量录入'), children: <EvaluationWorkbench /> },
          { key: 'background', label: tabLabel(<FileSearch size={15} />, '批量背调'), children: <BackgroundPage /> },
        ]}
      />
    </Space>
  );
}
