import { SaveOutlined } from '@ant-design/icons';
import { evaluateAnnual } from '@wx/scoring';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Card, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, annualApi, type SaveAnnualItem } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { PageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api';
import type { AnnualRow, Grade, Quarter } from '../../types';

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const AUDIT_TYPES = ['实地稽核', '文件审核', '免稽核'];

interface Row extends AnnualRow {
  dirty?: boolean;
}

const recompute = (r: Row): Row => {
  const result = evaluateAnnual(
    QUARTERS.map((q) => r.quarterScores[q]),
    { VDA: r.audit.VDA, QSA: r.audit.QSA, HSF: r.audit.HSF, others: r.others },
  );
  return { ...r, ...result };
};

export function AnnualEvaluation() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [year, setYear] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const years = useMemo(
    () => Array.from(new Set((periodsQuery.data ?? []).map((p) => p.year))).sort((a, b) => b - a),
    [periodsQuery.data],
  );
  useEffect(() => {
    if (year === null && years.length) setYear(years[0]!);
  }, [year, years]);

  const annualQuery = useQuery({
    queryKey: ['annual', year],
    queryFn: () => annualApi.get(year!),
    enabled: year !== null,
  });
  useEffect(() => {
    if (annualQuery.data) {
      setRows(annualQuery.data);
      setDirty(false);
    }
  }, [annualQuery.data]);

  const updateAudit = (vendorId: number, field: 'VDA' | 'QSA' | 'QPA' | 'HSF' | 'CSR', value: number | null) => {
    setRows((prev) => prev.map((r) => (r.vendorId === vendorId ? recompute({ ...r, audit: { ...r.audit, [field]: value } }) : r)));
    setDirty(true);
  };
  const updateField = (vendorId: number, field: 'others' | 'nextYearAuditType' | 'remarks', value: number | string | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.vendorId !== vendorId) return r;
        const next = { ...r, [field]: value } as Row;
        return field === 'others' ? recompute(next) : next;
      }),
    );
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const items: SaveAnnualItem[] = rows.map((r) => ({
        vendorId: r.vendorId,
        VDA: r.audit.VDA,
        QSA: r.audit.QSA,
        QPA: r.audit.QPA,
        HSF: r.audit.HSF,
        CSR: r.audit.CSR,
        others: r.others,
        nextYearAuditType: r.nextYearAuditType,
        remarks: r.remarks,
      }));
      return annualApi.save(year!, items);
    },
    onSuccess: () => {
      message.success('年度评鉴已储存');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['annual', year] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const auditCol = (field: 'VDA' | 'QSA' | 'QPA' | 'HSF' | 'CSR') => ({
    title: field,
    width: 82,
    align: 'center' as const,
    render: (_: unknown, r: Row) => (
      <InputNumber
        size="small"
        controls={false}
        value={r.audit[field]}
        style={{ width: '100%' }}
        onChange={(v) => updateAudit(r.vendorId, field, v as number | null)}
      />
    ),
  });

  const columns: ColumnsType<Row> = [
    { title: '供应商', dataIndex: 'vendorName', fixed: 'left', width: 200 },
    ...QUARTERS.map((q) => ({
      title: q,
      width: 64,
      align: 'center' as const,
      render: (_: unknown, r: Row) => r.quarterScores[q] ?? '—',
    })),
    { title: '月均', width: 72, align: 'center', render: (_, r) => r.monthlyAssessmentAverage ?? '—' },
    auditCol('VDA'),
    auditCol('QSA'),
    auditCol('QPA'),
    auditCol('HSF'),
    {
      title: 'others',
      width: 82,
      align: 'center',
      render: (_, r) => (
        <InputNumber
          size="small"
          controls={false}
          value={r.others}
          style={{ width: '100%' }}
          onChange={(v) => updateField(r.vendorId, 'others', v as number | null)}
        />
      ),
    },
    { title: '年度分', width: 80, align: 'center', fixed: 'right', render: (_, r) => <b>{r.annualScore ?? '—'}</b> },
    { title: '等级', width: 64, align: 'center', fixed: 'right', render: (_, r) => <GradeTag grade={r.grade as Grade | null} /> },
    {
      title: '下年度稽核',
      width: 130,
      render: (_, r) => (
        <Select
          size="small"
          value={r.nextYearAuditType}
          options={AUDIT_TYPES.map((t) => ({ value: t, label: t }))}
          style={{ width: '100%' }}
          onChange={(v) => updateField(r.vendorId, 'nextYearAuditType', v)}
        />
      ),
    },
    {
      title: '备注',
      width: 160,
      render: (_, r) => (
        <Input
          size="small"
          value={r.remarks ?? ''}
          onChange={(e) => updateField(r.vendorId, 'remarks', e.target.value)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<CalendarCheck size={22} />}
        title="年度评鉴"
        subtitle="VDA / QSA / HSF 年度稽核 · 输入即时重算年度分"
        extra={
          <>
            <Typography.Text strong>年度</Typography.Text>
            <Select
              style={{ width: 120 }}
              value={year ?? undefined}
              options={years.map((y) => ({ value: y, label: `${y} 年` }))}
              loading={periodsQuery.isLoading}
              onChange={setYear}
            />
            {dirty && <Tag color="warning">有未储存的变更</Tag>}
            <Button type="primary" icon={<SaveOutlined />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              储存
            </Button>
          </>
        }
      />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="vendorId"
          columns={columns}
          dataSource={rows}
          loading={annualQuery.isLoading}
          size="small"
          pagination={false}
          scroll={{ x: 1500, y: 'calc(100vh - 260px)' }}
        />
      </Card>
    </Space>
  );
}
