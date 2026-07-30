import { SaveOutlined } from '@ant-design/icons';
import { evaluateQuarter } from '@wx/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Card, Col, Divider, InputNumber, Row, Select, Space, Statistic, Typography } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, backgroundApi, evaluationsApi, suppliersApi } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { apiErrorMessage } from '../../lib/api';
import { gradeColor } from '../../theme';
import type { Period, Quarter } from '../../types';

interface Fields {
  receivedBatches: number;
  returnedBatches: number;
  externalCAR: number;
  arr: number;
  untimelyResponseCCR: number;
  serviceQuality: number;
  servicePurchase: number;
  deliveryRate: number | null;
  specialApproval: number;
  productionLineStop: number;
}
interface Bg {
  latePaymentCount: number;
  customerComplaintCount: number;
  qualityAbnormal8D: number;
  cooperationScore: number | null;
}
const emptyFields: Fields = {
  receivedBatches: 0, returnedBatches: 0, externalCAR: 0, arr: 0, untimelyResponseCCR: 0,
  serviceQuality: 0, servicePurchase: 0, deliveryRate: 100, specialApproval: 0, productionLineStop: 0,
};
const emptyBg: Bg = { latePaymentCount: 0, customerComplaintCount: 0, qualityAbnormal8D: 0, cooperationScore: null };

const N = ({ label, value, onChange, max }: { label: string; value: number | null; onChange: (v: number | null) => void; max?: number }) => (
  <Space direction="vertical" size={2} style={{ width: '100%' }}>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
    <InputNumber value={value} min={0} max={max} controls={false} style={{ width: '100%' }} onChange={(v) => onChange(v as number | null)} />
  </Space>
);

