import { ArrowLeftOutlined, FallOutlined, RiseOutlined, RobotOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Empty, Result, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { askAi } from '../../components/AiAssistant';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import { suppliersApi } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { gradeColor } from '../../theme';
import type { AnnualHistoryPoint } from '../../types';

export function SupplierProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const vendorId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['supplier-profile', vendorId],
    queryFn: () => suppliersApi.profile(vendorId),
    enabled: !!vendorId,
  });

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />;
  if (isError || !data) return <Result status="error" title="无法载入供应商档案" />;

  const { vendor, isAU, current, quarterlyHistory, annualHistory, backgroundChecks, sourcingParticipation } = data;

  const scored = quarterlyHistory.filter((h) => h.assessmentScore != null);
  const trendDelta =
    scored.length >= 2 ? (scored[scored.length - 1]!.assessmentScore ?? 0) - (scored[scored.length - 2]!.assessmentScore ?? 0) : 0;
  const trendText = trendDelta > 0.05 ? '上升' : trendDelta < -0.05 ? '下降' : '持平';
  const latestBg = backgroundChecks[0];
  const bgRisk = latestBg
    ? latestBg.latePaymentCount + latestBg.customerComplaintCount + latestBg.qualityAbnormal8D
    : 0;

  const trendData = quarterlyHistory.map((h) => ({ period: h.period, 综合分: h.assessmentScore }));

  // 规则式综合评估（AI 增强即将上线）
  const summary = [
    current?.grade
      ? `当前等级 ${current.grade}，在 ${current.period} 排名第 ${current.rank}/${current.totalRanked}（综合 ${current.score}）。`
      : '目前尚无本期评分。',
    scored.length ? `近 ${scored.length} 季评分趋势${trendText}${trendDelta ? `（较上季 ${trendDelta > 0 ? '+' : ''}${trendDelta.toFixed(1)}）` : ''}。` : '',
    latestBg ? `背调风险：${bgRisk === 0 ? '正常' : bgRisk <= 2 ? '需关注' : '偏高'}（拖欠${latestBg.latePaymentCount}/客诉${latestBg.customerComplaintCount}/8D ${latestBg.qualityAbnormal8D}）。` : '尚无背调资料。',
    sourcingParticipation.length ? `曾参与 ${sourcingParticipation.length} 次比价${sourcingParticipation.some((s) => s.isBest) ? '，并曾被选为最优。' : '。'}` : '',
  ]
    .filter(Boolean)
    .join('');

  const annualCols = [
    { title: '年度', dataIndex: 'year', width: 90 },
    { title: '月考核均', dataIndex: 'monthlyAssessmentAverage', width: 110, render: (v: number | null) => v ?? '—' },
    { title: '稽核组件', dataIndex: 'auditComponent', width: 100, render: (v: number) => v || '—' },
    { title: '年度分', dataIndex: 'annualScore', width: 100, render: (v: number | null) => <b>{v ?? '—'}</b> },
    { title: '等级', width: 80, render: (_: unknown, r: AnnualHistoryPoint) => <GradeTag grade={r.grade} /> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 顶部：名称 + 类别 + 当前排名 */}
      <Card variant="borderless">
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
          <Space direction="vertical" size={6}>
            <Space size={8} align="center">
              <ArrowLeftOutlined style={{ cursor: 'pointer', color: '#8a94a6' }} onClick={() => nav(-1)} />
              <Typography.Title level={4} style={{ margin: 0 }}>
                {vendor.name}
              </Typography.Title>
              {isAU && <Tag color="geekblue">AU</Tag>}
            </Space>
            <Space size={6} wrap>
              {vendor.supplierCode && <Tag>代码 {vendor.supplierCode}</Tag>}
              {vendor.materialCategory && <Tag color="blue">{vendor.materialCategory}</Tag>}
              {vendor.region && <Tag>{vendor.region}</Tag>}
              {vendor.vendorType && <Tag>{vendor.vendorType}</Tag>}
            </Space>
          </Space>
          {current && (
            <Space size={32}>
              <Statistic title={`当前排名（${current.period}）`} value={current.rank ?? '—'} suffix={`/ ${current.totalRanked}`} />
              <Statistic title="综合分" value={current.score ?? 0} precision={2} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#8a94a6', marginBottom: 6 }}>等级</div>
                <span style={{ fontSize: 24, fontWeight: 700, color: current.grade ? gradeColor[current.grade] : '#999' }}>
                  {current.grade ?? '—'}
                </span>
              </div>
            </Space>
          )}
        </Space>
      </Card>

      {/* AI 综合评估 */}
      <Alert
        type="info"
        showIcon
        icon={<RobotOutlined />}
        message={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <b>综合评估</b>
              <Tag>规则式 · AI 增强</Tag>
            </Space>
            <Button size="small" type="link" icon={<RobotOutlined />} onClick={() => askAi(`请评估供应商「${vendor.name}」的整体表现、排名与风险。`)}>
              问 AI 评估这家
            </Button>
          </Space>
        }
        description={summary}
      />

      <Row gutter={16}>
        {/* 季度趋势 */}
        <Col xs={24} lg={16}>
          <Card title="季度评比趋势" variant="borderless" styles={{ body: { minHeight: 280 } }}>
            {trendData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis domain={[60, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="综合分" stroke="#1a56db" strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="尚无季度评比资料" />
            )}
          </Card>
        </Col>
        {/* 最新构面 */}
        <Col xs={24} lg={8}>
          <Card
            title="最新构面"
            variant="borderless"
            extra={trendDelta > 0 ? <RiseOutlined style={{ color: '#0e9f6e' }} /> : trendDelta < 0 ? <FallOutlined style={{ color: '#e02424' }} /> : null}
            styles={{ body: { minHeight: 280 } }}
          >
            {scored.length ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="期别">{scored[scored.length - 1]!.period}</Descriptions.Item>
                <Descriptions.Item label="品质(70)">{scored[scored.length - 1]!.quality ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="交期(20)">{scored[scored.length - 1]!.purchase ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="服务(10)">{scored[scored.length - 1]!.service ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="综合">
                  <b>{scored[scored.length - 1]!.assessmentScore ?? '—'}</b>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="无资料" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 年度评鉴 */}
        <Col xs={24} lg={12}>
          <Card title="年度评鉴历史" variant="borderless" styles={{ body: { padding: 0 } }}>
            <Table rowKey="year" size="small" pagination={false} columns={annualCols} dataSource={annualHistory} locale={{ emptyText: '尚无年度资料' }} />
          </Card>
        </Col>
        {/* 背调 */}
        <Col xs={24} lg={12}>
          <Card
            title="背调分析"
            variant="borderless"
            extra={latestBg && <Tag color={bgRisk === 0 ? 'green' : bgRisk <= 2 ? 'gold' : 'red'}>{bgRisk === 0 ? '正常' : bgRisk <= 2 ? '需关注' : '偏高'}</Tag>}
          >
            {backgroundChecks.length ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={backgroundChecks}
                columns={[
                  { title: '年度', dataIndex: 'year', width: 70 },
                  { title: '拖欠货款', dataIndex: 'latePaymentCount', align: 'center' },
                  { title: '客诉', dataIndex: 'customerComplaintCount', align: 'center' },
                  { title: '8D', dataIndex: 'qualityAbnormal8D', align: 'center' },
                  { title: '配合度', dataIndex: 'cooperationScore', align: 'center', render: (v) => v ?? '—' },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无背调资料" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 历年填报明细（唯读） */}
      <Card title="历年填报明细（唯读）" variant="borderless" styles={{ body: { padding: 0 } }}>
        {quarterlyHistory.length ? (
          <Table
            rowKey="period"
            size="small"
            pagination={false}
            dataSource={quarterlyHistory}
            scroll={{ x: 1100 }}
            columns={[
              { title: '期别', dataIndex: 'period', fixed: 'left', width: 100 },
              { title: '检验批数', align: 'center', width: 84, render: (_, r) => r.raw.receivedBatches },
              { title: '退货批数', align: 'center', width: 84, render: (_, r) => r.raw.returnedBatches },
              { title: '外部客诉', align: 'center', width: 84, render: (_, r) => r.raw.externalCAR },
              { title: '产线CAR', align: 'center', width: 84, render: (_, r) => r.raw.arr },
              { title: '延迟回复', align: 'center', width: 84, render: (_, r) => r.raw.untimelyResponseCCR },
              { title: '达交率%', align: 'center', width: 84, render: (_, r) => r.raw.deliveryRate ?? '—' },
              { title: '停线', align: 'center', width: 64, render: (_, r) => r.raw.productionLineStop },
              { title: '特批', align: 'center', width: 64, render: (_, r) => r.raw.specialApproval },
              { title: '品质服务', align: 'center', width: 84, render: (_, r) => r.raw.serviceQuality },
              { title: '采购服务', align: 'center', width: 84, render: (_, r) => r.raw.servicePurchase },
              { title: '综合', align: 'center', width: 72, fixed: 'right', render: (_, r) => <b>{r.assessmentScore ?? '—'}</b> },
              { title: '等级', align: 'center', width: 64, fixed: 'right', render: (_, r) => <GradeTag grade={r.grade} /> },
            ]}
          />
        ) : (
          <div style={{ padding: 24 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无填报纪录" />
          </div>
        )}
      </Card>

      {/* 参与的比价 */}
      <Card title="参与的比价案件" variant="borderless">
        {sourcingParticipation.length ? (
          <Space wrap>
            {sourcingParticipation.map((s) => (
              <Tag
                key={`${s.eventId}-${s.stage}`}
                color={s.isBest ? 'gold' : 'default'}
                style={{ cursor: 'pointer', padding: '4px 10px' }}
                onClick={() => nav('/sourcing')}
              >
                {s.eventTitle} · {s.stage === 'before' ? '议价前' : '议价后'}
                {s.isBest && ' ★最优'}
              </Tag>
            ))}
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未参与任何比价案件" />
        )}
      </Card>
    </Space>
  );
}
