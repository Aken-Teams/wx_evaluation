import { CalculatorOutlined, ImportOutlined, SaveOutlined } from '@ant-design/icons';
import { evaluateQuarter } from '@wx/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Card, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, evaluationsApi, suppliersApi, type SaveEvaluationItem } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { apiErrorMessage } from '../../lib/api';
import type { EvaluationRow, Period, Quarter, QuarterlyResult, Supplier } from '../../types';

interface Row {
  vendorId: number;
  vendorName: string;
  isAU: boolean;
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
  remarks: string | null;
  score: QuarterlyResult;
}

const scoreOf = (r: Omit<Row, 'score'>): QuarterlyResult =>
  evaluateQuarter({
    receivedBatches: r.receivedBatches,
    returnedBatches: r.returnedBatches,
    externalCAR: r.externalCAR,
    arr: r.arr,
    untimelyResponseCCR: r.untimelyResponseCCR,
    serviceQuality: r.serviceQuality,
    servicePurchase: r.servicePurchase,
    deliveryRate: r.deliveryRate,
    specialApproval: r.specialApproval,
    productionLineStop: r.productionLineStop,
    isAU: r.isAU,
  });

const fromApi = (e: EvaluationRow): Row => ({
  vendorId: e.vendorId,
  vendorName: e.vendorName,
  isAU: e.isAU,
  receivedBatches: e.raw.receivedBatches ?? 0,
  returnedBatches: e.raw.returnedBatches ?? 0,
  externalCAR: e.raw.externalCAR ?? 0,
  arr: e.raw.arr ?? 0,
  untimelyResponseCCR: e.raw.untimelyResponseCCR ?? 0,
  serviceQuality: e.raw.serviceQuality ?? 0,
  servicePurchase: e.raw.servicePurchase ?? 0,
  deliveryRate: e.raw.deliveryRate ?? null,
  specialApproval: e.raw.specialApproval ?? 0,
  productionLineStop: e.raw.productionLineStop ?? 0,
  remarks: e.raw.remarks ?? null,
  score: e.score,
});

/** 从供应商主档建立空白列（供尚无该季资料的供应商填写） */
const blankRow = (s: Supplier): Row => {
  const base = {
    vendorId: s.id,
    vendorName: s.name,
    isAU: !!s.isAU && s.isAU.toUpperCase().includes('AU'),
    receivedBatches: 0,
    returnedBatches: 0,
    externalCAR: 0,
    arr: 0,
    untimelyResponseCCR: 0,
    serviceQuality: 0,
    servicePurchase: 0,
    deliveryRate: 100 as number | null,
    specialApproval: 0,
    productionLineStop: 0,
    remarks: null as string | null,
  };
  return { ...base, score: scoreOf(base) };
};

