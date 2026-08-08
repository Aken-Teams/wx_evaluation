import { ArrowLeftOutlined } from '@ant-design/icons';
import { BarChart3, CalendarCheck, Scale, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Empty, Input, Result, Row, Segmented, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
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
  // 比价案件筛选（案件多时便于查找）
  const [sourcingQuery, setSourcingQuery] = useState('');
  const [sourcingBest, setSourcingBest] = useState<'all' | 'best'>('all');

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
        icon={<Sparkles size={16} />}
        message={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <b>综合评估</b>
              <Tag>规则式 · AI 增强</Tag>
            </Space>
            <Button size="small" type="link" icon={<Sparkles size={14} />} onClick={() => askAi(`请评估供应商「${vendor.name}」的整体表现、排名与风险。`)}>
              问 AI 评估这家
            </Button>
          </Space>
        }
        description={summary}
      />

      <Tabs
        defaultActiveKey="quarterly"
        items={[
          {
            key: 'quarterly',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={15} />
                季度评比
              </span>
            ),
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={16}>
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
                  <Col xs={24} lg={8}>
                    <Card
                      title="最新构面"
                      variant="borderless"
                      extra={trendDelta > 0 ? <TrendingUp size={16} color="#16a34a" /> : trendDelta < 0 ? <TrendingDown size={16} color="#dc2626" /> : null}
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
              </Space>
            ),
          },
          {
            key: 'annual',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarCheck size={15} />
                年度评鉴
              </span>
            ),
            children: (
              <Card title="年度评鉴历史" variant="borderless" styles={{ body: { padding: 0 } }}>
                <Table rowKey="year" size="small" pagination={false} columns={annualCols} dataSource={annualHistory} locale={{ emptyText: '尚无年度资料' }} />
              </Card>
            ),
          },
          {
            key: 'bg',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Scale size={15} />
                背调 · 比价
              </span>
            ),
            children: (
              <Row gutter={16}>
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
                          { title: '年度', dataIndex: 'year', width: 64 },
                          { title: '拖欠货款', dataIndex: 'latePaymentCount', align: 'center', width: 84 },
                          { title: '客诉', dataIndex: 'customerComplaintCount', align: 'center', width: 64 },
                          { title: '8D', dataIndex: 'qualityAbnormal8D', align: 'center', width: 56 },
                          { title: '配合度', dataIndex: 'cooperationScore', align: 'center', width: 72, render: (v) => v ?? '—' },
                          {
                            title: '其他背调',
                            dataIndex: 'notes',
                            render: (v: string | null) =>
                              v ? (
                                <Typography.Text style={{ maxWidth: 180 }} ellipsis={{ tooltip: v }}>
                                  {v}
                                </Typography.Text>
                              ) : (
                                <span style={{ color: '#bbb' }}>—</span>
                              ),
                          },
                        ]}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无背调资料" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card
                    title={`参与的比价案件${sourcingParticipation.length ? `（${sourcingParticipation.length}）` : ''}`}
                    variant="borderless"
                    extra={
                      sourcingParticipation.length ? (
                        <Space size={8}>
                          <Input.Search
                            allowClear
                            size="small"
                            placeholder="搜索案件名称"
                            style={{ width: 150 }}
                            onChange={(e) => setSourcingQuery(e.target.value)}
                          />
                          <Segmented
                            size="small"
                            value={sourcingBest}
                            onChange={(v) => setSourcingBest(v as 'all' | 'best')}
                            options={[
                              { label: '全部', value: 'all' },
                              { label: '仅最优', value: 'best' },
                            ]}
                          />
                        </Space>
                      ) : null
                    }
                  >
                    {sourcingParticipation.length ? (
                      (() => {
                        const q = sourcingQuery.trim().toLowerCase();
                        const rows = sourcingParticipation.filter(
                          (s) => (sourcingBest === 'all' || s.isBest) && (!q || s.eventTitle.toLowerCase().includes(q)),
                        );
                        return (
                          <Table
                            rowKey={(r) => `${r.eventId}-${r.stage}`}
                            size="small"
                            dataSource={rows}
                            pagination={rows.length > 6 ? { pageSize: 6, size: 'small' } : false}
                            locale={{ emptyText: '无符合条件的案件' }}
                            onRow={() => ({ onClick: () => nav('/sourcing'), style: { cursor: 'pointer' } })}
                            columns={[
                              { title: '案件名称', dataIndex: 'eventTitle', ellipsis: true },
                              {
                                title: '阶段',
                                dataIndex: 'stage',
                                width: 84,
                                align: 'center',
                                filters: [
                                  { text: '议价前', value: 'before' },
                                  { text: '议价后', value: 'after' },
                                ],
                                onFilter: (val, r) => r.stage === val,
                                render: (v: string) => <Tag>{v === 'before' ? '议价前' : '议价后'}</Tag>,
                              },
                              {
                                title: '最优',
                                dataIndex: 'isBest',
                                width: 76,
                                align: 'center',
                                render: (v: boolean) =>
                                  v ? <Tag color="gold">★ 最优</Tag> : <span style={{ color: '#bbb' }}>—</span>,
                              },
                            ]}
                          />
                        );
                      })()
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未参与任何比价案件" />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </Space>
  );
}
