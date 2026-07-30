import { ReloadOutlined, SaveOutlined, SlidersOutlined } from '@ant-design/icons';
import type { ScoringConfig } from '@wx/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Alert, Button, Card, Col, InputNumber, Row, Space, Table, Typography } from 'antd';
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
        message="调整后将套用于「后续」的评分计算（仪表板 / 工作台即时重算）。预设值与现行系统完全一致。"
      />

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="品质 · CAR 评分（满分 40）" variant="borderless">
            <Space wrap size={16}>
              <Num label="基数" value={cfg.carBase} onChange={(v) => patch((c) => (c.carBase = v))} />
              <Num label="外部客诉 ×" value={cfg.carCoeff.externalCAR} onChange={(v) => patch((c) => (c.carCoeff.externalCAR = v))} />
              <Num label="产线CAR ×" value={cfg.carCoeff.arr} onChange={(v) => patch((c) => (c.carCoeff.arr = v))} />
              <Num label="延迟回复 ×" value={cfg.carCoeff.untimelyResponseCCR} onChange={(v) => patch((c) => (c.carCoeff.untimelyResponseCCR = v))} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="交期 · 采购评核（满分 20）" variant="borderless">
            <Space wrap size={16}>
              <Num label="基数" value={cfg.purchaseBase} onChange={(v) => patch((c) => (c.purchaseBase = v))} />
              <Num label="停线每次扣" value={cfg.productionLineStopCoeff} onChange={(v) => patch((c) => (c.productionLineStopCoeff = v))} />
              <Num label="达交率<最低门槛扣" value={cfg.deliveryDeductionBelow} onChange={(v) => patch((c) => (c.deliveryDeductionBelow = v))} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="LAR 批退良率阶梯（满分 30）" variant="borderless" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={false}
              dataSource={cfg.larLadder}
              columns={[
                {
                  title: 'LAR% ≥',
                  render: (_, _r, i) => (
                    <InputNumber value={cfg.larLadder[i]!.min} onChange={(v) => patch((c) => (c.larLadder[i]!.min = v ?? 0))} />
                  ),
                },
                {
                  title: '得分',
                  render: (_, _r, i) => (
                    <InputNumber value={cfg.larLadder[i]!.score} onChange={(v) => patch((c) => (c.larLadder[i]!.score = v ?? 0))} />
                  ),
                },
              ]}
            />
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
                {
                  title: '达交率% ≥',
                  render: (_, _r, i) => (
                    <InputNumber
                      value={cfg.deliveryDeductionLadder[i]!.min}
                      onChange={(v) => patch((c) => (c.deliveryDeductionLadder[i]!.min = v ?? 0))}
                    />
                  ),
                },
                {
                  title: '扣分',
                  render: (_, _r, i) => (
                    <InputNumber
                      value={cfg.deliveryDeductionLadder[i]!.deduction}
                      onChange={(v) => patch((c) => (c.deliveryDeductionLadder[i]!.deduction = v ?? 0))}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {(['nonAU', 'AU'] as const).map((profile) => (
          <Col xs={24} lg={12} key={profile}>
            <Card title={`等级门槛（${profile === 'AU' ? 'AU 供应商，较严' : '一般供应商'}）`} variant="borderless">
              <Space wrap size={16}>
                {cfg.gradeThresholds[profile].map((t, i) => (
                  <Num
                    key={t.grade}
                    label={`${t.grade} 级 >`}
                    value={t.gt}
                    onChange={(v) => patch((c) => (c.gradeThresholds[profile][i]!.gt = v))}
                  />
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
      </Card>
    </Space>
  );
}
