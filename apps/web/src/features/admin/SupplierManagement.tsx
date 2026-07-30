import { DeleteOutlined, EditOutlined, PlusOutlined, ShopOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { suppliersApi, type SupplierInput } from '../../api';
import { PageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api';
import type { Supplier } from '../../types';

export function SupplierManagement() {
  const { message } = AntApp.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm<SupplierInput>();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const listQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const categories = useMemo(
    () => Array.from(new Set((listQuery.data ?? []).map((s) => s.materialCategory).filter(Boolean))) as string[],
    [listQuery.data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['suppliers'] });
  };

  const saveMut = useMutation({
    mutationFn: (v: SupplierInput) =>
      editing ? suppliersApi.update(editing.id, v) : suppliersApi.create(v),
    onSuccess: () => {
      message.success(editing ? '已更新' : '已新增');
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => suppliersApi.remove(id),
    onSuccess: () => {
      message.success('已删除');
      invalidate();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    form.setFieldsValue(s);
    setOpen(true);
  };

  const data = useMemo(() => {
    let all = listQuery.data ?? [];
    if (categoryFilter) all = all.filter((s) => s.materialCategory === categoryFilter);
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      all = all.filter(
        (s) =>
          s.name.toLowerCase().includes(k) ||
          (s.supplierCode ?? '').toLowerCase().includes(k) ||
          (s.materialCategory ?? '').toLowerCase().includes(k),
      );
    }
    return all;
  }, [listQuery.data, keyword, categoryFilter]);

  const columns: ColumnsType<Supplier> = [
    {
      title: '供应商名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 240,
      render: (n: string, r) => <a onClick={() => nav(`/suppliers/${r.id}`)}>{n}</a>,
    },
    { title: '供应商代码', dataIndex: 'supplierCode', width: 120 },
    { title: '物料类别', dataIndex: 'materialCategory', width: 160 },
    { title: '地区', dataIndex: 'region', width: 100 },
    {
      title: 'AU',
      dataIndex: 'isAU',
      width: 80,
      align: 'center',
      render: (v: string | null) => (v && v.toUpperCase().includes('AU') ? <Tag color="geekblue">AU</Tag> : '—'),
    },
    { title: '类型', dataIndex: 'vendorType', width: 100 },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      render: (_, s) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(s)} />
          <Popconfirm title="确定删除此供应商？" onConfirm={() => delMut.mutate(s.id)} okText="删除" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} loading={delMut.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<ShopOutlined />}
        title="供应商管理"
        subtitle={`共 ${listQuery.data?.length ?? 0} 家供应商 · 点名称可进档案`}
        extra={
          <>
            <Select
              allowClear
              placeholder="物料类别"
              style={{ width: 170 }}
              options={categories.map((c) => ({ value: c, label: c }))}
              onChange={setCategoryFilter}
            />
            <Input.Search placeholder="搜索名称 / 代码" allowClear style={{ width: 200 }} onChange={(e) => setKeyword(e.target.value)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增供应商
            </Button>
          </>
        }
      />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<Supplier>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={listQuery.isLoading}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 家供应商` }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? '编辑供应商' : '新增供应商'}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        okText="储存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="供应商名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="供应商全称" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="supplierCode" label="供应商代码" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="vendorType" label="类型" style={{ flex: 1 }}>
              <Input placeholder="国内 / 海外" />
            </Form.Item>
          </Space>
          <Form.Item name="materialCategory" label="物料类别">
            <Input placeholder="如 直接物料-晶片" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item name="region" label="地区" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="isAU" label="是否 AU" style={{ flex: 1 }}>
              <Input placeholder="含 AU 视为 AU 供应商" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
