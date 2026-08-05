import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled, StarOutlined, ThunderboltOutlined, TrophyOutlined } from '@ant-design/icons';
import { Download, Scale, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  AutoComplete,
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
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, backgroundApi, sourcingApi, suppliersApi, type QuoteInput } from '../../api';
import { GradeTag } from '../../components/GradeTag';
import { PageHeader } from '../../components/PageHeader';
import { apiErrorMessage } from '../../lib/api';
import type { BackgroundRow, Grade, SourcingQuote, SourcingRecommendation } from '../../types';

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
  const [quoteTab, setQuoteTab] = useState('price');

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
  // 最新一期评比等级：让「评比结果」也进入比价决策
  const periodsQuery = useQuery({ queryKey: ['periods'], queryFn: analyticsApi.periods });
  const latestPeriod = periodsQuery.data?.[0];
  const summaryQuery = useQuery({
    queryKey: ['summary', latestPeriod?.year, latestPeriod?.quarter],
    queryFn: () => analyticsApi.summary(latestPeriod!.year, latestPeriod!.quarter),
    enabled: !!latestPeriod,
  });

  // 统一「供应商画像」查找（评级 + 背调四维），供表格与表单共用，避免重复输入
  const profileByName = useMemo(() => {
    const suppliers = suppliersQuery.data ?? [];
    const bgById = new Map((bgQuery.data ?? []).map((b) => [b.vendorId, b]));
    const rankById = new Map((summaryQuery.data?.ranking ?? []).map((r) => [r.vendorId, r]));
    return (name: string) => {
      if (!name) return null;
      const v =
        suppliers.find((s) => s.name === name) ??
        suppliers.find((s) => s.name.includes(name) || name.includes(s.name));
      if (!v) return null;
      const bg = bgById.get(v.id) ?? null;
      const r = rankById.get(v.id) ?? null;
      return { vendor: v, bg, grade: (r?.grade ?? null) as Grade | null, score: r?.score ?? null, risk: bgRiskLevel(bg ?? undefined) };
    };
  }, [suppliersQuery.data, bgQuery.data, summaryQuery.data]);
  const bgByName = (name: string) => profileByName(name)?.risk ?? null;
  const supplierOptions = useMemo(
    () => (suppliersQuery.data ?? []).map((s) => ({ value: s.name })),
    [suppliersQuery.data],
  );
  const watchedSupplier = Form.useWatch('supplierName', quoteForm) as string | undefined;
  const watchedProfile = watchedSupplier ? profileByName(watchedSupplier) : null;

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
      if (!editingQuote) clearDraft();
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
    onSuccess: (r: { isBest?: boolean }) => {
      message.success(r?.isBest === false ? '已取消最优标记' : '已标记最优供应商');
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

  // 暂存草稿：把未提交的新增报价存到本机，下次打开自动带回（依案件区分）
  const draftKey = (eventId: number | null) => `sourcing-quote-draft-${eventId}`;
  const saveDraft = () => {
    if (selected == null) return;
    localStorage.setItem(draftKey(selected), JSON.stringify(quoteForm.getFieldsValue(true)));
    message.success('已暂存到本机，下次打开自动带回');
  };
  const clearDraft = () => {
    if (selected != null) localStorage.removeItem(draftKey(selected));
  };

  const openAddQuote = () => {
    setEditingQuote(null);
    setQuoteTab('price');
    quoteForm.resetFields();
    const draft = selected != null ? localStorage.getItem(draftKey(selected)) : null;
    if (draft) {
      try {
        quoteForm.setFieldsValue(JSON.parse(draft));
        message.info('已带入上次暂存的草稿');
      } catch {
        quoteForm.setFieldsValue({ stage: 'after' });
      }
    } else {
      quoteForm.setFieldsValue({ stage: 'after' });
    }
    setQuoteModal(true);
  };
  const openEditQuote = (q: SourcingQuote) => {
    setEditingQuote(q);
    setQuoteTab('price');
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
      title: '评级',
      width: 66,
      align: 'center',
      render: (_, q) => {
        const g = profileByName(q.supplierName)?.grade;
        return g ? <GradeTag grade={g} /> : <Tag>—</Tag>;
      },
    },
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
            title={q.isBest ? '取消最优标记' : '标记最优'}
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

  // 导出比价表为 CSV（UTF-8 BOM，Excel 直接打开、中文正常、无格式警告）
  const exportCsv = () => {
    if (!detail) return;
    const pct = (val: number | null, min: number) => {
      if (val == null || !isFinite(min) || min <= 0) return '';
      return Math.abs(val - min) < 1e-9 ? '最低' : `+${(((val - min) / min) * 100).toFixed(1)}%`;
    };
    const headers = [
      '供方', '评级', '阶段', '产品明细', '模具含税(万)', '模具价差', '单价合计', '单价价差', '级距单价',
      '背调风险', '样品交期', '交货周期', '账期', '模具款条件', '金属级距', '本案备注', '综合评估', '最优',
    ];
    const rows = detail.quotes.map((q) => {
      const products = q.products?.length
        ? q.products.map((p) => `${p.name}:模${p.moldPrice ?? '—'}/单${p.unitPrice ?? '—'}`).join(' ; ')
        : q.moldItems || '';
      const p = profileByName(q.supplierName);
      return [
        q.supplierName,
        p?.grade ?? '',
        q.stage === 'before' ? '议价前' : '议价后',
        products,
        q.moldPriceTaxed ?? '',
        pct(q.moldPriceTaxed, minMold),
        q.unitPriceTotal ?? '',
        pct(q.unitPriceTotal, minUnit),
        q.tierUnitPrice ?? '',
        p?.risk ? p.risk.text : '',
        q.sampleLeadTime ?? '',
        q.deliveryCycle ?? '',
        q.paymentTerms ?? '',
        q.moldPaymentTerms ?? '',
        q.priceTier ?? '',
        q.backgroundInfo ?? '',
        q.evaluation ?? '',
        q.isBest ? '★' : '',
      ];
    });
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `比价表_${detail.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<Scale size={22} />}
        title="比价寻源"
        subtitle="多供应商报价比对 · 背调风险 · AI 择优建议"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { eventForm.resetFields(); setEventModal(true); }}>
            新增比价案件
          </Button>
        }
      />

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
                  icon={<Download size={16} />}
                  disabled={!detail.quotes.length}
                  onClick={exportCsv}
                >
                  导出
                </Button>
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
        width={720}
        style={{ top: 32 }}
        destroyOnClose
        styles={{ body: { maxHeight: '64vh', overflowY: 'auto', paddingRight: 6 } }}
        footer={[
          !editingQuote && (
            <Button key="draft" onClick={saveDraft} style={{ float: 'left' }}>
              暂存
            </Button>
          ),
          <Button key="cancel" onClick={() => setQuoteModal(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" loading={saveQuote.isPending} onClick={() => quoteForm.submit()}>
            储存
          </Button>,
        ]}
      >
        <Form
          form={quoteForm}
          layout="vertical"
          onFinish={(v) => saveQuote.mutate(v)}
          onFinishFailed={() => setQuoteTab('price')}
          style={{ marginTop: 4 }}
        >
          <Tabs
            activeKey={quoteTab}
            onChange={setQuoteTab}
            items={[
              {
                key: 'price',
                label: '① 报价',
                forceRender: true,
                children: (
                  <>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Form.Item name="supplierName" label="供方名称" rules={[{ required: true }]} style={{ flex: 1, minWidth: 0 }}>
                        <AutoComplete
                          style={{ width: '100%' }}
                          options={supplierOptions}
                          filterOption={(input, opt) => String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                          placeholder="选既有供应商（自动带出评级/背调），或直接输入新供方"
                        />
                      </Form.Item>
                      <Form.Item name="stage" label="阶段" style={{ width: 150, flexShrink: 0 }}>
                        <Select style={{ width: '100%' }} options={[{ value: 'before', label: '议价前' }, { value: 'after', label: '议价后' }]} />
                      </Form.Item>
                    </div>
                    <Form.List name="products">
                      {(fields, { add, remove }) => (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Typography.Text strong>产品明细（脚架/框架、跳线…）</Typography.Text>
                            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', moldPrice: null, unitPrice: null })}>
                              加一列产品
                            </Button>
                          </div>
                          <Table
                            size="small"
                            pagination={false}
                            dataSource={fields}
                            rowKey="key"
                            locale={{ emptyText: '选填：逐一产品比价时点「加一列产品」；只比单价合计可留空' }}
                            columns={[
                              {
                                title: '产品名',
                                render: (_, field) => (
                                  <Form.Item name={[field.name, 'name']} rules={[{ required: true, message: '请填产品名' }]} style={{ margin: 0 }}>
                                    <Input placeholder="脚架 / 框架 / 跳线" />
                                  </Form.Item>
                                ),
                              },
                              {
                                title: '模具费(万元)',
                                width: 150,
                                render: (_, field) => (
                                  <Form.Item name={[field.name, 'moldPrice']} style={{ margin: 0 }}>
                                    <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
                                  </Form.Item>
                                ),
                              },
                              {
                                title: '未税单价(元/K)',
                                width: 160,
                                render: (_, field) => (
                                  <Form.Item name={[field.name, 'unitPrice']} style={{ margin: 0 }}>
                                    <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
                                  </Form.Item>
                                ),
                              },
                              {
                                title: '',
                                width: 44,
                                align: 'center',
                                render: (_, field) => (
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                ),
                              },
                            ]}
                          />
                        </div>
                      )}
                    </Form.List>
                    <Space style={{ width: '100%' }} size={12} wrap>
                      <Form.Item name="moldPriceTaxed" label="模具含税总(万元)"><InputNumber min={0} style={{ width: 150 }} /></Form.Item>
                      <Form.Item name="unitPriceTotal" label="单价合计"><InputNumber min={0} style={{ width: 150 }} /></Form.Item>
                      <Form.Item name="tierUnitPrice" label="级距单价"><InputNumber min={0} style={{ width: 130 }} /></Form.Item>
                    </Space>
                  </>
                ),
              },
              {
                key: 'terms',
                label: '② 交期与条款',
                forceRender: true,
                children: (
                  <>
                    <Space style={{ width: '100%' }} size={12} wrap>
                      <Form.Item name="sampleLeadTime" label="样品交期"><Input style={{ width: 150 }} placeholder="如 70天" /></Form.Item>
                      <Form.Item name="deliveryCycle" label="交货周期"><Input style={{ width: 150 }} /></Form.Item>
                      <Form.Item name="paymentTerms" label="账期"><Input style={{ width: 240 }} placeholder="如 TT30+180承兑汇票" /></Form.Item>
                    </Space>
                    <Space style={{ width: '100%' }} size={12} wrap>
                      <Form.Item name="moldItems" label="模具品项"><Input style={{ width: 220 }} /></Form.Item>
                      <Form.Item name="moldPaymentTerms" label="模具款条件"><Input style={{ width: 280 }} placeholder="如 定金30/送样40/验收30" /></Form.Item>
                      <Form.Item name="priceTier" label="参考金属级距"><Input style={{ width: 200 }} placeholder="如 铜价78000-79000" /></Form.Item>
                    </Space>
                  </>
                ),
              },
              {
                key: 'bg',
                label: '③ 背调与评估',
                forceRender: true,
                children: (
                  <>
                    {/* 评级 + 背调 自动由「评比 / 背调分析」带入，无需在此重复输入 */}
                    <Alert
                      type={watchedProfile ? 'info' : 'warning'}
                      showIcon
                      style={{ marginBottom: 16 }}
                      message={
                        watchedProfile ? (
                          <Space size={16} wrap>
                            <span>
                              评级：{watchedProfile.grade ? <GradeTag grade={watchedProfile.grade} /> : '—'}
                              {watchedProfile.score != null && <b style={{ marginLeft: 4 }}>{watchedProfile.score}</b>}
                            </span>
                            <span>
                              背调风险：
                              {watchedProfile.risk ? <Tag color={watchedProfile.risk.color}>{watchedProfile.risk.text}</Tag> : <Tag>无数据</Tag>}
                            </span>
                            {watchedProfile.bg ? (
                              <span style={{ color: '#64748b', fontSize: 12 }}>
                                拖欠 {watchedProfile.bg.latePaymentCount} · 客诉 {watchedProfile.bg.customerComplaintCount} · 8D{' '}
                                {watchedProfile.bg.qualityAbnormal8D} · 配合度 {watchedProfile.bg.cooperationScore ?? '—'}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>该供应商本年度尚无背调数据</span>
                            )}
                          </Space>
                        ) : (
                          '新供方 / 未在供应商主档 —— 无评级与背调可带入（于「季度评比 → 批量背调」建立后即自动带入）'
                        )
                      }
                    />
                    <Form.Item name="backgroundInfo" label="本案备注" extra="仅填本次议价的特殊事项即可；背调四维已自动带入上方，无需重复输入">
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="evaluation" label="综合评估">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
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
              <Alert type="info" showIcon icon={<Sparkles size={16} />} message="AI 说明" description={rec.ai.reply} />
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
