import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { notFound } from '../../lib/httpError';
import * as ai from '../ai/ai.service';

export const listEvents = () =>
  prisma.sourcingEvent.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { quotes: true } } },
  });

export const createEvent = (data: { title: string; itemName?: string | null; description?: string | null }) =>
  prisma.sourcingEvent.create({ data });

export const getEvent = async (id: number) => {
  const event = await prisma.sourcingEvent.findUnique({
    where: { id },
    include: { quotes: { orderBy: [{ supplierName: 'asc' }, { stage: 'asc' }] } },
  });
  if (!event) throw notFound('找不到该比价案件');
  return event;
};

export const updateEvent = async (
  id: number,
  data: { title?: string; itemName?: string | null; description?: string | null; status?: string },
) => {
  await getEvent(id);
  return prisma.sourcingEvent.update({ where: { id }, data });
};

export const deleteEvent = async (id: number) => {
  await getEvent(id);
  await prisma.$transaction([
    prisma.sourcingQuote.deleteMany({ where: { eventId: id } }),
    prisma.sourcingEvent.delete({ where: { id } }),
  ]);
  return { ok: true };
};

export interface QuoteProduct {
  name: string;
  moldPrice?: number | null;
  unitPrice?: number | null;
}

export type QuoteInput = {
  supplierName: string;
  stage?: string;
  moldItems?: string | null;
  products?: QuoteProduct[] | null;
  moldPriceTaxed?: number | null;
  productUnitPrice?: number | null;
  unitPriceTotal?: number | null;
  tierUnitPrice?: number | null;
  sampleLeadTime?: string | null;
  deliveryCycle?: string | null;
  paymentTerms?: string | null;
  moldPaymentTerms?: string | null;
  priceTier?: string | null;
  backgroundInfo?: string | null;
  evaluation?: string | null;
};

/** 將 products（Json 欄位）轉為 prisma 可接受的值：null → JsonNull，undefined → 不變更 */
const jsonOf = (
  v: QuoteProduct[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =>
  v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as unknown as Prisma.InputJsonValue);

export const addQuote = async (eventId: number, data: QuoteInput) => {
  await getEvent(eventId);
  return prisma.sourcingQuote.create({
    data: { eventId, ...data, products: jsonOf(data.products) } as Prisma.SourcingQuoteUncheckedCreateInput,
  });
};

export const updateQuote = async (id: number, data: Partial<QuoteInput>) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id } });
  if (!q) throw notFound('找不到该报价');
  return prisma.sourcingQuote.update({
    where: { id },
    data: { ...data, products: jsonOf(data.products) } as Prisma.SourcingQuoteUncheckedUpdateInput,
  });
};

export const deleteQuote = async (id: number) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id } });
  if (!q) throw notFound('找不到该报价');
  await prisma.sourcingQuote.delete({ where: { id } });
  return { ok: true };
};

/**
 * AI 建議最優一家：規則式綜合評分（單價越低 + 背調風險越低越好）+ 選配 AI 文字說明。
 * 權重：價格 60% / 背調 40%。背調由供應商名稱模糊比對帶入。
 */
export const recommend = async (eventId: number) => {
  const event = await getEvent(eventId);
  const quotes = event.quotes;
  if (!quotes.length) return { ruleBased: null, ai: { configured: ai.isConfigured(), reply: '' } };

  const [vendors, bgs] = await Promise.all([
    prisma.sQMVQMVendor.findMany({ select: { id: true, name: true } }),
    prisma.backgroundCheck.findMany({ orderBy: { year: 'desc' } }),
  ]);
  const bgLatest = new Map<number, (typeof bgs)[number]>();
  for (const b of bgs) if (!bgLatest.has(b.vendorId)) bgLatest.set(b.vendorId, b);
  const bgOf = (name: string): number | null => {
    const v = vendors.find((x) => x.name.includes(name) || name.includes(x.name));
    if (!v) return null;
    const b = bgLatest.get(v.id);
    return b ? b.latePaymentCount + b.customerComplaintCount + b.qualityAbnormal8D : null;
  };

  const prices = quotes.map((q) => q.unitPriceTotal).filter((v): v is number => v != null);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;

  const ranking = quotes
    .map((q) => {
      const price = q.unitPriceTotal ?? null;
      const priceScore = price == null || maxP === minP ? 50 : ((maxP - price) / (maxP - minP)) * 100;
      const bgRisk = bgOf(q.supplierName);
      const bgScore = bgRisk == null ? 60 : Math.max(0, 100 - bgRisk * 20);
      const composite = Math.round((0.6 * priceScore + 0.4 * bgScore) * 10) / 10;
      return { quoteId: q.id, supplierName: q.supplierName, stage: q.stage, price, bgRisk, composite };
    })
    .sort((a, b) => b.composite - a.composite);

  const top = ranking[0]!;
  const reasons: string[] = [];
  if (top.price != null && top.price === minP && prices.length > 1) reasons.push('单价最低');
  if (top.bgRisk === 0) reasons.push('背调正常');
  else if (top.bgRisk != null && top.bgRisk > 2) reasons.push('背调偏高（注意）');
  reasons.push(`综合评分最高（${top.composite}）`);

  let aiResult = { configured: ai.isConfigured(), reply: '' };
  if (ai.isConfigured()) {
    const table = ranking
      .map((r) => `${r.supplierName}：单价 ${r.price ?? '—'}，背调风险 ${r.bgRisk ?? '未知'}，综合评分 ${r.composite}`)
      .join('；');
    const system =
      '你是采购寻源顾问。根据候选供应商的报价与背调风险（数字越大风险越高），用简体中文简洁地建议「最优一家」并说明理由（综合价格与背调考量），2~4 句话。';
    const r = await ai.complete(system, `比价案件「${event.title}」候选供应商：${table}。请建议最优一家并说明理由。`);
    aiResult = { configured: true, reply: r.reply };
  }

  return {
    ruleBased: { recommendedQuoteId: top.quoteId, recommendedName: top.supplierName, reasons, ranking },
    ai: aiResult,
  };
};

/** 切換某報價的「最優一家」標記：已標記則取消，未標記則設為最優（同案件其餘取消） */
export const markBest = async (quoteId: number) => {
  const q = await prisma.sourcingQuote.findUnique({ where: { id: quoteId } });
  if (!q) throw notFound('找不到该报价');
  if (q.isBest) {
    // 再按一次 → 取消標記，案件回到未決
    await prisma.$transaction([
      prisma.sourcingQuote.update({ where: { id: quoteId }, data: { isBest: false } }),
      prisma.sourcingEvent.update({ where: { id: q.eventId }, data: { status: 'open' } }),
    ]);
    return { ok: true, isBest: false };
  }
  await prisma.$transaction([
    prisma.sourcingQuote.updateMany({ where: { eventId: q.eventId }, data: { isBest: false } }),
    prisma.sourcingQuote.update({ where: { id: quoteId }, data: { isBest: true } }),
    prisma.sourcingEvent.update({ where: { id: q.eventId }, data: { status: 'decided' } }),
  ]);
  return { ok: true, isBest: true };
};
