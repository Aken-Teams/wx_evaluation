import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Empty, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { osatApi } from '../../api';
import type { OsatRow } from '../../types';

export function OsatPage() {
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null);
  const periodsQuery = useQuery({ queryKey: ['osat-periods'], queryFn: osatApi.periods });

  useEffect(() => {
    if (!period && periodsQuery.data?.length) {
      const p = periodsQuery.data[0]!;
      setPeriod({ year: p.year, month: p.month });
    }
  }, [period, periodsQuery.data]);

  const monthlyQuery = useQuery({
    queryKey: ['osat-monthly', period?.year, period?.month],
    queryFn: () => osatApi.getMonthly(period!.year, period!.month),
    enabled: !!period,
  });

  const options = useMemo(
    () => (periodsQuery.data ?? []).map((p) => ({ value: `${p.year}-${p.month}`, label: `${p.year} 年 ${p.month} 月` })),
    [periodsQuery.data],
  );

  const columns: ColumnsType<OsatRow> = [
    { title: '供应商', dataIndex: 'vendorName', width: 220 },
    { title: '厂区', dataIndex: 'factory', width: 100 },
    { title: '出货量', dataIndex: 'shipmentQuantity', width: 100, align: 'center' },
    { title: '进料批数', dataIndex: 'receivedBatches', width: 90, align: 'center' },
    { title: '退货批数', dataIndex: 'returnedBatches', width: 90, align: 'center' },
    { title: '客诉总件', dataIndex: 'totalComplaintCCR', width: 90, align: 'center' },
    { title: '品质分', dataIndex: 'qualityAssessmentScore', width: 84, align: 'center', render: (v) => v ?? '—' },
    { title: '采购分', dataIndex: 'purchaseAssessmentScoreA', width: 84, align: 'center', render: (v) => v ?? '—' },
    { title: '综合分', dataIndex: 'assessmentScore', width: 84, align: 'center', render: (v) => <b>{v ?? '—'}</b> },
  ];

  const noData = !periodsQuery.isLoading && (periodsQuery.data ?? []).length === 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          OSAT 评比（岡山 / 苏州）
        </Typography.Title>
        {!noData && (
          <Select
            style={{ width: 180 }}
            value={period ? `${period.year}-${period.month}` : undefined}
            options={options}
            loading={periodsQuery.isLoading}
            onChange={(v) => {
              const [y, m] = v.split('-');
              setPeriod({ year: Number(y), month: Number(m) });
            }}
          />
        )}
      </Space>

      <Alert
        type="info"
        showIcon
        message="OSAT 为封测代工厂月度评比模块。目前数据库中 OSAT 资料为空（无锡端是否启用待确认）；本模块已接上真实资料表，一旦有资料即会显示。"
      />

      <Card variant="borderless" styles={{ body: { padding: noData ? 24 : 0 } }}>
        {noData ? (
          <Empty description="OSAT 模块目前无资料" />
        ) : (
          <Table<OsatRow>
            rowKey={(r) => `${r.vendorId}-${r.factory}`}
            columns={columns}
            dataSource={monthlyQuery.data ?? []}
            loading={monthlyQuery.isLoading}
            size="small"
            pagination={false}
            scroll={{ x: 1000 }}
          />
        )}
      </Card>
    </Space>
  );
}
