import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Building2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, suppliersApi, type SupplierInput } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { GradeTag } from '../../components/GradeTag';
import { PageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api';
import type { Grade, Supplier } from '../../types';

interface Row extends Supplier {
  grade: Grade | null;
  score: number | null;
  rank: number | null;
}

export function SupplierDirectory() {
  const nav = useNavigate();
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'quality_yearly_editor';

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [form] = Form.useForm<SupplierInput>();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);

  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const latest = periodsQuery.data?.[0];
  const summaryQuery = useQuery({
    queryKey: ['summary', latest?.year, latest?.quarter],
    queryFn: () => analyticsApi.summary(latest!.year, latest!.quarter),
    enabled: !!latest,
  });

  const rankMap = useMemo(() => {
    const m = new Map<number, { grade: Grade | null; score: number | null; rank: number | null }>();
    summaryQuery.data?.ranking.forEach((r) => m.set(r.vendorId, { grade: r.grade, score: r.score, rank: r.rank }));
    return m;
  }, [summaryQuery.data]);

  const categories = useMemo(
    () => Array.from(new Set((suppliersQuery.data ?? []).map((s) => s.materialCategory).filter(Boolean))) as string[],
    [suppliersQuery.data],
  );

  const rows: Row[] = useMemo(() => {
    let list = (suppliersQuery.data ?? []).map((s) => ({ ...s, ...(rankMap.get(s.id) ?? { grade: null, score: null, rank: null }) }));
    if (category) list = list.filter((s) => s.materialCategory === category);
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(k) || (s.supplierCode ?? '').toLowerCase().includes(k));
    }
    return list.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  }, [suppliersQuery.data, rankMap, category, keyword]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['suppliers'] });
  const saveMut = useMutation({
    mutationFn: (v: SupplierInput) => (editing ? suppliersApi.update(editing.id, v) : suppliersApi.create(v)),
    onSuccess: () => { message.success(editing ? '已更新' : '已新增'); setOpen(false); setEditing(null); invalidate(); },
    onError: (e) => message.error(apiErrorMessage(e)),
  });
  const delMut = useMutation({
    mutationFn: (id: number) => suppliersApi.remove(id),
    onSuccess: () => { message.success('已删除'); invalidate(); },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const openAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); form.setFieldsValue(s); setOpen(true); };

  const columns: ColumnsType<Row> = [
    { title: '排名', dataIndex: 'rank', width: 64, align: 'center', render: (v) => v ?? '—' },
    {
      title: '供应商',
      dataIndex: 'name',
      render: (n: string, r) => (
        <a onClick={() => nav(`/suppliers/${r.id}`)} style={{ fontWeight: 500 }}>
          {n}
          {r.isAU && r.isAU.toUpperCase().includes('AU') && <Tag color="geekblue" style={{ marginLeft: 6 }}>AU</Tag>}
        </a>
      ),
    },
    { title: '物料类别', dataIndex: 'materialCategory', width: 160, render: (v) => v || '—' },
    { title: '地区', dataIndex: 'region', width: 90, render: (v) => v || '—' },
    { title: '综合分', dataIndex: 'score', width: 84, align: 'center', render: (v) => v ?? '—' },
    { title: '等级', width: 76, align: 'center', render: (_, r) => <GradeTag grade={r.grade} /> },
    ...(canEdit
      ? [
          {
            title: '管理',
            width: 100,
            align: 'center' as const,
            render: (_: unknown, r: Row) => (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="删除此供应商？" onConfirm={() => delMut.mutate(r.id)} okText="删除" cancelText="取消">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<Building2 size={22} />}
        title="供应商情报"
        subtitle={`共 ${suppliersQuery.data?.length ?? 0} 家${latest ? ` · 评分依据 ${latest.year} ${latest.quarter}` : ''} · 点名称进档案`}
        extra={
          <>
            <Select allowClear placeholder="物料类别" style={{ width: 170 }} options={categories.map((c) => ({ value: c, label: c }))} onChange={setCategory} />
            <Input.Search placeholder="搜索名称 / 代码" allowClear style={{ width: 200 }} onChange={(e) => setKeyword(e.target.value)} />
            {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增供应商</Button>}
          </>
        }
      />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<Row>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={suppliersQuery.isLoading || summaryQuery.isLoading}
          size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 家` }}
          onRow={(r) => ({ onClick: () => nav(`/suppliers/${r.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>

      {canEdit && (
        <Modal open={open} title={editing ? '编辑供应商' : '新增供应商'} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saveMut.isPending} okText="储存" cancelText="取消" destroyOnClose>
          <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)} style={{ marginTop: 12 }}>
            <Form.Item name="name" label="供应商名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
            <Space style={{ width: '100%' }} size={12}>
              <Form.Item name="supplierCode" label="供应商代码" style={{ flex: 1 }}><Input /></Form.Item>
              <Form.Item name="vendorType" label="类型" style={{ flex: 1 }}><Input placeholder="国内 / 海外" /></Form.Item>
            </Space>
            <Form.Item name="materialCategory" label="物料类别"><Input placeholder="如 直接物料-晶片" /></Form.Item>
            <Space style={{ width: '100%' }} size={12}>
              <Form.Item name="region" label="地区" style={{ flex: 1 }}><Input /></Form.Item>
              <Form.Item name="isAU" label="是否 AU" style={{ flex: 1 }}><Input placeholder="含 AU 视为 AU" /></Form.Item>
            </Space>
          </Form>
        </Modal>
      )}
    </Space>
  );
}
