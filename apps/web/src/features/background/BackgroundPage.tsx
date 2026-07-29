import { SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Alert, Button, Card, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, backgroundApi, type SaveBackgroundItem } from '../../api';
import { apiErrorMessage } from '../../lib/api';
import type { BackgroundRow } from '../../types';

const riskOf = (r: BackgroundRow): { text: string; color: string } => {
  const n = r.latePaymentCount + r.customerComplaintCount + r.qualityAbnormal8D;
  if (n === 0) return { text: '正常', color: 'green' };
  if (n <= 2) return { text: '关注', color: 'gold' };
  return { text: '高风险', color: 'red' };
};

export function BackgroundPage() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [year, setYear] = useState<number | null>(null);
  const [rows, setRows] = useState<BackgroundRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const years = useMemo(() => {
    const ys = Array.from(new Set((periodsQuery.data ?? []).map((p) => p.year)));
    return ys.length ? ys.sort((a, b) => b - a) : [new Date().getFullYear()];
  }, [periodsQuery.data]);
  useEffect(() => {
    if (year === null && years.length) setYear(years[0]!);
  }, [year, years]);

  const dataQuery = useQuery({
    queryKey: ['background', year],
    queryFn: () => backgroundApi.get(year!),
    enabled: year !== null,
  });
  useEffect(() => {
    if (dataQuery.data) {
      setRows(dataQuery.data);
      setDirty(false);
    }
  }, [dataQuery.data]);

  const update = (vendorId: number, field: keyof BackgroundRow, value: number | string | null) => {
    setRows((prev) => prev.map((r) => (r.vendorId === vendorId ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const items: SaveBackgroundItem[] = rows.map((r) => ({
        vendorId: r.vendorId,
        latePaymentCount: r.latePaymentCount,
        customerComplaintCount: r.customerComplaintCount,
        qualityAbnormal8D: r.qualityAbnormal8D,
        cooperationScore: r.cooperationScore,
        notes: r.notes,
      }));
      return backgroundApi.save(year!, items);
    },
    onSuccess: () => {
      message.success('背调资料已储存');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['background', year] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const numCol = (field: 'latePaymentCount' | 'customerComplaintCount' | 'qualityAbnormal8D' | 'cooperationScore', title: string, width = 110) => ({
    title,
    width,
    align: 'center' as const,
    render: (_: unknown, r: BackgroundRow) => (
      <InputNumber
        size="small"
        controls={false}
        min={0}
        value={r[field]}
        style={{ width: '100%' }}
        onChange={(v) => update(r.vendorId, field, v as number | null)}
      />
    ),
  });

  const columns: ColumnsType<BackgroundRow> = [
    { title: '供应商', dataIndex: 'vendorName', fixed: 'left', width: 220 },
    { title: '风险', width: 84, align: 'center', render: (_, r) => { const k = riskOf(r); return <Tag color={k.color}>{k.text}</Tag>; } },
    numCol('latePaymentCount', '拖欠货款'),
    numCol('customerComplaintCount', '客诉频次'),
    numCol('qualityAbnormal8D', '品质异常(8D)'),
    numCol('cooperationScore', '配合度(0-100)', 120),
    {
      title: '备注 / 其他背调',
      render: (_, r) => (
        <Input
          size="small"
          value={r.notes ?? ''}
          placeholder="不限于以上"
          onChange={(e) => update(r.vendorId, 'notes', e.target.value)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            背调分析
          </Typography.Title>
          <Select
            style={{ width: 120 }}
            value={year ?? undefined}
            options={years.map((y) => ({ value: y, label: `${y} 年` }))}
            onChange={setYear}
          />
          {dirty && <Tag color="warning">有未储存的变更</Tag>}
        </Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          储存
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        message="背调四维度：拖欠货款频次、年度被客户投诉频次、年度品质异常(8D)、与客户配合度。可供比价决策与年度评鉴参考。"
      />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<BackgroundRow>
          rowKey="vendorId"
          columns={columns}
          dataSource={rows}
          loading={dataQuery.isLoading}
          size="small"
          pagination={false}
          scroll={{ x: 1000, y: 'calc(100vh - 300px)' }}
        />
      </Card>
    </Space>
  );
}
