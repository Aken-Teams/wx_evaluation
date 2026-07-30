import { ArrowDownOutlined, ArrowUpOutlined, FormOutlined, IdcardOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { GradeTag } from '../../components/GradeTag';
import type { RankingItem } from '../../types';

/** 本季 vs 上季，算出漲跌 movers */
function useMovers() {
  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const cur = periodsQuery.data?.[0];
  const prev = periodsQuery.data?.[1];
  const curQ = useQuery({ queryKey: ['summary', cur?.year, cur?.quarter], queryFn: () => analyticsApi.summary(cur!.year, cur!.quarter), enabled: !!cur });
  const prevQ = useQuery({ queryKey: ['summary', prev?.year, prev?.quarter], queryFn: () => analyticsApi.summary(prev!.year, prev!.quarter), enabled: !!prev });

  const movers = useMemo(() => {
    if (!curQ.data) return [];
    const prevMap = new Map((prevQ.data?.ranking ?? []).map((r) => [r.vendorId, r.score ?? 0]));
    return curQ.data.ranking
      .filter((r) => r.score != null && prevMap.has(r.vendorId))
      .map((r) => ({ ...r, delta: (r.score ?? 0) - (prevMap.get(r.vendorId) ?? 0) }))
      .filter((r) => Math.abs(r.delta) >= 0.05)
      .sort((a, b) => b.delta - a.delta);
  }, [curQ.data, prevQ.data]);

  return { period: cur, summary: curQ.data, movers, loading: curQ.isLoading };
}

function ManagerHome() {
  const nav = useNavigate();
  const { period, summary, movers } = useMovers();
  const kpis = summary?.kpis;
  const watchlist = summary?.watchlist ?? [];
  const up = movers.filter((m) => m.delta > 0).slice(0, 5);
  const down = movers.filter((m) => m.delta < 0).slice(0, 5);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          供应商情报概览 {period && <Typography.Text type="secondary" style={{ fontSize: 14 }}>· {period.year} {period.quarter}</Typography.Text>}
        </Typography.Title>
        <Space>
          <Button icon={<IdcardOutlined />} onClick={() => nav('/suppliers')}>供应商情报</Button>
          <Button onClick={() => nav('/dashboard')}>完整分析</Button>
        </Space>
      </Space>

      <Row gutter={16}>
        <Col xs={12} md={6}><Card variant="borderless"><Statistic title="供应商" value={kpis?.count ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card variant="borderless"><Statistic title="平均综合分" value={kpis?.avgScore ?? 0} precision={2} /></Card></Col>
        <Col xs={12} md={6}><Card variant="borderless"><Statistic title="需关注" value={watchlist.length} valueStyle={{ color: watchlist.length ? '#e3a008' : undefined }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card variant="borderless"><Statistic title="本季降级" value={kpis?.downgraded ?? 0} valueStyle={{ color: (kpis?.downgraded ?? 0) ? '#e02424' : undefined }} prefix={<ArrowDownOutlined />} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title={<Space><WarningOutlined style={{ color: '#e3a008' }} />需要关注的供应商</Space>} variant="borderless" styles={{ body: { minHeight: 240 } }}>
            {watchlist.length ? (
              <List
                size="small"
                dataSource={watchlist}
                renderItem={(r: RankingItem) => (
                  <List.Item style={{ cursor: 'pointer' }} onClick={() => nav(`/suppliers/${r.vendorId}`)}>
                    <Space><GradeTag grade={r.grade} />{r.vendorName}</Space>
                    <Space>{r.downgraded && <Tag color="error">降级</Tag>}<b>{r.score}</b></Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本季无风险供应商" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="本季变化（环比上季）" variant="borderless" styles={{ body: { minHeight: 240 } }}>
            {up.length === 0 && down.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无明显变化" />
            ) : (
              <Row gutter={16}>
                <Col span={12}>
                  <Typography.Text type="success"><ArrowUpOutlined /> 上升</Typography.Text>
                  {up.map((m) => (
                    <div key={m.vendorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer' }} onClick={() => nav(`/suppliers/${m.vendorId}`)}>
                      <span style={{ fontSize: 13 }}>{m.vendorName}</span>
                      <span style={{ color: '#0e9f6e' }}>+{m.delta.toFixed(1)}</span>
                    </div>
                  ))}
                </Col>
                <Col span={12}>
                  <Typography.Text type="danger"><ArrowDownOutlined /> 下降</Typography.Text>
                  {down.map((m) => (
                    <div key={m.vendorId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer' }} onClick={() => nav(`/suppliers/${m.vendorId}`)}>
                      <span style={{ fontSize: 13 }}>{m.vendorName}</span>
                      <span style={{ color: '#e02424' }}>{m.delta.toFixed(1)}</span>
                    </div>
                  ))}
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function EvaluatorHome() {
  const nav = useNavigate();
  const { period, summary } = useMovers();

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        评比工作台 {period && <Typography.Text type="secondary" style={{ fontSize: 14 }}>· 当前 {period.year} {period.quarter}</Typography.Text>}
      </Typography.Title>

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card variant="borderless" hoverable onClick={() => nav('/sqmvqm/quarterly')} styles={{ body: { textAlign: 'center', padding: 28 } }}>
            <FormOutlined style={{ fontSize: 32, color: '#1a56db' }} />
            <div style={{ fontWeight: 600, marginTop: 12, fontSize: 16 }}>季度评比</div>
            <Typography.Text type="secondary">单家专业评比 / 批量录入</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless" hoverable onClick={() => nav('/sqmvqm/yearly')} styles={{ body: { textAlign: 'center', padding: 28 } }}>
            <IdcardOutlined style={{ fontSize: 32, color: '#0e9f6e' }} />
            <div style={{ fontWeight: 600, marginTop: 12, fontSize: 16 }}>年度评鉴</div>
            <Typography.Text type="secondary">VDA/QSA/HSF 年度稽核</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card variant="borderless" hoverable onClick={() => nav('/suppliers')} styles={{ body: { textAlign: 'center', padding: 28 } }}>
            <WarningOutlined style={{ fontSize: 32, color: '#e3a008' }} />
            <div style={{ fontWeight: 600, marginTop: 12, fontSize: 16 }}>供应商情报</div>
            <Typography.Text type="secondary">查看供应商档案与排名</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card title="本季概况" variant="borderless">
        <Row gutter={16}>
          <Col xs={12} md={6}><Statistic title="本季已评" value={summary?.kpis.count ?? 0} suffix="家" /></Col>
          <Col xs={12} md={6}><Statistic title="平均综合分" value={summary?.kpis.avgScore ?? 0} precision={2} /></Col>
          <Col xs={12} md={6}><Statistic title="需关注" value={summary?.watchlist.length ?? 0} /></Col>
          <Col xs={12} md={6}><Statistic title="降级" value={summary?.kpis.downgraded ?? 0} /></Col>
        </Row>
      </Card>
    </Space>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const isManager = user?.role === 'viewer' || user?.role === 'admin';
  return isManager ? <ManagerHome /> : <EvaluatorHome />;
}
