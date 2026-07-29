import { ArrowDownOutlined, TrophyOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Empty, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { gradeColor } from '../../theme';
import type { Period, Quarter, RankingItem } from '../../types';

const RADAR_COLORS = ['#1a56db', '#0e9f6e', '#e3a008', '#ff8a4c', '#9333ea'];

export function DashboardPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });

  useEffect(() => {
    if (!period && periodsQuery.data?.length) setPeriod(periodsQuery.data[0]!);
  }, [period, periodsQuery.data]);

  const summaryQuery = useQuery({
    queryKey: ['summary', period?.year, period?.quarter],
    queryFn: () => analyticsApi.summary(period!.year, period!.quarter),
    enabled: !!period,
  });
  const trendQuery = useQuery({
    queryKey: ['trend', period?.year],
    queryFn: () => analyticsApi.trend(period!.year),
    enabled: !!period,
  });

  const kpis = summaryQuery.data?.kpis;
  const ranking = summaryQuery.data?.ranking ?? [];
  const watchlist = summaryQuery.data?.watchlist ?? [];

  const distData = useMemo(() => {
    const d = kpis?.distribution;
    if (!d) return [];
    return (['A', 'B', 'C', 'D', 'E'] as const)
      .map((g) => ({ grade: g, value: d[g] }))
      .filter((x) => x.value > 0);
  }, [kpis]);

  const top10 = useMemo(() => ranking.slice(0, 10).map((r) => ({ name: r.vendorName, score: r.score ?? 0 })), [ranking]);

  const radarData = useMemo(() => {
    const top5 = ranking.slice(0, 5);
    // 三軸正規化為 0~100 便於比較（品質/70、交期/20、服務/10）
    const axes: Array<{ subject: string; key: 'quality' | 'purchase' | 'service'; max: number }> = [
      { subject: '品质', key: 'quality', max: 70 },
      { subject: '交期', key: 'purchase', max: 20 },
      { subject: '服务', key: 'service', max: 10 },
    ];
    return axes.map((a) => {
      const point: Record<string, string | number> = { subject: a.subject };
      top5.forEach((r) => {
        point[r.vendorName] = Math.round(((r[a.key] ?? 0) / a.max) * 100);
      });
      return point;
    });
  }, [ranking]);
  const top5Names = ranking.slice(0, 5).map((r) => r.vendorName);

  const trendData = useMemo(
    () => (trendQuery.data ?? []).map((t) => ({ quarter: t.quarter, 平均分: t.avgScore ?? 0, 降级家数: t.downgraded })),
    [trendQuery.data],
  );

  const periodOptions = (periodsQuery.data ?? []).map((p) => ({
    value: `${p.year}-${p.quarter}`,
    label: `${p.year} 年 ${p.quarter}`,
  }));

  const rankColumns: ColumnsType<RankingItem> = [
    { title: '排名', dataIndex: 'rank', width: 64, align: 'center' },
    {
      title: '供应商',
      dataIndex: 'vendorName',
      render: (n: string, r) => (
        <Space size={4}>
          {n}
          {r.isAU && <Tag color="geekblue">AU</Tag>}
          {r.downgraded && <Tag color="error">降级</Tag>}
        </Space>
      ),
    },
    { title: '品质', dataIndex: 'quality', width: 72, align: 'center' },
    { title: '交期', dataIndex: 'purchase', width: 72, align: 'center' },
    { title: '服务', dataIndex: 'service', width: 72, align: 'center' },
    {
      title: '综合',
      dataIndex: 'score',
      width: 80,
      align: 'center',
      render: (v: number | null) => <b>{v ?? '—'}</b>,
    },
    { title: '等级', width: 72, align: 'center', render: (_, r) => <GradeTag grade={r.grade} /> },
  ];

  if (!period && !periodsQuery.isLoading) return <Empty description="尚无评比资料" />;

  const cardBody = { minHeight: 300 };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          供应商评比 · 决策仪表板
        </Typography.Title>
        <Select
          style={{ width: 180 }}
          value={period ? `${period.year}-${period.quarter}` : undefined}
          options={periodOptions}
          loading={periodsQuery.isLoading}
          onChange={(v) => {
            const [y, q] = v.split('-');
            setPeriod({ year: Number(y), quarter: q as Quarter });
          }}
        />
      </Space>

      {/* KPI 卡 */}
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic title="供应商总数" value={kpis?.count ?? 0} loading={summaryQuery.isLoading} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="平均综合分"
              value={kpis?.avgScore ?? 0}
              precision={2}
              loading={summaryQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="A 级家数"
              value={kpis?.distribution.A ?? 0}
              prefix={<TrophyOutlined style={{ color: gradeColor.A }} />}
              loading={summaryQuery.isLoading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="本季降级家数"
              value={kpis?.downgraded ?? 0}
              valueStyle={{ color: (kpis?.downgraded ?? 0) > 0 ? '#e02424' : undefined }}
              prefix={<ArrowDownOutlined />}
              loading={summaryQuery.isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 等级分布 */}
        <Col xs={24} lg={8}>
          <Card title="等级分布" bordered={false} styles={{ body: cardBody }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={distData} dataKey="value" nameKey="grade" outerRadius={90} label={(e) => `${e.grade} (${e.value})`}>
                  {distData.map((d) => (
                    <Cell key={d.grade} fill={gradeColor[d.grade]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        {/* Top10 综合分 */}
        <Col xs={24} lg={16}>
          <Card title="综合分 Top 10" bordered={false} styles={{ body: cardBody }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top10} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#1a56db" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 趋势 */}
        <Col xs={24} lg={12}>
          <Card title={`${period?.year ?? ''} 年 各季趋势`} bordered={false} styles={{ body: cardBody }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="平均分" stroke="#1a56db" strokeWidth={2} />
                <Line type="monotone" dataKey="降级家数" stroke="#e02424" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        {/* 雷达比较 Top5 */}
        <Col xs={24} lg={12}>
          <Card title="Top 5 多维比较（三轴各正规化为 100）" bordered={false} styles={{ body: cardBody }}>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <Tooltip />
                <Legend />
                {top5Names.map((name, i) => (
                  <Radar
                    key={name}
                    name={name}
                    dataKey={name}
                    stroke={RADAR_COLORS[i]}
                    fill={RADAR_COLORS[i]}
                    fillOpacity={0.1}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 排名表 */}
        <Col xs={24} lg={16}>
          <Card title="供应商排名" bordered={false} styles={{ body: { padding: 0 } }}>
            <Table<RankingItem>
              rowKey="vendorId"
              columns={rankColumns}
              dataSource={ranking}
              loading={summaryQuery.isLoading}
              size="small"
              pagination={{ pageSize: 10, size: 'small' }}
            />
          </Card>
        </Col>
        {/* 风险名单 */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#e3a008' }} />
                风险观察名单
              </Space>
            }
            bordered={false}
            styles={{ body: { maxHeight: 420, overflow: 'auto' } }}
          >
            {watchlist.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本季无风险供应商" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {watchlist.map((r) => (
                  <div
                    key={r.vendorId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: 6,
                    }}
                  >
                    <Space size={6}>
                      <GradeTag grade={r.grade} />
                      <span>{r.vendorName}</span>
                    </Space>
                    <Space size={6}>
                      {r.downgraded && <Tag color="error">降级</Tag>}
                      <b>{r.score}</b>
                    </Space>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