export function SingleEvaluation() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period | null>(null);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [f, setF] = useState<Fields>(emptyFields);
  const [bg, setBg] = useState<Bg>(emptyBg);
  const [dirty, setDirty] = useState(false);

  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });

  useEffect(() => {
    if (!period && periodsQuery.data?.length) setPeriod(periodsQuery.data[0]!);
  }, [period, periodsQuery.data]);

  const evalQuery = useQuery({
    queryKey: ['evaluations', period?.year, period?.quarter],
    queryFn: () => evaluationsApi.getQuarterly(period!.year, period!.quarter),
    enabled: !!period,
  });
  const profileQuery = useQuery({
    queryKey: ['supplier-profile', vendorId],
    queryFn: () => suppliersApi.profile(vendorId!),
    enabled: !!vendorId,
  });
  const bgQuery = useQuery({
    queryKey: ['background', period?.year],
    queryFn: () => backgroundApi.get(period!.year),
    enabled: !!period,
  });

  // 载入所选供应商当期资料
  useEffect(() => {
    if (!vendorId || !evalQuery.data) return;
    const row = evalQuery.data.find((r) => r.vendorId === vendorId);
    if (row) {
      setF({
        receivedBatches: row.raw.receivedBatches ?? 0, returnedBatches: row.raw.returnedBatches ?? 0,
        externalCAR: row.raw.externalCAR ?? 0, arr: row.raw.arr ?? 0, untimelyResponseCCR: row.raw.untimelyResponseCCR ?? 0,
        serviceQuality: row.raw.serviceQuality ?? 0, servicePurchase: row.raw.servicePurchase ?? 0,
        deliveryRate: row.raw.deliveryRate ?? 100, specialApproval: row.raw.specialApproval ?? 0, productionLineStop: row.raw.productionLineStop ?? 0,
      });
    } else setF(emptyFields);
    setDirty(false);
  }, [vendorId, evalQuery.data]);

  useEffect(() => {
    if (!vendorId || !bgQuery.data) return;
    const b = bgQuery.data.find((r) => r.vendorId === vendorId);
    setBg(b ? { latePaymentCount: b.latePaymentCount, customerComplaintCount: b.customerComplaintCount, qualityAbnormal8D: b.qualityAbnormal8D, cooperationScore: b.cooperationScore } : emptyBg);
  }, [vendorId, bgQuery.data]);

  const isAU = useMemo(() => {
    const t = suppliersQuery.data?.find((s) => s.id === vendorId)?.isAU;
    return !!t && t.toUpperCase().includes('AU');
  }, [suppliersQuery.data, vendorId]);

  const score = useMemo(() => evaluateQuarter({ ...f, isAU }), [f, isAU]);
  const history = profileQuery.data?.quarterlyHistory ?? [];
  const trendData = history.map((h) => ({ period: h.period, 综合分: h.assessmentScore }));

  const upd = (k: keyof Fields, v: number | null) => { setF((p) => ({ ...p, [k]: k === 'deliveryRate' ? v : (v ?? 0) })); setDirty(true); };
  const updBg = (k: keyof Bg, v: number | null) => { setBg((p) => ({ ...p, [k]: k === 'cooperationScore' ? v : (v ?? 0) })); setDirty(true); };

  const save = useMutation({
    mutationFn: async () => {
      await evaluationsApi.saveQuarterly(period!.year, period!.quarter, [{ vendorId: vendorId!, ...f }]);
      await backgroundApi.save(period!.year, [{ vendorId: vendorId!, ...bg }]);
    },
    onSuccess: () => {
      message.success('已储存评比与背调');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['evaluations', period?.year, period?.quarter] });
      qc.invalidateQueries({ queryKey: ['background', period?.year] });
      qc.invalidateQueries({ queryKey: ['supplier-profile', vendorId] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const supplierOptions = (suppliersQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const periodOptions = (periodsQuery.data ?? []).map((p) => ({ value: `${p.year}-${p.quarter}`, label: `${p.year} ${p.quarter}` }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="borderless" styles={{ body: { padding: '14px 20px' } }}>
        <Space wrap>
          <Select style={{ width: 130 }} placeholder="期别" value={period ? `${period.year}-${period.quarter}` : undefined} options={periodOptions}
            onChange={(v) => { const [y, q] = v.split('-'); setPeriod({ year: Number(y), quarter: q as Quarter }); }} />
          <Select style={{ width: 300 }} showSearch placeholder="选择供应商" optionFilterProp="label" value={vendorId ?? undefined} options={supplierOptions} onChange={setVendorId} />
          {isAU && <Typography.Text type="secondary">（AU 供应商，较严门槛）</Typography.Text>}
        </Space>
      </Card>

      {!vendorId ? (
        <Card variant="borderless"><Typography.Text type="secondary">请先选择供应商，进入单家专业评比。</Typography.Text></Card>
      ) : (
        <Row gutter={16}>
          {/* 输入表单 */}
          <Col xs={24} lg={15}>
            <Card title="① 品质" variant="borderless" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 12]}>
                <Col span={8}><N label="检验批数" value={f.receivedBatches} onChange={(v) => upd('receivedBatches', v)} /></Col>
                <Col span={8}><N label="退货批数" value={f.returnedBatches} onChange={(v) => upd('returnedBatches', v)} /></Col>
                <Col span={8}><N label="外部客诉" value={f.externalCAR} onChange={(v) => upd('externalCAR', v)} /></Col>
                <Col span={8}><N label="产线CAR" value={f.arr} onChange={(v) => upd('arr', v)} /></Col>
                <Col span={8}><N label="延迟回复" value={f.untimelyResponseCCR} onChange={(v) => upd('untimelyResponseCCR', v)} /></Col>
                <Col span={8}><N label="品质服务(0-?)" value={f.serviceQuality} onChange={(v) => upd('serviceQuality', v)} /></Col>
              </Row>
            </Card>
            <Card title="② 交期" variant="borderless" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 12]}>
                <Col span={8}><N label="达交率%" value={f.deliveryRate} max={100} onChange={(v) => upd('deliveryRate', v)} /></Col>
                <Col span={8}><N label="停线次数" value={f.productionLineStop} onChange={(v) => upd('productionLineStop', v)} /></Col>
                <Col span={8}><N label="特批扣分" value={f.specialApproval} onChange={(v) => upd('specialApproval', v)} /></Col>
                <Col span={8}><N label="采购服务" value={f.servicePurchase} onChange={(v) => upd('servicePurchase', v)} /></Col>
              </Row>
            </Card>
            <Card title="③ 背调（随评比一并填写）" variant="borderless">
              <Row gutter={[16, 12]}>
                <Col span={6}><N label="拖欠货款" value={bg.latePaymentCount} onChange={(v) => updBg('latePaymentCount', v)} /></Col>
                <Col span={6}><N label="客诉频次" value={bg.customerComplaintCount} onChange={(v) => updBg('customerComplaintCount', v)} /></Col>
                <Col span={6}><N label="品质异常(8D)" value={bg.qualityAbnormal8D} onChange={(v) => updBg('qualityAbnormal8D', v)} /></Col>
                <Col span={6}><N label="配合度(0-100)" value={bg.cooperationScore} max={100} onChange={(v) => updBg('cooperationScore', v)} /></Col>
              </Row>
            </Card>
          </Col>

          {/* 即时结果 */}
          <Col xs={24} lg={9}>
            <Card variant="borderless" style={{ position: 'sticky', top: 16 }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#8a94a6' }}>综合评分</div>
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>{score.assessmentScore ?? '—'}</div>
                <span style={{ fontSize: 22, fontWeight: 700, color: score.finalGrade ? gradeColor[score.finalGrade] : '#999' }}>{score.finalGrade ?? '—'} 级</span>
                {score.downgraded && <div style={{ color: '#e02424', fontSize: 12 }}>已触发降级</div>}
              </div>
              <Row gutter={8} style={{ textAlign: 'center' }}>
                <Col span={8}><Statistic title="品质(70)" value={score.quality?.qualityScore ?? 0} /></Col>
                <Col span={8}><Statistic title="交期(20)" value={score.purchase?.purchaseScore ?? 0} /></Col>
                <Col span={8}><Statistic title="服务(10)" value={score.serviceScore ?? 0} /></Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              {profileQuery.data?.current && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <Typography.Text type="secondary">当前排名 </Typography.Text>
                  <b>{profileQuery.data.current.rank}/{profileQuery.data.current.totalRanked}</b>
                  {profileQuery.data.current.grade && <> · <GradeTag grade={profileQuery.data.current.grade} /></>}
                </div>
              )}
              {trendData.length > 1 && (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[60, 100]} width={28} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="综合分" stroke="#1a56db" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              <Button type="primary" icon={<SaveOutlined />} block style={{ marginTop: 12 }} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
                储存评比 + 背调
              </Button>
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
}
