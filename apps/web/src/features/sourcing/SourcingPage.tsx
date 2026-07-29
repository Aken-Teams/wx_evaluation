import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App as AntApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { sourcingApi, type QuoteInput } from '../../api';
import { apiErrorMessage } from '../../lib/api';
import type { SourcingQuote } from '../../types';

export function SourcingPage() {
  const { message } = AntApp.useApp();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [eventForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [eventModal, setEventModal] = useState(false);
  const [quoteModal, setQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SourcingQuote | null>(null);

  const eventsQuery = useQuery({ queryKey: ['sourcing-events'], queryFn: sourcingApi.listEvents });
  useEffect(() => {
    if (selected === null && eventsQuery.data?.length) setSelected(eventsQuery.data[0]!.id);
  }, [selected, eventsQuery.data]);

  const detailQuery = useQuery({
    queryKey: ['sourcing-event', selected],
    queryFn: () => sourcingApi.getEvent(selected!),
    enabled: selected !== null,
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['sourcing-events'] });
    qc.invalidateQueries({ queryKey: ['sourcing-event', selected] });
  };

  const createEvent = useMutation({
    mutationFn: (v: { title: string; itemName?: string; description?: string }) => sourcingApi.createEvent(v),
    onSuccess: (e) => {
      message.success('已建立案件');
      setEventModal(false);
      setSelected(e.id);
      qc.invalidateQueries({ queryKey: ['sourcing-events'] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => sourcingApi.deleteEvent(id),
    onSuccess: () => {
      message.success('已删除案件');
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['sourcing-events'] });
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const saveQuote = useMutation({
    mutationFn: (v: QuoteInput) =>
      editingQuote ? sourcingApi.updateQuote(editingQuote.id, v) : sourcingApi.addQuote(selected!, v),
    onSuccess: () => {
      message.success(editingQuote ? '已更新报价' : '已新增报价');
      setQuoteModal(false);
      setEditingQuote(null);
      refetchAll();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const deleteQuote = useMutation({
    mutationFn: (id: number) => sourcingApi.deleteQuote(id),
    onSuccess: () => {
      message.success('已删除报价');
      refetchAll();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const markBest = useMutation({
    mutationFn: (id: number) => sourcingApi.markBest(id),
    onSuccess: () => {
      message.success('已标记最优供应商');
      refetchAll();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const openAddQuote = () => {
    setEditingQuote(null);
    quoteForm.resetFields();
    quoteForm.setFieldsValue({ stage: 'after' });
    setQuoteModal(true);
  };
  const openEditQuote = (q: SourcingQuote) => {
    setEditingQuote(q);
    quoteForm.setFieldsValue(q);
    setQuoteModal(true);
  };

  const quoteColumns: ColumnsType<SourcingQuote> = [
    {
      title: '供方',
      dataIndex: 'supplierName',
      fixed: 'left',
      width: 160,
      render: (n: string, q) => (
        <Space size={4}>
          {q.isBest && <StarFilled style={{ color: '#e3a008' }} />}
          <b>{n}</b>
        </Space>
      ),
    },
    { title: '阶段', dataIndex: 'stage', width: 80, render: (s: string) => <Tag>{s === 'before' ? '议价前' : '议价后'}</Tag> },
    { title: '模具品项', dataIndex: 'moldItems', width: 140 },
    { title: '模具含税(万)', dataIndex: 'moldPriceTaxed', width: 110, align: 'right' },
    { title: '产品单价', dataIndex: 'productUnitPrice', width: 100, align: 'right' },
    { title: '单价合计', dataIndex: 'unitPriceTotal', width: 100, align: 'right' },
    { title: '样品交期', dataIndex: 'sampleLeadTime', width: 100 },
    { title: '交货周期', dataIndex: 'deliveryCycle', width: 100 },
    { title: '账期', dataIndex: 'paymentTerms', width: 150 },
    { title: '模具款条件', dataIndex: 'moldPaymentTerms', width: 180 },
    { title: '金属级距', dataIndex: 'priceTier', width: 140 },
    { title: '背调信息', dataIndex: 'backgroundInfo', width: 200 },
    { title: '综合评估', dataIndex: 'evaluation', width: 200 },
    {
      title: '操作',
      fixed: 'right',
      width: 130,
      render: (_, q) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={q.isBest ? <StarFilled style={{ color: '#e3a008' }} /> : <StarOutlined />}
            onClick={() => markBest.mutate(q.id)}
            title="标记最优"
          />
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditQuote(q)} />
          <Popconfirm title="删除此报价？" onConfirm={() => deleteQuote.mutate(q.id)} okText="删除" cancelText="取消">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          比价寻源
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { eventForm.resetFields(); setEventModal(true); }}>
          新增比价案件
        </Button>
      </Space>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Card variant="borderless" style={{ width: 280, flexShrink: 0 }} styles={{ body: { padding: 8 } }} title="案件列表">
          <List
            size="small"
            loading={eventsQuery.isLoading}
            dataSource={eventsQuery.data ?? []}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无案件" /> }}
            renderItem={(e) => (
              <List.Item
                onClick={() => setSelected(e.id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: e.id === selected ? '#eaf1fe' : undefined,
                }}
              >
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <b>{e.title}</b>
                    <Tag color={e.status === 'decided' ? 'success' : 'processing'}>
                      {e.status === 'decided' ? '已决' : '进行'}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {e.itemName || '—'} · {e._count?.quotes ?? 0} 家报价
                  </Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <Card
          variant="borderless"
          style={{ flex: 1, minWidth: 0 }}
          styles={{ body: { padding: detail ? 0 : 24 } }}
          title={detail ? `${detail.title} · 报价比较` : '案件详情'}
          extra={
            detail && (
              <Space>
                <Button icon={<PlusOutlined />} onClick={openAddQuote}>
                  新增报价
                </Button>
                <Popconfirm title="删除整个案件？" onConfirm={() => deleteEvent.mutate(detail.id)} okText="删除" cancelText="取消">
                  <Button danger icon={<DeleteOutlined />}>
                    删除案件
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        >
          {!detail ? (
            <Empty description="请从左侧选择或新增案件" />
          ) : (
            <Table<SourcingQuote>
              rowKey="id"
              columns={quoteColumns}
              dataSource={detail.quotes}
              size="small"
              pagination={false}
              scroll={{ x: 1800 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无报价，点「新增报价」加入候选供应商" /> }}
            />
          )}
        </Card>
      </div>

      {/* 新增案件 */}
      <Modal
        open={eventModal}
        title="新增比价案件"
        onCancel={() => setEventModal(false)}
        onOk={() => eventForm.submit()}
        confirmLoading={createEvent.isPending}
        okText="建立"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={eventForm} layout="vertical" onFinish={(v) => createEvent.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="案件名称" rules={[{ required: true, message: '请输入案件名称' }]}>
            <Input placeholder="例：TO-277B MAX 开模" />
          </Form.Item>
          <Form.Item name="itemName" label="品项">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增/编辑报价 */}
      <Modal
        open={quoteModal}
        title={editingQuote ? '编辑报价' : '新增报价'}
        onCancel={() => setQuoteModal(false)}
        onOk={() => quoteForm.submit()}
        confirmLoading={saveQuote.isPending}
        okText="储存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={quoteForm} layout="vertical" onFinish={(v) => saveQuote.mutate(v)} style={{ marginTop: 12 }}>
          <Space style={{ width: '100%' }} size={12} align="start">
            <Form.Item name="supplierName" label="供方名称" rules={[{ required: true }]} style={{ flex: 2 }}>
              <Input />
            </Form.Item>
            <Form.Item name="stage" label="阶段" style={{ flex: 1 }}>
              <Select options={[{ value: 'before', label: '议价前' }, { value: 'after', label: '议价后' }]} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item name="moldPriceTaxed" label="模具含税(万元)"><InputNumber style={{ width: 150 }} /></Form.Item>
            <Form.Item name="productUnitPrice" label="产品未税单价"><InputNumber style={{ width: 150 }} /></Form.Item>
            <Form.Item name="unitPriceTotal" label="单价合计"><InputNumber style={{ width: 150 }} /></Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item name="sampleLeadTime" label="样品交期"><Input style={{ width: 150 }} /></Form.Item>
            <Form.Item name="deliveryCycle" label="交货周期"><Input style={{ width: 150 }} /></Form.Item>
            <Form.Item name="paymentTerms" label="账期"><Input style={{ width: 200 }} /></Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item name="moldItems" label="模具品项"><Input style={{ width: 220 }} /></Form.Item>
            <Form.Item name="moldPaymentTerms" label="模具款条件"><Input style={{ width: 220 }} /></Form.Item>
            <Form.Item name="priceTier" label="参考金属级距"><Input style={{ width: 200 }} /></Form.Item>
          </Space>
          <Form.Item name="backgroundInfo" label="背调信息"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="evaluation" label="综合评估"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
