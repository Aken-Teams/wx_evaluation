import { BarChart3, Building2, CalendarRange, Gauge, TrendingDown, TriangleAlert, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Empty, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { analyticsApi, annualApi } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { gradeColor } from '../../theme';
import type { AnnualRow, Grade, Period, Quarter, RankingItem, TrendPoint } from '../../types';

const RADAR_COLORS = ['#1a56db', '#0e9f6e', '#e3a008', '#ff8a4c', '#9333ea'];

export function DashboardPage() {
  const nav = useNavigate();
  const [period, setPeriod] = useState<Period | null>(null);
  const [viewMode, setViewMode] = useState<'quarter' | 'year'>('quarter');
  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });

  useEffect(() => {
    if (!period && periodsQuery.data?.length) setPeriod(periodsQuery.data[0]!);
  }, [period, periodsQuery.data]);

  const summaryQuery = useQuery({
    queryKey: ['summary', period?.year, period?.quarter],
    queryFn: () => analyticsApi.summary(period!.year, period!.quarter),
    enabled: !!period,
  });

  // 上一季（用于环比）
  const periodsList = periodsQuery.data ?? [];
  const curIdx = periodsList.findIndex((p) => p.year === period?.year && p.quarter === period?.quarter);
  const prevPeriod = curIdx >= 0 ? periodsList[curIdx + 1] : undefined;
  const prevSummaryQuery = useQuery({
    queryKey: ['summary', prevPeriod?.year, prevPeriod?.quarter],
    queryFn: () => analyticsApi.summary(prevPeriod!.year, prevPeriod!.quarter),
    enabled: !!prevPeriod,
  });
  const deltaMap = useMemo(() => {
    const m = new Map<number, number>();
    const pm = new Map((prevSummaryQuery.data?.ranking ?? []).map((r) => [r.vendorId, r.score ?? 0]));
    (summaryQuery.data?.ranking ?? []).forEach((r) => {
      if (r.score != null && pm.has(r.vendorId)) m.set(r.vendorId, r.score - (pm.get(r.vendorId) ?? 0));
    });
    return m;
  }, [summaryQuery.data, prevSummaryQuery.data]);
  const trendQuery = useQuery({
    queryKey: ['trend', period?.year],
    queryFn: () => analyticsApi.trend(period!.year),
    enabled: !!period,
  });
  const annualQuery = useQuery({
    queryKey: ['annual', period?.year],
    queryFn: () => annualApi.get(period!.year),
    enabled: !!period && viewMode === 'year',
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

  const top10 = useMemo(
    () => ranking.slice(0, 10).map((r) => ({ name: r.vendorName, score: r.score ?? 0, grade: r.grade })),
    [ranking],
  );
  // 分数几乎都贴近满分时，用「聚焦窗口」放大彼此差距，并保证至少 1 分的可视范围
  const scoreDomain = useMemo<[number, number]>(() => {
    const vals = top10.map((t) => t.score).filter((v) => v > 0);
    if (!vals.length) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    const lo = Math.max(0, min - span * 0.6);
    const hi = Math.min(100, max + span * 0.15);
    return [Number(lo.toFixed(1)), Number(hi.toFixed(1))];
  }, [top10]);

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
  // 平均分左轴聚焦到实际区间（而非 0~100），让季度间的微小变化看得出来
  const avgDomain = useMemo<[number, number]>(() => {
    const vals = trendData.map((t) => t.平均分).filter((v) => v > 0);
    if (!vals.length) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const lo = Math.max(0, Math.floor(min - 3));
    const hi = Math.min(100, Math.ceil(max + 2));
    return [lo, hi === lo ? lo + 1 : hi];
  }, [trendData]);
  const maxDowngrade = useMemo(() => Math.max(1, ...trendData.map((t) => t.降级家数)), [trendData]);

  // 年度视图数据
  const yearOptions = useMemo(
    () =>
      Array.from(new Set((periodsQuery.data ?? []).map((p) => p.year)))
        .sort((a, b) => b - a)
        .map((y) => ({ value: y, label: `${y} 年` })),
    [periodsQuery.data],
  );
  const yearStats = useMemo(() => {
    const pts = trendQuery.data ?? [];
    const scored = pts.filter((p) => p.avgScore != null);
    const avg = scored.length ? scored.reduce((s, p) => s + (p.avgScore ?? 0), 0) / scored.length : null;
    const best = scored.reduce<TrendPoint | undefined>((b, p) => ((p.avgScore ?? 0) > (b?.avgScore ?? -1) ? p : b), undefined);
    const totalDown = pts.reduce((s, p) => s + p.downgraded, 0);
    const peakA = pts.reduce((m, p) => Math.max(m, p.distribution.A), 0);
    return { avg, best, totalDown, peakA, quarters: pts.length };
  }, [trendQuery.data]);
  const gradeStructData = useMemo(
    () =>
      (trendQuery.data ?? []).map((p) => ({
        quarter: p.quarter,
        A: p.distribution.A,
        B: p.distribution.B,
        C: p.distribution.C,
        D: p.distribution.D,
        E: p.distribution.E,
      })),
    [trendQuery.data],
  );
  // 年度评鉴（真正的年度报告数据）
  const annualDist = useMemo(() => {
    const acc: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    (annualQuery.data ?? []).forEach((r) => {
      if (r.grade) acc[r.grade] += 1;
    });
    return (['A', 'B', 'C', 'D', 'E'] as const).map((g) => ({ grade: g, value: acc[g] })).filter((x) => x.value > 0);
  }, [annualQuery.data]);
  const annualRanking = useMemo(
    () =>
      (annualQuery.data ?? [])
        .filter((r) => r.annualScore != null)
        .sort((a, b) => (b.annualScore ?? 0) - (a.annualScore ?? 0))
        .map((r, i) => ({ ...r, rank: i + 1 })),
    [annualQuery.data],
  );
  const auditPlan = useMemo(() => {
    const acc: Record<string, number> = {};
    (annualQuery.data ?? []).forEach((r) => {
      const k = r.nextYearAuditType || '未定';
      acc[k] = (acc[k] ?? 0) + 1;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [annualQuery.data]);
  const annualScored = annualQuery.data?.filter((r) => r.annualScore != null).length ?? 0;

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
          <a onClick={() => nav(`/suppliers/${r.vendorId}`)}>{n}</a>
          {r.isAU && <Tag color="geekblue">AU</Tag>}
          {r.downgraded && <Tag color="error">降级</Tag>}
        </Space>
      ),
    },
    { title: '品质', dataIndex: 'quality', width: 68, align: 'center' },
    { title: '交期', dataIndex: 'purchase', width: 68, align: 'center' },
    { title: '服务', dataIndex: 'service', width: 68, align: 'center' },
    {
      title: '综合',
      dataIndex: 'score',
      width: 76,
      align: 'center',
      render: (v: number | null) => <b>{v ?? '—'}</b>,
    },
    {
      title: '环比',
      width: 76,
      align: 'center',
      render: (_, r) => {
        const d = deltaMap.get(r.vendorId);
        if (d == null) return '—';
        return <span style={{ color: d > 0.05 ? '#0e9f6e' : d < -0.05 ? '#e02424' : undefined }}>{d > 0 ? '+' : ''}{d.toFixed(1)}</span>;
      },
    },
    { title: '等级', width: 68, align: 'center', render: (_, r) => <GradeTag grade={r.grade} /> },
  ];

  const annualColumns: ColumnsType<AnnualRow & { rank: number }> = [
    { title: '排名', dataIndex: 'rank', width: 60, align: 'center' },
    { title: '供应商', dataIndex: 'vendorName', render: (n: string, r) => <a onClick={() => nav(`/suppliers/${r.vendorId}`)}>{n}</a> },
    { title: '月均', dataIndex: 'monthlyAssessmentAverage', width: 72, align: 'center', render: (v: number | null) => v ?? '—' },
    { title: '稽核', dataIndex: 'auditComponent', width: 72, align: 'center', render: (v: number | null) => v ?? '—' },
    { title: '年度分', dataIndex: 'annualScore', width: 84, align: 'center', render: (v: number | null) => <b>{v ?? '—'}</b> },
    { title: '等级', width: 68, align: 'center', render: (_, r) => <GradeTag grade={r.grade} /> },
    { title: '次年稽核', dataIndex: 'nextYearAuditType', width: 104, render: (v: string) => v || '—' },
  ];

  if (!period && !periodsQuery.isLoading) return <Empty description="尚无评比资料" />;

  const cardBody = { minHeight: 300 };
  const emptyBox = (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '72px 0' }} description="暂无数据" />
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="决策仪表板"
        subtitle={viewMode === 'quarter' ? '单季快照 · 等级分布 / Top10 / 排名 / 多维比较' : '年度走势 · 各季平均 / 降级 / 等级结构'}
        extra={
          <>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'quarter' | 'year')}
              options={[
                { label: '季度视图', value: 'quarter' },
                { label: '年度视图', value: 'year' },
              ]}
            />
            {viewMode === 'quarter' ? (
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
            ) : (
              <Select
                style={{ width: 140 }}
                value={period?.year}
                options={yearOptions}
                loading={periodsQuery.isLoading}
                onChange={(y) => setPeriod({ year: y, quarter: period?.quarter ?? 'Q4' })}
              />
            )}
          </>
        }
      />

      {viewMode === 'quarter' ? (
        <>
      {/* 本季 KPI */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard title="供应商总数" value={kpis?.count ?? 0} icon={<Building2 size={22} />} color="#2563eb" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="平均综合分" value={(kpis?.avgScore ?? 0).toFixed(2)} icon={<Gauge size={22} />} color="#16a34a" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="A 级家数" value={kpis?.distribution.A ?? 0} icon={<Trophy size={22} />} color={gradeColor.A} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="本季降级家数" value={kpis?.downgraded ?? 0} icon={<TrendingDown size={22} />} color="#dc2626" />
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 等级分布 */}
        <Col xs={24} lg={8}>
          <Card title="等级分布" variant="borderless" styles={{ body: cardBody }}>
            {distData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={distData}
                    dataKey="value"
                    nameKey="grade"
                    outerRadius={90}
                    label={(e) => `${e.grade} (${e.value})`}
                  >
                    {distData.map((d) => (
                      <Cell key={d.grade} fill={gradeColor[d.grade]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              emptyBox
            )}
          </Card>
        </Col>
        {/* Top10 综合分 */}
        <Col xs={24} lg={16}>
          <Card
            title="综合分 Top 10"
            variant="borderless"
            extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>横轴已聚焦，放大彼此差距</Typography.Text>}
            styles={{ body: cardBody }}
          >
            {top10.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={top10} layout="vertical" margin={{ left: 40, right: 44 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={scoreDomain} allowDataOverflow tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [v, '综合分']} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                    {top10.map((t, i) => (
                      <Cell key={i} fill={t.grade ? gradeColor[t.grade] : '#2563eb'} />
                    ))}
                    <LabelList dataKey="score" position="right" style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} formatter={(v: number) => v.toFixed(1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              emptyBox
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 雷达比较 Top5 */}
        <Col xs={24}>
          <Card title="Top 5 多维比较（三轴各正规化为 100）" variant="borderless" styles={{ body: cardBody }}>
            {top5Names.length ? (
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
            ) : (
              emptyBox
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 排名表 */}
        <Col xs={24} lg={16}>
          <Card title="供应商排名" variant="borderless" styles={{ body: { padding: 0 } }}>
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
                <TriangleAlert size={16} color="#d97706" />
                风险观察名单
              </Space>
            }
            variant="borderless"
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
        </>
      ) : (
        <>
          {/* 年度 KPI */}
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <StatCard title="年度平均分" value={yearStats.avg != null ? yearStats.avg.toFixed(2) : '—'} icon={<Gauge size={22} />} color="#16a34a" />
            </Col>
            <Col xs={12} md={6}>
              <StatCard title="A 级峰值家数" value={yearStats.peakA} icon={<Trophy size={22} />} color={gradeColor.A} />
            </Col>
            <Col xs={12} md={6}>
              <StatCard title="全年降级次数" value={yearStats.totalDown} icon={<TrendingDown size={22} />} color="#dc2626" />
            </Col>
            <Col xs={12} md={6}>
              <StatCard title="评比期数" value={yearStats.quarters} suffix="季" icon={<CalendarRange size={22} />} color="#2563eb" />
            </Col>
          </Row>

          <Row gutter={16}>
            {/* 各季趋势（双轴） */}
            <Col xs={24} lg={12}>
              <Card title={`${period?.year ?? ''} 年 各季趋势`} variant="borderless" styles={{ body: cardBody }}>
                {trendData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData} margin={{ right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" />
                      <YAxis yAxisId="left" domain={avgDomain} tick={{ fontSize: 12 }} width={44} label={{ value: '平均分', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#2563eb' } }} />
                      <YAxis yAxisId="right" orientation="right" allowDecimals={false} domain={[0, maxDowngrade]} tick={{ fontSize: 12 }} width={36} label={{ value: '降级家数', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#dc2626' } }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="平均分" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="降级家数" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  emptyBox
                )}
              </Card>
            </Col>
            {/* 各季等级结构（堆叠） */}
            <Col xs={24} lg={12}>
              <Card title="各季等级结构" variant="borderless" styles={{ body: cardBody }}>
                {gradeStructData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={gradeStructData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="quarter" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => (
                        <Bar key={g} dataKey={g} stackId="grade" fill={gradeColor[g]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  emptyBox
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* 年度评鉴等级分布 */}
            <Col xs={24} lg={8}>
              <Card title="年度评鉴等级分布" variant="borderless" styles={{ body: cardBody }}>
                {annualDist.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={annualDist} dataKey="value" nameKey="grade" outerRadius={90} label={(e) => `${e.grade} (${e.value})`}>
                        {annualDist.map((d) => (
                          <Cell key={d.grade} fill={gradeColor[d.grade]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  emptyBox
                )}
              </Card>
            </Col>
            {/* 年度综合排名 */}
            <Col xs={24} lg={16}>
              <Card
                title={`年度综合排名（已评 ${annualScored} 家）`}
                variant="borderless"
                extra={
                  auditPlan.length ? (
                    <Space size={4} wrap>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>次年稽核</Typography.Text>
                      {auditPlan.map(([t, n]) => (
                        <Tag key={t}>{t} {n}</Tag>
                      ))}
                    </Space>
                  ) : null
                }
                styles={{ body: { padding: 0 } }}
              >
                <Table<AnnualRow & { rank: number }>
                  rowKey="vendorId"
                  columns={annualColumns}
                  dataSource={annualRanking}
                  loading={annualQuery.isLoading}
                  size="small"
                  pagination={{ pageSize: 8, size: 'small' }}
                  locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本年度尚无年度评鉴数据" /> }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
}
