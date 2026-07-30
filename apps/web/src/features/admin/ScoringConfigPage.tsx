import { ReloadOutlined, SaveOutlined, SlidersOutlined } from '@ant-design/icons';
import type { ScoringConfig } from '@wx/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Alert, Button, Card, Col, InputNumber, Row, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { scoringConfigApi } from '../../api';
import { PageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api';

const Num = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <Space direction="vertical" size={2}>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {label}
    </Typography.Text>
    <InputNumber value={value} onChange={(v) => onChange(v ?? 0)} style={{ width: 130 }} />
  </Space>
);

export function ScoringConfigPage() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<ScoringConfig | null>(null);

  const query = useQuery({ queryKey: ['scoring-config'], queryFn: scoringConfigApi.get });
  useEffect(() => {
    if (query.data) setCfg(structuredClone(query.data.config));
  }, [query.data]);

  const patch = (fn: (c: ScoringConfig) => void) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: () => scoringConfigApi.save(cfg!),
    onSuccess: () => {
      message.success('评分设定已储存，将套用于后续计算');
      qc.invalidateQueries();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const resetMut = useMutation({
    mutationFn: () => scoringConfigApi.reset(),
    onSuccess: (c) => {
      setCfg(structuredClone(c));
      message.success('已还原为预设规则');
      qc.invalidateQueries();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  if (!cfg) return null;

  // ── 各分群内容 ──
  const qualityTab = (
    <Row gutter={16}>
      <Col xs={24} lg={12}>
        <Card title="CAR 评分（满分 40，扣分制）" variant="borderless">
          <Space wrap size={16}>
            <Num label="基数" value={cfg.carBase} onChange={(v) => patch((c) => (c.carBase = v))} />
            <Num label="外部客诉 ×" value={cfg.carCoeff.externalCAR} onChange={(v) => patch((c) => (c.carCoeff.externalCAR = v))} />
            <Num label="产线CAR ×" value={cfg.carCoeff.arr} onChange={(v) => patch((c) => (c.carCoeff.arr = v))} />
            <Num label="延迟回复 ×" value={cfg.carCoeff.untimelyResponseCCR} onChange={(v) => patch((c) => (c.carCoeff.untimelyResponseCCR = v))} />
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="LAR 批退良率阶梯（满分 30）" variant="borderless" styles={{ body: { padding: 0 } }}>
          <Table
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={false}
            dataSource={cfg.larLadder}
            columns={[
              { title: 'LAR% ≥', render: (_, _r, i) => <InputNumber value={cfg.larLadder[i]!.min} onChange={(v) => patch((c) => (c.larLadder[i]!.min = v ?? 0))} /> },
              { title: '得分', render: (_, _r, i) => <InputNumber value={cfg.larLadder[i]!.score} onChange={(v) => patch((c) => (c.larLadder[i]!.score = v ?? 0))} /> },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );

  const deliveryTab = (
    <Row gutter={16}>
      <Col xs={24} lg={12}>
        <Card title="采购评核（满分 20，扣分制）" variant="borderless">
          <Space wrap size={16}>
            <Num label="基数" value={cfg.purchaseBase} onChange={(v) => patch((c) => (c.purchaseBase = v))} />
            <Num label="停线每次扣" value={cfg.productionLineStopCoeff} onChange={(v) => patch((c) => (c.productionLineStopCoeff = v))} />
            <Num label="达交率<最低门槛扣" value={cfg.deliveryDeductionBelow} onChange={(v) => patch((c) => (c.deliveryDeductionBelow = v))} />
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="达交率扣分阶梯" variant="borderless" styles={{ body: { padding: 0 } }}>
          <Table
            rowKey={(_, i) => String(i)}
            size="small"
            pagination={false}
            dataSource={cfg.deliveryDeductionLadder}
            columns={[
              { title: '达交率% ≥', render: (_, _r, i) => <InputNumber value={cfg.deliveryDeductionLadder[i]!.min} onChange={(v) => patch((c) => (c.deliveryDeductionLadder[i]!.min = v ?? 0))} /> },
              { title: '扣分', render: (_, _r, i) => <InputNumber value={cfg.deliveryDeductionLadder[i]!.deduction} onChange={(v) => patch((c) => (c.deliveryDeductionLadder[i]!.deduction = v ?? 0))} /> },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );

  const gradeTab = (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={16}>
        {(['nonAU', 'AU'] as const).map((profile) => (
          <Col xs={24} lg={12} key={profile}>
            <Card title={`等级门槛（${profile === 'AU' ? 'AU 供应商，较严' : '一般供应商'}）`} variant="borderless">
              <Space wrap size={16}>
                {cfg.gradeThresholds[profile].map((t, i) => (
                  <Num key={t.grade} label={`${t.grade} 级 >`} value={t.gt} onChange={(v) => patch((c) => (c.gradeThresholds[profile][i]!.gt = v))} />
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="降级规则门槛" variant="borderless">
        <Space wrap size={16}>
          <Num label="品质分 <" value={cfg.downgradeQcThreshold} onChange={(v) => patch((c) => (c.downgradeQcThreshold = v))} />
          <Num label="交期分 <" value={cfg.downgradePurchaseThreshold} onChange={(v) => patch((c) => (c.downgradePurchaseThreshold = v))} />
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          A/B 级：品质或交期低于门槛即降一级；C 级：品质且交期皆低于门槛才降级。
        </Typography.Paragraph>
      </Card>
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<SlidersOutlined />}
        title="评分设定"
        subtitle="调整各维度权重与等级门槛，套用于后续计算"
        extra={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => resetMut.mutate()} loading={resetMut.isPending}>
              还原预设
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
              储存
            </Button>
          </>
        }
      />

      <Alert
        type="info"
        showIcon
        message={
          <Space wrap size={4}>
            综合评分 =
            <Tag color="blue">品质 满分 70</Tag>+
            <Tag color="green">交期 满分 20</Tag>+
            <Tag>服务 满分 10（人工）</Tag>→ 等级 A~E。调整后套用于「后续」计算，预设值与现行系统一致。
          </Space>
        }
      />

      <Card variant="borderless" styles={{ body: { paddingTop: 8 } }}>
        <Tabs
          defaultActiveKey="quality"
          items={[
            { key: 'quality', label: '① 品质（70）', children: qualityTab },
            { key: 'delivery', label: '② 交期（20）', children: deliveryTab },
            { key: 'grade', label: '③ 等级与降级', children: gradeTab },
          ]}
        />
      </Card>
    </Space>
  );
}
