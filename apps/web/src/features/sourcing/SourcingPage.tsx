import { DeleteOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined, RobotOutlined, StarFilled, StarOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { backgroundApi, sourcingApi, suppliersApi, type QuoteInput } from '../../api';
import { apiErrorMessage } from '../../lib/api';
import type { BackgroundRow, SourcingQuote, SourcingRecommendation } from '../../types';

const CUR_YEAR = 2026;
const bgRiskLevel = (b: BackgroundRow | undefined) => {
  if (!b) return null;
  const n = b.latePaymentCount + b.customerComplaintCount + b.qualityAbnormal8D;
  return { n, text: n === 0 ? '正常' : n <= 2 ? '关注' : '偏高', color: n === 0 ? 'green' : n <= 2 ? 'gold' : 'red' };
};

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

  // 背调带入比价：供应商名称 → 结构化背调风险（让背调影响选商决策）
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list });
  const bgQuery = useQuery({ queryKey: ['background', CUR_YEAR], queryFn: () => backgroundApi.get(CUR_YEAR) });
  const bgByName = useMemo(() => {
    const suppliers = suppliersQuery.data ?? [];
    const bgById = new Map((bgQuery.data ?? []).map((b) => [b.vendorId, b]));
    return (name: string) => {
      const v = suppliers.find((s) => s.name.includes(name) || name.includes(s.name));
      return v ? bgRiskLevel(bgById.get(v.id)) : null;
    };
  }, [suppliersQuery.data, bgQuery.data]);

  // 议价前后对比：同一供应商同时有 议价前 + 议价后
  const negotiationPairs = useMemo(() => {
    const quotes = detailQuery.data?.quotes ?? [];
    const byName = new Map<string, { before?: SourcingQuote; after?: SourcingQuote }>();
    for (const q of quotes) {
      const e = byName.get(q.supplierName) ?? {};
      if (q.stage === 'before') e.before = q;
      else e.after = q;
      byName.set(q.supplierName, e);
    }
    return [...byName.entries()].filter(([, v]) => v.before && v.after).map(([name, v]) => ({ name, before: v.before!, after: v.after! }));
  }, [detailQuery.data]);

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

  const [recOpen, setRecOpen] = useState(false);
  const [rec, setRec] = useState<SourcingRecommendation | null>(null);
  const recommend = useMutation({
    mutationFn: () => sourcingApi.recommend(selected!),
    onSuccess: (r) => {
      setRec(r);
      setRecOpen(true);
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

  // 價差浮動比例：各家 vs 最低價（決策用）
  const eventQuotes = detailQuery.data?.quotes ?? [];
  const minMold = Math.min(...eventQuotes.map((q) => q.moldPriceTaxed ?? Infinity));
  const minUnit = Math.min(...eventQuotes.map((q) => q.unitPriceTotal ?? Infinity));
  const fluctuation = (val: number | null, min: number) => {
    if (val == null || !isFinite(min) || min <= 0) return <span>—</span>;
    const d = ((val - min) / min) * 100;
    return d < 0.05 ? <span style={{ color: '#0e9f6e' }}>最低</span> : <span style={{ color: '#e02424' }}>+{d.toFixed(1)}%</span>;
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
          {q.unitPriceTotal != null && q.unitPriceTotal === minUnit && <Tag color="green">价优</Tag>}
        </Space>
      ),
    },
    { title: '阶段', dataIndex: 'stage', width: 76, render: (s: string) => <Tag>{s === 'before' ? '议价前' : '议价后'}</Tag> },
    {
      title: '产品明细',
      width: 190,
      render: (_, q) =>
        q.products?.length ? (
          <Space direction="vertical" size={0}>
            {q.products.map((p, i) => (
              <span key={i} style={{ fontSize: 12 }}>
                {p.name}：模 {p.moldPrice ?? '—'} / 单 {p.unitPrice ?? '—'}
              </span>
            ))}
          </Space>
        ) : (
          q.moldItems || '—'
        ),
    },
    {
      title: '模具含税(万)',
      dataIndex: 'moldPriceTaxed',
      width: 100,
      align: 'right',
      render: (v: number | null) => (v == null ? '—' : <span style={{ color: v === minMold ? '#0e9f6e' : undefined, fontWeight: v === minMold ? 700 : 400 }}>{v}</span>),
    },
    { title: '模具价差', width: 84, align: 'right', render: (_, q) => fluctuation(q.moldPriceTaxed, minMold) },
    {
      title: '单价合计',
      dataIndex: 'unitPriceTotal',
      width: 90,
      align: 'right',
      render: (v: number | null) => (v == null ? '—' : <span style={{ color: v === minUnit ? '#0e9f6e' : undefined, fontWeight: v === minUnit ? 700 : 400 }}>{v}</span>),
    },
    { title: '单价价差', width: 84, align: 'right', render: (_, q) => fluctuation(q.unitPriceTotal, minUnit) },
    { title: '级距单价', dataIndex: 'tierUnitPrice', width: 84, align: 'right', render: (v) => v ?? '—' },
    {
      title: '背调风险',
      width: 88,
      align: 'center',
      render: (_, q) => {
        const r = bgByName(q.supplierName);
        return r ? <Tag color={r.color}>{r.text}</Tag> : <Tag>—</Tag>;
      },
    },
    { title: '样品交期', dataIndex: 'sampleLeadTime', width: 90 },
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
                <Button
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                  loading={recommend.isPending}
                  disabled={!detail.quotes.length}
                  onClick={() => recommend.mutate()}
                >
                  建议最优
                </Button>
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
            <>
              {negotiationPairs.length > 0 && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#f8fafc' }}>
                  <Space wrap>
                    <Typography.Text strong>议价前后：</Typography.Text>
                    {negotiationPairs.map((p) => {
                      const bf = p.before.unitPriceTotal;
                      const af = p.after.unitPriceTotal;
                      const imp = bf != null && af != null && bf > 0 ? ((bf - af) / bf) * 100 : null;
                      return (
                        <Tag key={p.name} color="blue">
                          {p.name}：单价 {bf ?? '—'} → {af ?? '—'}
                          {imp != null && imp > 0 && <b style={{ color: '#0e9f6e' }}> 降{imp.toFixed(1)}%</b>}
                        </Tag>
                      );
                    })}
                  </Space>
                </div>
              )}
              <Table<SourcingQuote>
                rowKey="id"
                columns={quoteColumns}
                dataSource={detail.quotes}
                size="small"
                pagination={false}
                scroll={{ x: 1900 }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无报价，点「新增报价」加入候选供应商" /> }}
              />
            </>
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
          <Form.List name="products">
            {(fields, { add, remove }) => (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Typography.Text strong>产品明细（脚架/框架、跳线…）</Typography.Text>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => add({ name: '', moldPrice: null, unitPrice: null })}>
                    加产品
                  </Button>
                </div>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={[name, 'name']} rules={[{ required: true, message: '产品名' }]} style={{ marginBottom: 0 }}>
                      <Input placeholder="产品名(脚架/跳线)" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'moldPrice']} style={{ marginBottom: 0 }}>
                      <InputNumber placeholder="模具费" style={{ width: 110 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'unitPrice']} style={{ marginBottom: 0 }}>
                      <InputNumber placeholder="未税单价" style={{ width: 110 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#e02424' }} />
                  </Space>
                ))}
              </div>
            )}
          </Form.List>
          <Space style={{ width: '100%' }} size={12} wrap>
            <Form.Item name="moldPriceTaxed" label="模具含税总(万元)"><InputNumber style={{ width: 150 }} /></Form.Item>
            <Form.Item name="unitPriceTotal" label="单价合计"><InputNumber style={{ width: 150 }} /></Form.Item>
            <Form.Item name="tierUnitPrice" label="级距单价"><InputNumber style={{ width: 130 }} /></Form.Item>
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

      {/* AI 建议最优一家 */}
      <Modal
        open={recOpen}
        title={<Space><TrophyOutlined style={{ color: '#e3a008' }} /> 建议最优一家</Space>}
        onCancel={() => setRecOpen(false)}
        footer={null}
        width={560}
      >
        {rec?.ruleBased ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="success"
              showIcon
              message={<span>推荐：<b>{rec.ruleBased.recommendedName}</b></span>}
              description={<Space wrap>{rec.ruleBased.reasons.map((r, i) => <Tag key={i} color="green">{r}</Tag>)}</Space>}
            />
            <div>
              <Typography.Text strong>综合评分排名（价格 60% + 背调 40%）</Typography.Text>
              {rec.ruleBased.ranking.map((r, i) => (
                <div key={r.quoteId} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                  <span style={{ width: 130, fontSize: 13 }}>{i + 1}. {r.supplierName}</span>
                  <Progress percent={r.composite} size="small" style={{ flex: 1 }} strokeColor={i === 0 ? '#0e9f6e' : '#1a56db'} />
                  {r.bgRisk != null && <Tag color={r.bgRisk === 0 ? 'green' : r.bgRisk <= 2 ? 'gold' : 'red'}>背调{r.bgRisk}</Tag>}
                </div>
              ))}
            </div>
            {rec.ai.configured && rec.ai.reply ? (
              <Alert type="info" showIcon icon={<RobotOutlined />} message="AI 说明" description={rec.ai.reply} />
            ) : (
              <Typography.Text type="secondary">（AI 未配置：以上为规则式综合评分建议。设定 Ollama 后将附上 AI 文字说明。）</Typography.Text>
            )}
            <Button
              type="primary"
              icon={<StarFilled />}
              block
              onClick={() => {
                markBest.mutate(rec.ruleBased!.recommendedQuoteId);
                setRecOpen(false);
              }}
            >
              采纳为最优一家
            </Button>
          </Space>
        ) : (
          <Empty description="无报价可分析" />
        )}
      </Modal>
    </Space>
  );
}
