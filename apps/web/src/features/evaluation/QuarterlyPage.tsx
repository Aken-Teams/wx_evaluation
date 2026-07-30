import { AppstoreOutlined, SolutionOutlined, UserOutlined } from '@ant-design/icons';
import { Tabs } from 'antd';
import { BackgroundPage } from '../background/BackgroundPage';
import { EvaluationWorkbench } from './EvaluationWorkbench';
import { SingleEvaluation } from './SingleEvaluation';

export function QuarterlyPage() {
  return (
    <Tabs
      defaultActiveKey="single"
      items={[
        { key: 'single', label: <span><UserOutlined /> 单家评比</span>, children: <SingleEvaluation /> },
        { key: 'batch', label: <span><AppstoreOutlined /> 批量录入</span>, children: <EvaluationWorkbench /> },
        { key: 'background', label: <span><SolutionOutlined /> 批量背调</span>, children: <BackgroundPage /> },
      ]}
    />
  );
}