const QUARTER_OPTS = (['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => ({ value: q, label: q }));

const prevPeriod = (year: number, quarter: Quarter): Period => {
  const q = Number(quarter[1]);
  return q === 1 ? { year: year - 1, quarter: 'Q4' } : { year, quarter: `Q${q - 1}` as Quarter };
};

const EDITABLE: Array<{ key: keyof Row; title: string; width: number }> = [
  { key: 'receivedBatches', title: '检验批数', width: 90 },
  { key: 'returnedBatches', title: '退货批数', width: 90 },
  { key: 'externalCAR', title: '外部客诉', width: 90 },
  { key: 'arr', title: '产线CAR', width: 90 },
  { key: 'untimelyResponseCCR', title: '延迟回复', width: 90 },
  { key: 'deliveryRate', title: '达交率%', width: 96 },
  { key: 'productionLineStop', title: '停线次数', width: 90 },
  { key: 'specialApproval', title: '特批扣分', width: 90 },
  { key: 'serviceQuality', title: '品质服务', width: 90 },
  { key: 'servicePurchase', title: '采购服务', width: 90 },
];

export function EvaluationWorkbench() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });

  // 預設選最新有資料的期別
  useEffect(() => {
    if (!period && periodsQuery.data?.length) setPeriod(periodsQuery.data[0]!);
  }, [period, periodsQuery.data]);

  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const evalQuery = useQuery({
    queryKey: ['evaluations', period?.year, period?.quarter],
    queryFn: () => evaluationsApi.getQuarterly(period!.year, period!.quarter),
    enabled: !!period,
  });

  // 以「供应商主档」为基底，合并当季已有资料；尚无资料的供应商显示空白列可填（支援新季度）
  useEffect(() => {
    if (!suppliersQuery.data || !evalQuery.data) return;
    const byId = new Map(evalQuery.data.map((e) => [e.vendorId, fromApi(e)]));
    setRows(suppliersQuery.data.map((s) => byId.get(s.id) ?? blankRow(s)));
    setDirty(false);
  }, [suppliersQuery.data, evalQuery.data]);

  const updateCell = (vendorId: number, field: keyof Row, value: number | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.vendorId !== vendorId) return r;
        const next = { ...r, [field]: value ?? 0 } as Row;
        if (field === 'deliveryRate') next.deliveryRate = value;
        return { ...next, score: scoreOf(next) };
      }),
    );
    setDirty(true);
  };

  const carryOver = useMutation({
    mutationFn: async () => {
      if (!period) return [];
      const prev = prevPeriod(period.year, period.quarter);
      return evaluationsApi.getQuarterly(prev.year, prev.quarter);
    },
    onSuccess: (prevRows) => {
      if (!prevRows.length) {
        message.info('上一季无资料可带入');
        return;
      }
      const byId = new Map(prevRows.map((e) => [e.vendorId, fromApi(e)]));
      setRows((prev) =>
        prev.map((r) => {
          const p = byId.get(r.vendorId);
          if (!p) return r;
          const merged = { ...r, ...p, vendorName: r.vendorName, isAU: r.isAU } as Row;
          return { ...merged, score: scoreOf(merged) };
        }),
      );
      setDirty(true);
      message.success('已带入上一季数据，请确认后储存');
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const save = useMutation({
    mutationFn: () => {
      const items: SaveEvaluationItem[] = rows.map((r) => ({
        vendorId: r.vendorId,
        receivedBatches: r.receivedBatches,
        returnedBatches: r.returnedBatches,
        externalCAR: r.externalCAR,
        arr: r.arr,
        untimelyResponseCCR: r.untimelyResponseCCR,
        serviceQuality: r.serviceQuality,
        servicePurchase: r.servicePurchase,
        deliveryRate: r.deliveryRate,
        specialApproval: r.specialApproval,
        productionLineStop: r.productionLineStop,
        remarks: r.remarks,
      }));
      return evaluationsApi.saveQuarterly(period!.year, period!.quarter, items);
    },
    onSuccess: () => {
      message.success('已储存');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['evaluations', period?.year, period?.quarter] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const yearOptions = useMemo(() => {
    const base = (periodsQuery.data ?? []).map((p) => p.year);
    const cur = new Date().getFullYear();
    const set = new Set<number>([...base, cur, Math.max(cur, ...(base.length ? base : [cur])) + 1]);
    return [...set].sort((a, b) => b - a).map((y) => ({ value: y, label: `${y} 年` }));
  }, [periodsQuery.data]);

  const columns: ColumnsType<Row> = [
    {
      title: '供应商',
      dataIndex: 'vendorName',
      fixed: 'left',
      width: 220,
      render: (name: string, r) => (
        <Space size={4}>
          <span>{name}</span>
          {r.isAU && <Tag color="geekblue">AU</Tag>}
        </Space>
      ),
    },
    ...EDITABLE.map((col) => ({
      title: col.title,
      dataIndex: col.key,
      width: col.width,
      align: 'center' as const,
      render: (_: unknown, r: Row) => (
        <InputNumber
          size="small"
          value={r[col.key] as number | null}
          min={col.key === 'deliveryRate' ? 0 : 0}
          max={col.key === 'deliveryRate' ? 100 : undefined}
          controls={false}
          style={{ width: '100%' }}
          onChange={(v) => updateCell(r.vendorId, col.key, v as number | null)}
        />
      ),
    })),
    {
      title: '品质(70)',
      align: 'center',
      width: 84,
      render: (_, r) => r.score.quality?.qualityScore ?? '—',
    },
    {
      title: '交期(20)',
      align: 'center',
      width: 84,
      render: (_, r) => r.score.purchase?.purchaseScore ?? '—',
    },
    {
      title: '服务(10)',
      align: 'center',
      width: 84,
      render: (_, r) => r.score.serviceScore ?? '—',
    },
    {
      title: '综合',
      align: 'center',
      width: 84,
      fixed: 'right',
      render: (_, r) => <b>{r.score.assessmentScore ?? '—'}</b>,
    },
    {
      title: '等级',
      align: 'center',
      width: 72,
      fixed: 'right',
      render: (_, r) => <GradeTag grade={r.score.finalGrade} />,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="borderless" styles={{ body: { padding: '16px 20px' } }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Typography.Text strong>评比期别：</Typography.Text>
            <Select
              style={{ width: 110 }}
              placeholder="年份"
              value={period?.year}
              options={yearOptions}
              loading={periodsQuery.isLoading}
              onChange={(y) => setPeriod((p) => ({ year: y, quarter: p?.quarter ?? 'Q1' }))}
            />
            <Select
              style={{ width: 90 }}
              placeholder="季度"
              value={period?.quarter}
              options={QUARTER_OPTS}
              onChange={(q) => setPeriod((p) => ({ year: p?.year ?? new Date().getFullYear(), quarter: q as Quarter }))}
            />
            <Tag icon={<CalculatorOutlined />} color="processing">
              输入即时自动算分
            </Tag>
            {dirty && <Tag color="warning">有未储存的变更</Tag>}
          </Space>
          <Space>
            <Button
              icon={<ImportOutlined />}
              onClick={() => carryOver.mutate()}
              loading={carryOver.isPending}
              disabled={!period}
            >
              带入上一季
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!dirty}
            >
              储存
            </Button>
          </Space>
        </Space>
      </Card>

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="vendorId"
          columns={columns}
          dataSource={rows}
          loading={evalQuery.isLoading}
          size="small"
          pagination={false}
          scroll={{ x: 1400, y: 'calc(100vh - 280px)' }}
        />
      </Card>
    </Space>
  );
}
